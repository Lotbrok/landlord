const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// ── GET /api/properties ─────────────────────────────────────
// All properties + total owned % per property (for map markers)
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT pr.*,
        COALESCE(
          (SELECT SUM(o.pct) FROM ownership o WHERE o.property_id = pr.id),
          0
        ) AS total_owned_pct
      FROM properties pr
      ORDER BY pr.id
    `);
    res.json(rows);
  } catch (err) {
    console.error('Properties list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/properties/:id ─────────────────────────────────
// One property + per-player breakdown of ownership (for popup)
router.get('/:id', async (req, res) => {
  const propId = parseInt(req.params.id);
  if (isNaN(propId))
    return res.status(400).json({ error: 'Invalid property id' });

  try {
    const { rows: props } = await query(
      'SELECT * FROM properties WHERE id = $1',
      [propId]
    );
    if (props.length === 0)
      return res.status(404).json({ error: 'Property not found' });

    // Who owns what percent?
    const { rows: owners } = await query(`
      SELECT p.nickname, o.pct, o.upg_level
      FROM ownership o
      JOIN players p ON p.id = o.player_id
      WHERE o.property_id = $1
      ORDER BY o.pct DESC
    `, [propId]);

    const totalOwnedPct = owners.reduce((s, r) => s + parseFloat(r.pct), 0);

    res.json({
      property: props[0],
      owners,
      totalOwnedPct,
      availablePct: Math.max(0, 100 - totalOwnedPct),
    });
  } catch (err) {
    console.error('Property detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
