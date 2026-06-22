const router  = require('express').Router();
const { query, withTransaction } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { calcOSMPrice, getBuildingName, getIcon } = require('../game/osmPricer');
const { levelForXP, xpGainForPurchase } = require('../game/constants');

// ── Overpass API helper ─────────────────────────────────────
async function fetchOverpass(overpassQuery) {
  const url  = 'https://overpass-api.de/api/interpreter';
  const body = 'data=' + encodeURIComponent(overpassQuery);

  const res = await fetch(url, {
    method:  'POST',
    headers: {
  	'Content-Type': 'application/x-www-form-urlencoded',
  	'Accept':       'application/json',
  	'User-Agent':   'LandlordGame/1.0',
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('Overpass API error: ' + res.status);
  return res.json();
}

// ── Reverse geocode for country/city name ───────────────────
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LandlordGame/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const addr = data.address || {};
    const city    = addr.city || addr.town || addr.village || addr.county || '';
    const country = addr.country || '';
    return { city, country, location: [city, country].filter(Boolean).join(', ') };
  } catch {
    return { city: '', country: '', location: 'Неизвестное место' };
  }
}

// ── GET /api/osm/lookup?lat=&lng= ───────────────────────────
// Находит здание в радиусе 30м от клика
router.get('/lookup', authMiddleware, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng))
    return res.status(400).json({ error: 'lat and lng required' });

  try {
    // 1. Проверить — может это здание уже в нашей БД
    const { rows: existing } = await query(`
      SELECT op.*,
        COALESCE((SELECT SUM(pct) FROM osm_ownership WHERE osm_id = op.id), 0) AS total_owned_pct
      FROM osm_properties op
      WHERE ST_DWithin(
        ST_MakePoint(op.lng, op.lat)::geography,
        ST_MakePoint($2, $1)::geography,
        50
      )
      ORDER BY ST_Distance(
        ST_MakePoint(op.lng, op.lat)::geography,
        ST_MakePoint($2, $1)::geography
      )
      LIMIT 1
    `, [lat, lng]).catch(() => ({ rows: [] }));

    // Если ST_DWithin не работает (нет PostGIS) — fallback к простому поиску
    let existingProp = existing[0];
    if (!existingProp) {
      const { rows: nearby } = await query(`
        SELECT op.*,
          COALESCE((SELECT SUM(pct) FROM osm_ownership WHERE osm_id = op.id), 0) AS total_owned_pct
        FROM osm_properties op
        WHERE ABS(op.lat - $1) < 0.0005 AND ABS(op.lng - $2) < 0.0005
        ORDER BY (op.lat - $1)^2 + (op.lng - $2)^2
        LIMIT 1
      `, [lat, lng]);
      existingProp = nearby[0];
    }

    if (existingProp) {
      // Загрузить владельцев
      const { rows: owners } = await query(`
        SELECT p.nickname, oo.pct
        FROM osm_ownership oo
        JOIN players p ON p.id = oo.player_id
        WHERE oo.osm_id = $1
        ORDER BY oo.pct DESC
      `, [existingProp.id]);

      return res.json({
        found:    true,
        inDb:     true,
        property: existingProp,
        owners,
        availablePct: Math.max(0, 100 - parseFloat(existingProp.total_owned_pct)),
      });
    }

    // 2. Спросить Overpass — ищем здание/POI в радиусе 30м
    const overpassQ = `
      [out:json][timeout:6];
      (
        way(around:30,${lat},${lng})[building];
        node(around:30,${lat},${lng})[amenity];
        node(around:30,${lat},${lng})[tourism];
        node(around:30,${lat},${lng})[shop];
        way(around:30,${lat},${lng})[amenity];
        way(around:30,${lat},${lng})[tourism];
        way(around:30,${lat},${lng})[shop];
        way(around:30,${lat},${lng})[leisure];
      );
      out center tags 1;
    `;

    const osmData = await fetchOverpass(overpassQ);
    const elements = osmData.elements || [];

    if (elements.length === 0) {
      return res.json({ found: false, message: 'Здесь нет объектов для покупки. Попробуйте кликнуть точнее на здание.' });
    }

    // Берём первый (ближайший) элемент
    const el   = elements[0];
    const tags = el.tags || {};
    const cLat = el.center ? el.center.lat : el.lat;
    const cLng = el.center ? el.center.lon : el.lon;

    // 3. Геокодируем место
    const geo = await reverseGeocode(cLat, cLng);

    // 4. Считаем цену
    const pricing = calcOSMPrice(tags, geo.country);
    const name    = getBuildingName(tags, el.id);

    res.json({
      found:    true,
      inDb:     false,
      osmId:    el.id,
      osmType:  el.type,
      name,
      location: geo.location,
      city:     geo.city,
      country:  geo.country,
      icon:     pricing.icon,
      buildingType: pricing.buildingType,
      minLevel: pricing.minLevel,
      cost:     pricing.cost,
      incomeBase: pricing.incomeBase,
      lat:      cLat,
      lng:      cLng,
      tags,
      owners:   [],
      availablePct: 100,
      totalOwnedPct: 0,
    });

  } catch (err) {
    console.error('OSM lookup error:', err.message);
    res.status(500).json({ error: 'Не удалось получить данные карты. Попробуйте ещё раз.' });
  }
});

// ── POST /api/osm/buy ────────────────────────────────────────
// Body: { osmId, osmType, name, location, icon, buildingType,
//         minLevel, cost, incomeBase, lat, lng, pct }
router.post('/buy', authMiddleware, async (req, res) => {
  const { osmId, osmType, name, location, icon, buildingType,
          minLevel, cost, incomeBase, lat, lng, pct } = req.body;

  if (!osmId || !pct || pct <= 0 || pct > 100)
    return res.status(400).json({ error: 'osmId and pct (1-100) required' });

  try {
    const result = await withTransaction(async (client) => {

      // Lock player
      const { rows: players } = await client.query(
        'SELECT * FROM players WHERE id = $1 FOR UPDATE',
        [req.playerId]
      );
      const player = players[0];
      if (!player) throw { status: 404, error: 'Player not found' };

      // Level check
      if (player.level < (minLevel || 1))
        throw { status: 403, error: `Нужен уровень ${minLevel} для этого объекта` };

      // Upsert osm_property (сохраняем при первой покупке)
      await client.query(`
        INSERT INTO osm_properties
          (id, osm_type, name, location, icon, building_type, min_level, cost, income_base, lat, lng)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [osmId, osmType||'way', name, location, icon||'🏠',
          buildingType||'default', minLevel||1, cost, incomeBase, lat, lng]);

      // Check available pct
      const { rows: totalRows } = await client.query(
        'SELECT COALESCE(SUM(pct),0) AS total FROM osm_ownership WHERE osm_id = $1',
        [osmId]
      );
      const totalOwned = parseFloat(totalRows[0].total);
      const available  = 100 - totalOwned;
      if (pct > available)
        throw { status: 400, error: `Доступно только ${available.toFixed(1)}%` };

      // Cost
      const buyCost = parseFloat(cost) * (pct / 100);
      if (parseFloat(player.balance) < buyCost)
        throw { status: 400, error: 'Недостаточно средств' };

      // Deduct balance
      await client.query(
        'UPDATE players SET balance = balance - $1 WHERE id = $2',
        [buyCost, req.playerId]
      );

      // Upsert ownership
      await client.query(`
        INSERT INTO osm_ownership (player_id, osm_id, pct)
        VALUES ($1, $2, $3)
        ON CONFLICT (player_id, osm_id)
        DO UPDATE SET pct = osm_ownership.pct + EXCLUDED.pct
      `, [req.playerId, osmId, pct]);

      // XP
      const xpGain = xpGainForPurchase(buyCost);
      const newXP  = player.xp + xpGain;
      const newLvl = levelForXP(newXP);
      await client.query(
        'UPDATE players SET xp = $1, level = $2 WHERE id = $3',
        [newXP, newLvl, req.playerId]
      );

      // Log
      await client.query(`
        INSERT INTO transactions (player_id, type, osm_id, amount, meta)
        VALUES ($1, 'buy_osm', $2, $3, $4)
      `, [req.playerId, osmId, buyCost,
          JSON.stringify({ pct, name, osmId })]);

      return { cost: buyCost, xpGain, newLevel: newLvl, leveledUp: newLvl > player.level };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error('OSM buy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/osm/owned ───────────────────────────────────────
// Все OSM объекты игрока (для карты и дохода)
router.get('/owned', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT oo.osm_id AS property_id, oo.pct, oo.upg_level,
             op.name, op.location, op.icon, op.min_level,
             op.cost, op.income_base, op.lat, op.lng, op.building_type
      FROM osm_ownership oo
      JOIN osm_properties op ON op.id = oo.osm_id
      WHERE oo.player_id = $1
      ORDER BY op.name
    `, [req.playerId]);

    res.json(rows);
  } catch (err) {
    console.error('OSM owned error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/osm/markers?bounds=minLat,minLng,maxLat,maxLng ─
// OSM объекты в текущей области карты (для маркеров)
router.get('/markers', async (req, res) => {
  const { bounds } = req.query;
  if (!bounds) return res.json([]);

  const [minLat, minLng, maxLat, maxLng] = bounds.split(',').map(parseFloat);
  if ([minLat,minLng,maxLat,maxLng].some(isNaN))
    return res.status(400).json({ error: 'Invalid bounds' });

  try {
    const { rows } = await query(`
      SELECT op.id, op.name, op.icon, op.lat, op.lng, op.building_type,
        COALESCE((SELECT SUM(pct) FROM osm_ownership WHERE osm_id = op.id), 0) AS total_owned_pct
      FROM osm_properties op
      WHERE op.lat BETWEEN $1 AND $3
        AND op.lng BETWEEN $2 AND $4
      LIMIT 200
    `, [minLat, minLng, maxLat, maxLng]);

    res.json(rows);
  } catch (err) {
    console.error('OSM markers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
