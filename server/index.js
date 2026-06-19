require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const authRoutes       = require('./routes/auth');
const playerRoutes     = require('./routes/player');
const propertiesRoutes = require('./routes/properties');
const gameRoutes       = require('./routes/game');
const osmRoutes        = require('./routes/osm');
const { startIncomeTicker } = require('./game/incomeTicker');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');

// ── Security & Parsing ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // relaxed for the game's map/CDN assets
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));

// ── Rate Limiting ───────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/player',     playerRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/game',       gameRoutes);
app.use('/api/osm',        osmRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Serve frontend static files in production ───────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🏙  Landlord server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  startIncomeTicker();
});

module.exports = app;
