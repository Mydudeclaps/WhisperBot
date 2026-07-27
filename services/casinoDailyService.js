// Casino daily bonus (/casino daily), separate from the /here check-in
// streak — this one lives on casino_stats and rewards regular play in
// the casino specifically. Same "grace window" streak pattern as
// dailyCheckinService.js.
const db = require("../database/database");
const { addCoins } = require("./coinService");
const { addCasinoXP } = require("./casinoService");
const { CASINO_DAILY_BONUS, CASINO_XP } = require("../config/gameConfig");

const HOUR_MS = 60 * 60 * 1000;


function ensureRow(userId) {

    db.prepare(`
        INSERT OR IGNORE INTO casino_stats (user_id)
        VALUES (?)
    `).run(userId);

}


// Returns either:
//   { success: false, msUntilNext }
//   { success: true, streak, coins, newBalance }
function claimDailyBonus(userId, username) {

    ensureRow(userId);

    const row = db.prepare(`
        SELECT last_daily_bonus, daily_bonus_streak
        FROM casino_stats
        WHERE user_id = ?
    `).get(userId);

    const now = Date.now();
    const lastClaim = row.last_daily_bonus ? new Date(row.last_daily_bonus).getTime() : null;

    if (lastClaim !== null) {

        const msSinceLast = now - lastClaim;
        const cooldownMs = CASINO_DAILY_BONUS.COOLDOWN_HOURS * HOUR_MS;

        if (msSinceLast < cooldownMs) {

            return { success: false, msUntilNext: cooldownMs - msSinceLast };

        }

    }

    let newStreak = 1;

    if (lastClaim !== null) {

        const msSinceLast = now - lastClaim;
        const streakWindowMs = CASINO_DAILY_BONUS.STREAK_WINDOW_HOURS * HOUR_MS;

        if (msSinceLast <= streakWindowMs) {
            newStreak = (row.daily_bonus_streak || 0) + 1;
        }

    }

    const streakDaysCounted = Math.min(newStreak, CASINO_DAILY_BONUS.MAX_STREAK_DAYS);
    const coins = CASINO_DAILY_BONUS.BASE_COINS +
        (streakDaysCounted * CASINO_DAILY_BONUS.STREAK_STEP_COINS);

    db.prepare(`
        UPDATE casino_stats
        SET last_daily_bonus = ?, daily_bonus_streak = ?
        WHERE user_id = ?
    `).run(new Date(now).toISOString(), newStreak, userId);

    const newBalance = addCoins(userId, username, coins);
    addCasinoXP(userId, CASINO_XP.DAILY_BONUS_XP);

    return { success: true, streak: newStreak, coins, newBalance };

}


module.exports = {
    claimDailyBonus
};
