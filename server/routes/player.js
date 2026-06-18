const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { calcTotalIncome, LEVEL_DATA } = require('../game/constants');

// ── GET /api/player/me ──────────────────────────────────────
// Full game state for the current player
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows: players } = await query(
      `SELECT id, nickname, balance, xp, level, total_earned,
              upg_speed, upg_attract, upg_auto, last_income_at, created_at
       FROM players WHERE id = $1`,
      [req.playerId]
    );
    if (players.length === 0)
      return res.status(404).json({ error: 'Player not found' });

    const player = players[0];

    // Load ownerships with property details
    const { rows: ownerships } = await query(`
      SELECT o.property_id, o.pct, o.upg_level,
             pr.name, pr.location, pr.icon, pr.min_level,
             pr.cost, pr.income_base, pr.lat, pr.lng
      FROM ownership o
      JOIN properties pr ON pr.id = o.property_id
      WHERE o.player_id = $1
      ORDER BY pr.id
    `, [req.playerId]);

    const incomePerSec = calcTotalIncome(player, ownerships);

    res.json({
      player,
      ownerships,
      incomePerSec,
      levelInfo: LEVEL_DATA[player.level - 1],
    });
  } catch (err) {
    console.error('GET /me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/player/leaderboard ─────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT nickname, level, total_earned,
             (SELECT COUNT(*) FROM ownership WHERE player_id = players.id) AS properties_count
      FROM players
      ORDER BY total_earned DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/player/transactions ────────────────────────────
router.get('/transactions', authMiddleware, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50'), 200);
  const offset = parseInt(req.query.offset || '0');

  try {
    const { rows } = await query(`
      SELECT t.id, t.type, t.amount, t.meta, t.created_at,
             pr.name AS property_name, pr.icon AS property_icon
      FROM transactions t
      LEFT JOIN properties pr ON pr.id = t.property_id
      WHERE t.player_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.playerId, limit, offset]);

    res.json(rows);
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
