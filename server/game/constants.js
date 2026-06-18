// ═══════════════════════════════════════════════════════════
//  GAME CONSTANTS & PURE CALCULATION HELPERS
//  Used by both the income ticker and API routes.
// ═══════════════════════════════════════════════════════════

const LEVEL_DATA = [
  { xp: 0,      bonus: 1.0  },
  { xp: 100,    bonus: 1.05 },
  { xp: 250,    bonus: 1.10 },
  { xp: 500,    bonus: 1.15 },
  { xp: 900,    bonus: 1.20 },
  { xp: 1500,   bonus: 1.25 },
  { xp: 2500,   bonus: 1.30 },
  { xp: 4000,   bonus: 1.40 },
  { xp: 6000,   bonus: 1.50 },
  { xp: 9000,   bonus: 1.60 },
  { xp: 13000,  bonus: 1.75 },
  { xp: 18000,  bonus: 1.90 },
  { xp: 25000,  bonus: 2.00 },
  { xp: 35000,  bonus: 2.20 },
  { xp: 50000,  bonus: 2.50 },
  { xp: 70000,  bonus: 2.80 },
  { xp: 100000, bonus: 3.00 },
  { xp: 150000, bonus: 3.50 },
  { xp: 200000, bonus: 4.00 },
  { xp: 300000, bonus: 5.00 },
];

const UPGRADE_SPEED_MULT   = [1, 1.3, 1.7, 2.2, 3.0, 4.5];
const UPGRADE_ATTRACT_MULT = [1, 1.1, 1.25, 1.5, 1.8, 2.5];

const UPGRADE_COSTS = {
  speed:   [500,   2000,  8000,  30000,  100000],
  attract: [800,   3000,  12000, 50000,  200000],
  auto:    [1500,  6000,  25000, 80000,  300000],
};

const STARTING_BALANCE = parseFloat(process.env.STARTING_BALANCE || '10000');
const MAX_LEVEL = 20;

// ── Level helpers ───────────────────────────────────────────
function levelForXP(xp) {
  let lvl = 1;
  for (let i = 1; i < MAX_LEVEL; i++) {
    if (xp >= LEVEL_DATA[i].xp) lvl = i + 1;
    else break;
  }
  return lvl;
}

function xpGainForPurchase(cost) {
  return Math.max(5, Math.round(Math.log10(Math.max(cost, 10)) * 10));
}

// ── Income per second for one ownership row ─────────────────
function calcRowIncome({ income_base, pct, upg_level, upg_speed, level }) {
  const lvlBonus   = LEVEL_DATA[level - 1]?.bonus ?? 1;
  const speedMult  = UPGRADE_SPEED_MULT[upg_speed] ?? 1;
  const upgBonus   = 1 + (upg_level || 0) * 0.25;
  return parseFloat(income_base) * (parseFloat(pct) / 100) * lvlBonus * speedMult * upgBonus;
}

// ── Total income/sec for a player with all their ownerships ──
function calcTotalIncome(player, ownerships) {
  return ownerships.reduce((sum, row) => {
    return sum + calcRowIncome({
      income_base: row.income_base,
      pct:         row.pct,
      upg_level:   row.upg_level,
      upg_speed:   player.upg_speed,
      level:       player.level,
    });
  }, 0);
}

// ── Property upgrade cost ───────────────────────────────────
function propUpgradeCost(propertyCost, currentUpgLevel) {
  return Math.round(parseFloat(propertyCost) * 0.2 * (currentUpgLevel + 1));
}

module.exports = {
  LEVEL_DATA,
  UPGRADE_SPEED_MULT,
  UPGRADE_ATTRACT_MULT,
  UPGRADE_COSTS,
  STARTING_BALANCE,
  MAX_LEVEL,
  levelForXP,
  xpGainForPurchase,
  calcRowIncome,
  calcTotalIncome,
  propUpgradeCost,
};
