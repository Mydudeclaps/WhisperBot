const db = require("../../database/database");

// Per-command usage is stored as a JSON blob (command_usage), so those
// leaderboards read it via SQLite's json_extract() rather than a plain
// column. Every query is shaped the same: user_id + a "value" to rank by.
function commandUsageQuery(command) {

    return `
        SELECT user_id, CAST(json_extract(command_usage, '$.${command}') AS INTEGER) AS value
        FROM social_stats
        WHERE json_extract(command_usage, '$.${command}') > 0
        ORDER BY value DESC
        LIMIT ?
    `;

}

function rarityCountQuery(rarity) {

    return `
        SELECT user_id, CAST(json_extract(rarity_counts, '$.${rarity}') AS INTEGER) AS value
        FROM social_stats
        WHERE json_extract(rarity_counts, '$.${rarity}') > 0
        ORDER BY value DESC
        LIMIT ?
    `;

}

const METRIC_QUERIES = {

    overall: `SELECT user_id, total_interactions AS value FROM social_stats WHERE total_interactions > 0 ORDER BY value DESC LIMIT ?`,
    combos: `SELECT user_id, highest_combo AS value FROM social_stats WHERE highest_combo > 0 ORDER BY value DESC LIMIT ?`,
    npc: `SELECT user_id, npc_interactions AS value FROM social_stats WHERE npc_interactions > 0 ORDER BY value DESC LIMIT ?`,
    plottwists: `SELECT user_id, plot_twists_witnessed AS value FROM social_stats WHERE plot_twists_witnessed > 0 ORDER BY value DESC LIMIT ?`,

    divine: rarityCountQuery("divine"),
    legendary: rarityCountQuery("legendary"),

    hug: commandUsageQuery("hug"),
    slap: commandUsageQuery("slap"),
    fight: commandUsageQuery("fight"),
    yeet: commandUsageQuery("yeet")

};


function getLeaderboard(metric, limit = 10) {

    const query = METRIC_QUERIES[metric];

    if (!query) return [];

    return db.prepare(query).all(limit);

}


module.exports = {

    getLeaderboard,
    METRICS: Object.keys(METRIC_QUERIES)

};
