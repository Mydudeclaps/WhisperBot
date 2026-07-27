// Stats and leaderboards for Numerology.
const db = require("../database/database");

function getGameStats(gameId) {

    const totals = db.prepare(`
        SELECT
            COUNT(*) AS total_attempts,
            SUM(is_correct) AS total_correct
        FROM numerology_contributions
        WHERE game_id = ?
    `).get(gameId);

    const topCounters = db.prepare(`
        SELECT user_id, SUM(is_correct) AS correct_count
        FROM numerology_contributions
        WHERE game_id = ? AND is_correct = 1
        GROUP BY user_id
        ORDER BY correct_count DESC
        LIMIT 5
    `).all(gameId);

    const mostMistakes = db.prepare(`
        SELECT user_id, COUNT(*) AS mistake_count
        FROM numerology_contributions
        WHERE game_id = ? AND is_correct = 0
        GROUP BY user_id
        ORDER BY mistake_count DESC
        LIMIT 1
    `).get(gameId);

    const chaosCount = db.prepare(`
        SELECT COUNT(*) AS count FROM numerology_chaos_events WHERE game_id = ?
    `).get(gameId);

    return {
        totalAttempts: totals.total_attempts || 0,
        totalCorrect: totals.total_correct || 0,
        successRate: totals.total_attempts ? (totals.total_correct / totals.total_attempts) : 0,
        topCounters,
        mostMistakes,
        chaosEventCount: chaosCount.count
    };

}

function getContributorTotals(gameId) {

    return db.prepare(`
        SELECT user_id, SUM(is_correct) AS contributions
        FROM numerology_contributions
        WHERE game_id = ? AND is_correct = 1
        GROUP BY user_id
        ORDER BY contributions DESC
    `).all(gameId);

}

function getGlobalLeaderboard(limit = 10) {

    return db.prepare(`
        SELECT user_id, total_correct, longest_streak, highest_count_achieved
        FROM numerology_stats
        ORDER BY highest_count_achieved DESC
        LIMIT ?
    `).all(limit);

}

function getUserStats(userId) {

    return db.prepare(`SELECT * FROM numerology_stats WHERE user_id = ?`).get(userId);

}

function incrementChaosWitnessCount(userId) {

    db.prepare(`
        INSERT OR IGNORE INTO numerology_stats (user_id) VALUES (?)
    `).run(userId);

    db.prepare(`
        UPDATE numerology_stats SET chaos_events_witnessed = chaos_events_witnessed + 1 WHERE user_id = ?
    `).run(userId);

}

function incrementMilestoneCount(userId) {

    db.prepare(`
        UPDATE numerology_stats SET milestones_reached = milestones_reached + 1 WHERE user_id = ?
    `).run(userId);

}

module.exports = {
    getGameStats,
    getContributorTotals,
    getGlobalLeaderboard,
    getUserStats,
    incrementChaosWitnessCount,
    incrementMilestoneCount
};
