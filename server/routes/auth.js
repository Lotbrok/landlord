const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query } = require('../db/pool');
const { STARTING_BALANCE } = require('../game/constants');

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { nickname, password } = req.body;

  if (!nickname || !password)
    return res.status(400).json({ error: 'nickname and password are required' });

  if (nickname.length < 3 || nickname.length > 32)
    return res.status(400).json({ error: 'Nickname must be 3–32 characters' });

  if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(nickname))
    return res.status(400).json({ error: 'Nickname can only contain letters, digits and underscores' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(password, 12);

    const { rows } = await query(`
      INSERT INTO players (nickname, password_hash, balance)
      VALUES ($1, $2, $3)
      RETURNING id, nickname, balance, xp, level, created_at
    `, [nickname, hash, STARTING_BALANCE]);

    const player = rows[0];
    const token = jwt.sign(
      { playerId: player.id, nickname: player.nickname },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, player });
  } catch (err) {
    if (err.code === '23505') // unique_violation
      return res.status(409).json({ error: 'Nickname already taken' });
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  const { nickname, password } = req.body;

  if (!nickname || !password)
    return res.status(400).json({ error: 'nickname and password are required' });

  try {
    const { rows } = await query(
      'SELECT * FROM players WHERE nickname = $1',
      [nickname]
    );

    if (rows.length === 0)
      return res.status(401).json({ error: 'Invalid nickname or password' });

    const player = rows[0];
    const valid  = await bcrypt.compare(password, player.password_hash);

    if (!valid)
      return res.status(401).json({ error: 'Invalid nickname or password' });

    const token = jwt.sign(
      { playerId: player.id, nickname: player.nickname },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Return player without password hash
    const { password_hash, ...safePlayer } = player;
    res.json({ token, player: safePlayer });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
