require('dotenv').config();
const { pool } = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations…');

    await client.query(`
      -- ── EXTENSIONS ──────────────────────────────────────────────
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- ── PLAYERS ─────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS players (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nickname      VARCHAR(32) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        balance       NUMERIC(20, 4) NOT NULL DEFAULT 10000,
        xp            INTEGER NOT NULL DEFAULT 0,
        level         SMALLINT NOT NULL DEFAULT 1,
        total_earned  NUMERIC(20, 4) NOT NULL DEFAULT 0,
        -- global upgrades stored as small integers (0-5 each)
        upg_speed     SMALLINT NOT NULL DEFAULT 0,
        upg_attract   SMALLINT NOT NULL DEFAULT 0,
        upg_auto      SMALLINT NOT NULL DEFAULT 0,
        last_income_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── PROPERTIES ──────────────────────────────────────────────
      -- Static reference table; populated by seed.js
      CREATE TABLE IF NOT EXISTS properties (
        id            INTEGER PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        location      VARCHAR(100) NOT NULL,
        icon          VARCHAR(10)  NOT NULL,
        min_level     SMALLINT NOT NULL DEFAULT 1,
        cost          NUMERIC(20, 4) NOT NULL,
        income_base   NUMERIC(10, 4) NOT NULL,  -- income/sec at 100% ownership
        lat           DOUBLE PRECISION NOT NULL,
        lng           DOUBLE PRECISION NOT NULL
      );

      -- ── OWNERSHIP ───────────────────────────────────────────────
      -- One row per (player, property). pct is 0-100.
      CREATE TABLE IF NOT EXISTS ownership (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        pct         NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (pct >= 0 AND pct <= 100),
        upg_level   SMALLINT NOT NULL DEFAULT 0 CHECK (upg_level >= 0 AND upg_level <= 5),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (player_id, property_id)
      );

      -- ── TRANSACTIONS LOG ────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS transactions (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        type        VARCHAR(20) NOT NULL,  -- 'buy', 'income', 'upgrade_prop', 'upgrade_global'
        property_id INTEGER REFERENCES properties(id),
        amount      NUMERIC(20, 4) NOT NULL,
        meta        JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── INDEXES ─────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_ownership_player   ON ownership(player_id);
      CREATE INDEX IF NOT EXISTS idx_ownership_property ON ownership(property_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player_id);
      CREATE INDEX IF NOT EXISTS idx_players_nickname   ON players(nickname);

      -- ── updated_at auto-trigger ──────────────────────────────────
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_players_updated_at   ON players;
      CREATE TRIGGER trg_players_updated_at
        BEFORE UPDATE ON players
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

      DROP TRIGGER IF EXISTS trg_ownership_updated_at ON ownership;
      CREATE TRIGGER trg_ownership_updated_at
        BEFORE UPDATE ON ownership
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);

    console.log('✅ Migrations complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
