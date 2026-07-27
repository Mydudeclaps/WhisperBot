const db = require("../database/database");

function incrementStat(userId, statName, amount = 1) {

    const existing = db.prepare(`
        SELECT stat_value
        FROM user_stats
        WHERE user_id = ?
        AND stat_name = ?
    `).get(userId, statName);

    if (!existing) {

        db.prepare(`
            INSERT INTO user_stats
            (user_id, stat_name, stat_value)
            VALUES (?, ?, ?)
        `).run(userId, statName, amount);

        return amount;
    }

    const newValue = existing.stat_value + amount;

    db.prepare(`
        UPDATE user_stats
        SET stat_value = ?
        WHERE user_id = ?
        AND stat_name = ?
    `).run(newValue, userId, statName);

    return newValue;
}

function getStat(userId, statName) {

    const stat = db.prepare(`
        SELECT stat_value
        FROM user_stats
        WHERE user_id = ?
        AND stat_name = ?
    `).get(userId, statName);

    return stat ? stat.stat_value : 0;
}

function getAllStats(userId) {

    return db.prepare(`
        SELECT *
        FROM user_stats
        WHERE user_id = ?
    `).all(userId);
}

module.exports = {

    incrementStat,

    getStat,

    getAllStats

};