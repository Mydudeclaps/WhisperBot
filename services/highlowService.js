const db = require("../database/database");


function ensureRow(userId) {

    db.prepare(`
        INSERT OR IGNORE INTO highlow_stats (user_id)
        VALUES (?)
    `).run(userId);

}


function recordResult(userId, won, amount) {

    ensureRow(userId);

    if (won) {

        db.prepare(`
            UPDATE highlow_stats
            SET games_played = games_played + 1,
                games_won = games_won + 1,
                total_won = total_won + ?
            WHERE user_id = ?
        `).run(amount, userId);

    } else {

        db.prepare(`
            UPDATE highlow_stats
            SET games_played = games_played + 1,
                total_lost = total_lost + ?
            WHERE user_id = ?
        `).run(amount, userId);

    }

}


function recordPush(userId) {

    ensureRow(userId);

    db.prepare(`
        UPDATE highlow_stats
        SET games_played = games_played + 1
        WHERE user_id = ?
    `).run(userId);

}


function getStats(userId) {

    ensureRow(userId);

    return db.prepare(
        "SELECT * FROM highlow_stats WHERE user_id = ?"
    ).get(userId);

}


module.exports = {

    recordResult,
    recordPush,
    getStats

};
