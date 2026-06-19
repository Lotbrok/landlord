require('dotenv').config();
const { pool } = require('./pool');

async function migrateOSM() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running OSM migration…');

    await client.query(`
      -- Меняем id на BIGINT чтобы хранить OSM way/node id (они огромные)
      -- и добавляем поля для OSM-объектов

      -- 1. Новая таблица для OSM зданий (отдельно от статических)
      CREATE TABLE IF NOT EXISTS osm_properties (
        id            BIGINT PRIMARY KEY,       -- OSM way_id или node_id
        osm_type      VARCHAR(10) NOT NULL,     -- 'way' | 'node' | 'relation'
        name          VARCHAR(200) NOT NULL,
        name_local    VARCHAR(200),             -- оригинальное название
        location      VARCHAR(200) NOT NULL,    -- город, страна
        icon          VARCHAR(10)  NOT NULL DEFAULT '🏠',
        building_type VARCHAR(50),              -- residential, commercial, etc
        min_level     SMALLINT NOT NULL DEFAULT 1,
        cost          NUMERIC(20, 4) NOT NULL,
        income_base   NUMERIC(10, 4) NOT NULL,
        lat           DOUBLE PRECISION NOT NULL,
        lng           DOUBLE PRECISION NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- 2. Таблица ownership для OSM (отдельная, чтобы не ломать старую)
      CREATE TABLE IF NOT EXISTS osm_ownership (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        osm_id      BIGINT NOT NULL REFERENCES osm_properties(id),
        pct         NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (pct >= 0 AND pct <= 100),
        upg_level   SMALLINT NOT NULL DEFAULT 0 CHECK (upg_level >= 0 AND upg_level <= 5),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (player_id, osm_id)
      );

      -- 3. Transactions — добавляем osm_id колонку если её нет
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS osm_id BIGINT REFERENCES osm_properties(id);

      -- 4. Индексы
      CREATE INDEX IF NOT EXISTS idx_osm_ownership_player ON osm_ownership(player_id);
      CREATE INDEX IF NOT EXISTS idx_osm_ownership_osm    ON osm_ownership(osm_id);
      CREATE INDEX IF NOT EXISTS idx_osm_props_location   ON osm_properties(lat, lng);

      -- updated_at trigger for osm_ownership
      DROP TRIGGER IF EXISTS trg_osm_ownership_updated_at ON osm_ownership;
      CREATE TRIGGER trg_osm_ownership_updated_at
        BEFORE UPDATE ON osm_ownership
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);

    console.log('✅ OSM migration complete.');
  } catch (err) {
    console.error('❌ OSM Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateOSM();
