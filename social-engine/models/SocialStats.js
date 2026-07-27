const db = require("../../database/database");


function ensureRow(userId) {

    db.prepare(`
        INSERT OR IGNORE INTO social_stats (user_id, updated_at)
        VALUES (?, ?)
    `).run(userId, new Date().toISOString());

}


// Returns the user's stats with JSON columns parsed back into objects/
// arrays, so callers never touch raw TEXT.
function getStats(userId) {

    ensureRow(userId);

    const row = db.prepare(
        "SELECT * FROM social_stats WHERE user_id = ?"
    ).get(userId);

    return {

        userId: row.user_id,
        totalInteractions: row.total_interactions,
        commandUsage: JSON.parse(row.command_usage || "{}"),
        interactionCounts: JSON.parse(row.interaction_counts || "{}"),
        combosTriggered: row.combos_triggered,
        highestCombo: row.highest_combo,
        rarityCounts: JSON.parse(row.rarity_counts || "{}"),
        npcInteractions: row.npc_interactions,
        plotTwistsWitnessed: row.plot_twists_witnessed,
        achievementsUnlocked: JSON.parse(row.achievements_unlocked || "[]"),
        titlesUnlocked: JSON.parse(row.titles_unlocked || "[]"),
        activeTitle: row.active_title,
        favoriteCommand: row.favorite_command,
        mostInteractedWith: row.most_interacted_with

    };

}


// Resets a user's social stats row back to defaults (admin use). Deletes
// the row rather than zeroing columns in place — ensureRow/getStats will
// recreate it with fresh defaults on next read.
function resetStats(userId) {

    db.prepare(`
        DELETE FROM social_stats WHERE user_id = ?
    `).run(userId);

    return getStats(userId);

}


// Records one completed interaction and returns the freshly-updated
// stats object (so the caller — AchievementTracker — can evaluate
// thresholds against up-to-date numbers without a second read).
function recordInteraction(userId, { command, targetId, rarity, combo, npcTriggered, plotTwist }) {

    const stats = getStats(userId);

    stats.totalInteractions += 1;

    stats.commandUsage[command] = (stats.commandUsage[command] || 0) + 1;

    if (targetId) {
        stats.interactionCounts[targetId] = (stats.interactionCounts[targetId] || 0) + 1;
    }

    stats.rarityCounts[rarity] = (stats.rarityCounts[rarity] || 0) + 1;

    if (combo > 1) {
        stats.combosTriggered += 1;
    }

    if (combo > stats.highestCombo) {
        stats.highestCombo = combo;
    }

    if (npcTriggered) stats.npcInteractions += 1;
    if (plotTwist) stats.plotTwistsWitnessed += 1;

    // Favorite command = most-used command overall.
    stats.favoriteCommand = Object.entries(stats.commandUsage)
        .sort((a, b) => b[1] - a[1])[0][0];

    // Most-interacted-with = target seen the most across all commands.
    const targetEntries = Object.entries(stats.interactionCounts);

    stats.mostInteractedWith = targetEntries.length
        ? targetEntries.sort((a, b) => b[1] - a[1])[0][0]
        : stats.mostInteractedWith;

    db.prepare(`
        UPDATE social_stats
        SET
            total_interactions = ?,
            command_usage = ?,
            interaction_counts = ?,
            combos_triggered = ?,
            highest_combo = ?,
            rarity_counts = ?,
            npc_interactions = ?,
            plot_twists_witnessed = ?,
            favorite_command = ?,
            most_interacted_with = ?,
            updated_at = ?
        WHERE user_id = ?
    `).run(
        stats.totalInteractions,
        JSON.stringify(stats.commandUsage),
        JSON.stringify(stats.interactionCounts),
        stats.combosTriggered,
        stats.highestCombo,
        JSON.stringify(stats.rarityCounts),
        stats.npcInteractions,
        stats.plotTwistsWitnessed,
        stats.favoriteCommand,
        stats.mostInteractedWith,
        new Date().toISOString(),
        userId
    );

    return stats;

}


// Adds an achievement (and its title reward, if any) to the user's
// unlocked lists. No-ops if already unlocked. Returns true if this call
// actually unlocked something new.
function unlockAchievement(userId, achievementId, title) {

    const stats = getStats(userId);

    if (stats.achievementsUnlocked.includes(achievementId)) {
        return false;
    }

    stats.achievementsUnlocked.push(achievementId);

    if (title && !stats.titlesUnlocked.includes(title)) {
        stats.titlesUnlocked.push(title);
    }

    db.prepare(`
        UPDATE social_stats
        SET achievements_unlocked = ?, titles_unlocked = ?, updated_at = ?
        WHERE user_id = ?
    `).run(
        JSON.stringify(stats.achievementsUnlocked),
        JSON.stringify(stats.titlesUnlocked),
        new Date().toISOString(),
        userId
    );

    return true;

}


module.exports = {

    getStats,
    recordInteraction,
    unlockAchievement,
    resetStats

};
