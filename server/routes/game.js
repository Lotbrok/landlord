const router = require('express').Router();
const { query, withTransaction } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const {
  levelForXP,
  xpGainForPurchase,
  propUpgradeCost,
  UPGRADE_COSTS,
  UPGRADE_SPEED_MULT,
} = require('../game/constants');

// ── POST /api/game/buy ──────────────────────────────────────
// Body: { propertyId: number, pct: number }
router.post('/buy', authMiddleware, async (req, res) => {
  const { propertyId, pct } = req.body;

  if (!propertyId || !pct || pct <= 0 || pct > 100)
    return res.status(400).json({ error: 'propertyId and pct (1–100) are required' });

  try {
    const result = await withTransaction(async (client) => {

      // Lock player row for update
      const { rows: players } = await client.query(
        'SELECT * FROM players WHERE id = $1 FOR UPDATE',
        [req.playerId]
      );
      if (players.length === 0) throw { status: 404, error: 'Player not found' };
      const player = players[0];

      // Get property
      const { rows: props } = await client.query(
        'SELECT * FROM properties WHERE id = $1',
        [propertyId]
      );
      if (props.length === 0) throw { status: 404, error: 'Property not found' };
      const prop = props[0];

      // Level check
      if (player.level < prop.min_level)
        throw { status: 403, error: `Need level ${prop.min_level} to buy this property` };

      // How much is already owned by everyone (including this player)?
      const { rows: totalRows } = await client.query(
        'SELECT COALESCE(SUM(pct),0) AS total FROM ownership WHERE property_id = $1',
        [propertyId]
      );
      const totalOwned = parseFloat(totalRows[0].total);
      const available  = 100 - totalOwned;

      if (pct > available)
        throw { status: 400, error: `Only ${available.toFixed(2)}% available for purchase` };

      // Cost (apply attract upgrade discount if any — kept simple here)
      const cost = parseFloat(prop.cost) * (pct / 100);

      if (parseFloat(player.balance) < cost)
        throw { status: 400, error: 'Insufficient balance' };

      // Deduct balance
      await client.query(
        'UPDATE players SET balance = balance - $1 WHERE id = $2',
        [cost, req.playerId]
      );

      // Upsert ownership
      await client.query(`
        INSERT INTO ownership (player_id, property_id, pct)
        VALUES ($1, $2, $3)
        ON CONFLICT (player_id, property_id)
        DO UPDATE SET pct = ownership.pct + EXCLUDED.pct
      `, [req.playerId, propertyId, pct]);

      // XP gain + possible level up
      const xpGain = xpGainForPurchase(cost);
      const newXP  = player.xp + xpGain;
      const newLvl = levelForXP(newXP);
      await client.query(
        'UPDATE players SET xp = $1, level = $2 WHERE id = $3',
        [newXP, newLvl, req.playerId]
      );

      // Log transaction
      await client.query(`
        INSERT INTO transactions (player_id, type, property_id, amount, meta)
        VALUES ($1, 'buy', $2, $3, $4)
      `, [req.playerId, propertyId, cost,
          JSON.stringify({ pct, propName: prop.name })]);

      return { cost, xpGain, newLevel: newLvl, leveledUp: newLvl > player.level };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error('Buy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/game/upgrade/property ────────────────────────
// Body: { propertyId: number }
router.post('/upgrade/property', authMiddleware, async (req, res) => {
  const { propertyId } = req.body;
  if (!propertyId)
    return res.status(400).json({ error: 'propertyId is required' });

  try {
    const result = await withTransaction(async (client) => {
      const { rows: players } = await client.query(
        'SELECT * FROM players WHERE id = $1 FOR UPDATE',
        [req.playerId]
      );
      const player = players[0];

      const { rows: owned } = await client.query(`
        SELECT o.*, pr.cost AS prop_cost, pr.name AS prop_name
        FROM ownership o
        JOIN properties pr ON pr.id = o.property_id
        WHERE o.player_id = $1 AND o.property_id = $2
        FOR UPDATE OF o
      `, [req.playerId, propertyId]);

      if (owned.length === 0)
        throw { status: 404, error: 'You do not own this property' };

      const row = owned[0];
      if (row.upg_level >= 5)
        throw { status: 400, error: 'Property already at max upgrade level' };

      const cost = propUpgradeCost(row.prop_cost, row.upg_level);

      if (parseFloat(player.balance) < cost)
        throw { status: 400, error: 'Insufficient balance' };

      await client.query(
        'UPDATE players SET balance = balance - $1 WHERE id = $2',
        [cost, req.playerId]
      );
      await client.query(
        'UPDATE ownership SET upg_level = upg_level + 1 WHERE player_id = $1 AND property_id = $2',
        [req.playerId, propertyId]
      );

      // Small XP bonus
      await client.query(
        'UPDATE players SET xp = xp + 20 WHERE id = $1',
        [req.playerId]
      );

      await client.query(`
        INSERT INTO transactions (player_id, type, property_id, amount, meta)
        VALUES ($1, 'upgrade_prop', $2, $3, $4)
      `, [req.playerId, propertyId, cost,
          JSON.stringify({ newLevel: row.upg_level + 1, propName: row.prop_name })]);

      return { cost, newUpgLevel: row.upg_level + 1 };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error('Upgrade property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/game/upgrade/global ──────────────────────────
// Body: { upgradeKey: 'speed' | 'attract' | 'auto' }
router.post('/upgrade/global', authMiddleware, async (req, res) => {
  const { upgradeKey } = req.body;
  const validKeys = ['speed', 'attract', 'auto'];

  if (!validKeys.includes(upgradeKey))
    return res.status(400).json({ error: `upgradeKey must be one of: ${validKeys.join(', ')}` });

  const colMap = { speed: 'upg_speed', attract: 'upg_attract', auto: 'upg_auto' };
  const col = colMap[upgradeKey];

  try {
    const result = await withTransaction(async (client) => {
      const { rows: players } = await client.query(
        'SELECT * FROM players WHERE id = $1 FOR UPDATE',
        [req.playerId]
      );
      const player = players[0];
      const currentLevel = player[col];

      if (currentLevel >= 5)
        throw { status: 400, error: 'Upgrade already at max level' };

      const cost = UPGRADE_COSTS[upgradeKey][currentLevel];

      if (parseFloat(player.balance) < cost)
        throw { status: 400, error: 'Insufficient balance' };

      await client.query(
        `UPDATE players SET balance = balance - $1, ${col} = ${col} + 1, xp = xp + 50 WHERE id = $2`,
        [cost, req.playerId]
      );

      await client.query(`
        INSERT INTO transactions (player_id, type, amount, meta)
        VALUES ($1, 'upgrade_global', $2, $3)
      `, [req.playerId, cost, JSON.stringify({ upgradeKey, newLevel: currentLevel + 1 })]);

      return { cost, upgradeKey, newLevel: currentLevel + 1 };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error('Upgrade global error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
