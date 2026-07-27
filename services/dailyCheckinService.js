const db = require("../database/database");

const {
    getUser
} = require("./userService");

const {
    addXP
} = require("./xpService");

const {
    COOLDOWN_HOURS,
    BASE_COINS,
    BASE_XP,
    BASE_REP,
    STREAK_BONUS_INTERVAL,
    STREAK_BONUS_MULTIPLIER,
    GRACE_PERIOD_HOURS
} = require("../config/dailyConfig");


const HOUR_MS = 60 * 60 * 1000;


// Attempts a daily check-in for a user. Returns either:
//   { success: false, msUntilNext } — still on cooldown
//   { success: true, streak, totalCheckins, bonusApplied, multiplier,
//     coins, xp, rep, levelResult }
function checkIn(userId, username) {

    const user = getUser(userId, username);

    const now = Date.now();

    const lastDaily = user.last_daily
        ? new Date(user.last_daily).getTime()
        : null;

    if (lastDaily !== null) {

        const msSinceLast = now - lastDaily;
        const cooldownMs = COOLDOWN_HOURS * HOUR_MS;

        if (msSinceLast < cooldownMs) {

            return {
                success: false,
                msUntilNext: cooldownMs - msSinceLast
            };

        }

    }

    // Streak continues if this check-in happens before a full day is
    // missed — i.e. any time up to 2x the cooldown (the natural next-day
    // window) plus the configured grace period. Anything later resets to
    // day 1.
    let newStreak = 1;

    if (lastDaily !== null) {

        const msSinceLast = now - lastDaily;
        const streakWindowMs =
            (COOLDOWN_HOURS * 2 + GRACE_PERIOD_HOURS) * HOUR_MS;

        if (msSinceLast <= streakWindowMs) {

            newStreak = (user.daily_streak || 0) + 1;

        }

    }

    const bonusApplied =
        STREAK_BONUS_INTERVAL > 0 &&
        newStreak % STREAK_BONUS_INTERVAL === 0;

    const multiplier = bonusApplied
        ? STREAK_BONUS_MULTIPLIER
        : 1;

    const coins = BASE_COINS * multiplier;
    const xp = BASE_XP * multiplier;
    const rep = BASE_REP * multiplier;

    db.prepare(`
        UPDATE users
        SET
            coins = coins + ?,
            kingdom_rep = kingdom_rep + ?,
            daily_streak = ?,
            last_daily = ?,
            total_dailies = total_dailies + 1
        WHERE id = ?
    `).run(
        coins,
        rep,
        newStreak,
        new Date(now).toISOString(),
        userId
    );

    const levelResult = addXP(userId, xp);

    const totalCheckins = (user.total_dailies || 0) + 1;

    return {
        success: true,
        streak: newStreak,
        totalCheckins,
        bonusApplied,
        multiplier,
        coins,
        xp,
        rep,
        levelResult
    };

}


module.exports = {

    checkIn

};
