const { query, withTransaction } = require('../db/pool');
const { calcTotalIncome, levelForXP } = require('./constants');

const TICK_SECONDS = parseInt(process.env.INCOME_TICK_SECONDS || '10');

async function runIncomeTick() {
  try {
    // All players with any ownership (static or OSM)
    const { rows: players } = await query(`
      SELECT DISTINCT p.id, p.level, p.upg_speed, p.last_income_at
      FROM players p
      WHERE EXISTS (SELECT 1 FROM ownership     o  WHERE o.player_id = p.id)
         OR EXISTS (SELECT 1 FROM osm_ownership oo WHERE oo.player_id = p.id)
    `);

    if (players.length === 0) return;

    for (const player of players) {
      try {
        const secondsElapsed = Math.floor(
          (Date.now() - new Date(player.last_income_at).getTime()) / 1000
        );
        if (secondsElapsed < 1) continue;

        // Static ownerships
        const { rows: staticOwn } = await query(`
          SELECT o.pct, o.upg_level, pr.income_base
          FROM ownership o
          JOIN properties pr ON pr.id = o.property_id
          WHERE o.player_id = $1
        `, [player.id]);

        // OSM ownerships
        const { rows: osmOwn } = await query(`
          SELECT oo.pct, oo.upg_level, op.income_base
          FROM osm_ownership oo
          JOIN osm_properties op ON op.id = oo.osm_id
          WHERE oo.player_id = $1
        `, [player.id]);

        const allOwnerships = [...staticOwn, ...osmOwn];
        const incomePerSec  = calcTotalIncome(player, allOwnerships);
        const earned        = incomePerSec * secondsElapsed;
        if (earned <= 0) continue;

        await withTransaction(async (client) => {
          await client.query(`
            UPDATE players
            SET balance        = balance + $1,
                total_earned   = total_earned + $1,
                last_income_at = NOW()
            WHERE id = $2
          `, [earned, player.id]);

          await client.query(`
            INSERT INTO transactions (player_id, type, amount, meta)
            VALUES ($1, 'income', $2, $3)
          `, [player.id, earned, JSON.stringify({ seconds: secondsElapsed })]);
        });
      } catch (playerErr) {
        console.error(`Income tick error for player ${player.id}:`, playerErr.message);
      }
    }
  } catch (err) {
    console.error('Income tick fatal error:', err.message);
  }
}

function startIncomeTicker() {
  console.log(`⏱  Income ticker started — tick every ${TICK_SECONDS}s`);
  setInterval(runIncomeTick, TICK_SECONDS * 1000);
  setTimeout(runIncomeTick, 3000);
}

module.exports = { startIncomeTicker };
