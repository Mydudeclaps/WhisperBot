const db = require("../database/database");


function ensureRow(userId) {

    db.prepare(`
        INSERT OR IGNORE INTO casino_stats (user_id)
        VALUES (?)
    `).run(userId);

}


// `game` is "dice" or "blackjack". `wagered` is the bet amount.
// `netChange` is positive for a win (profit), negative for a loss, 0 for a
// push. `won` controls the per-game win counter.
function recordBet(userId, game, wagered, netChange, won) {

    ensureRow(userId);

    const gameGamesCol = `${game}_games`;
    const gameWinsCol = `${game}_wins`;

    const wonAmount = netChange > 0 ? netChange : 0;
    const lostAmount = netChange < 0 ? Math.abs(netChange) : 0;

    db.prepare(`
        UPDATE casino_stats
        SET
            total_bets = total_bets + 1,
            total_wagered = total_wagered + ?,
            total_won = total_won + ?,
            total_lost = total_lost + ?,
            biggest_win = MAX(biggest_win, ?),
            biggest_loss = MAX(biggest_loss, ?),
            ${gameGamesCol} = ${gameGamesCol} + 1,
            ${gameWinsCol} = ${gameWinsCol} + ?
        WHERE user_id = ?
    `).run(
        wagered,
        wonAmount,
        lostAmount,
        wonAmount,
        lostAmount,
        won ? 1 : 0,
        userId
    );

}


function getStats(userId) {

    ensureRow(userId);

    return db.prepare(
        "SELECT * FROM casino_stats WHERE user_id = ?"
    ).get(userId);

}


// Top players ranked by net profit (total_won - total_lost). Only includes
// players who have actually placed a bet.
function getLeaderboard(limit = 10) {

    return db.prepare(`
        SELECT
            cs.*,
            u.username,
            (cs.total_won - cs.total_lost) AS net
        FROM casino_stats cs
        LEFT JOIN users u
            ON u.id = cs.user_id
        WHERE cs.total_bets > 0
        ORDER BY net DESC
        LIMIT ?
    `).all(limit);

}


module.exports = {

    recordBet,
    getStats,
    getLeaderboard

};
