const db = require("../database/database");

const DAILY_COINS = 500;
const DAILY_XP = 50;

const ONE_DAY = 24 * 60 * 60 * 1000;

function claimDaily(userId) {

    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE id = ?
    `).get(userId);

    const now = Date.now();

    if (user.last_daily) {

        const lastClaim = new Date(user.last_daily).getTime();

        const difference = now - lastClaim;

        if (difference < ONE_DAY) {

            return {

                success: false,

                remaining: ONE_DAY - difference

            };

        }

    }

    let streak = 1;

    if (user.last_daily) {

        const lastClaim = new Date(user.last_daily).getTime();

        const difference = now - lastClaim;

        if (difference <= ONE_DAY * 2) {

            streak = user.daily_streak + 1;

        }

    }

    db.prepare(`
        UPDATE users
        SET
            coins = coins + ?,
            xp = xp + ?,
            last_daily = ?,
            daily_streak = ?
        WHERE id = ?
    `).run(

        DAILY_COINS,

        DAILY_XP,

        new Date().toISOString(),

        streak,

        userId

    );

    return {

        success: true,

        coins: DAILY_COINS,

        xp: DAILY_XP,

        streak

    };

}

module.exports = {

    claimDaily

};