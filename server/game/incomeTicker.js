const { query, withTransaction } = require('../db/pool');
const { calcTotalIncome, levelForXP } = require('./constants');

const TICK_SECONDS = parseInt(process.env.INCOME_TICK_SECONDS || '10');

async function runIncomeTick() {
  try {
    // Load all players who have at least one ownership
    const { rows: players } = await query(`
      SELECT DISTINCT p.id, p.level, p.upg_speed, p.last_income_at
      FROM players p
      JOIN ownership o ON o.player_id = p.id
    `);

    if (players.length === 0) return;

    for (const player of players) {
      try {
        const secondsElapsed = Math.floor(
          (Date.now() - new Date(player.last_income_at).getTime()) / 1000
        );
        if (secondsElapsed < 1) continue;

        // Get ownerships with property income_base
        const { rows: ownerships } = await query(`
          SELECT o.pct, o.upg_level, pr.income_base
          FROM ownership o
          JOIN properties pr ON pr.id = o.property_id
          WHERE o.player_id = $1
        `, [player.id]);

        const incomePerSec = calcTotalIncome(player, ownerships);
        const earned = incomePerSec * secondsElapsed;
        if (earned <= 0) continue;

        await withTransaction(async (client) => {
          // Credit balance and total_earned, update last_income_at
          await client.query(`
            UPDATE players
            SET balance        = balance + $1,
                total_earned   = total_earned + $1,
                last_income_at = NOW()
            WHERE id = $2
          `, [earned, player.id]);

          // Log the income transaction
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
  // Run once on startup after a short delay
  setTimeout(runIncomeTick, 3000);
}

module.exports = { startIncomeTicker };
