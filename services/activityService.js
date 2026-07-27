// Side activities (/mine, /chop, /dig, /farm, /build, /nether, /end) —
// run-anytime, no-objective commands with random rewards, as opposed to
// quests (start/track/complete an objective via questService.js).
//
// Reuses coinService.addCoins / xpService.addXP instead of writing coins
// and XP directly, so activities correctly trigger level-ups the same
// way every other coin/XP source in the bot does.
const db = require("../database/database");
const activities = require("../data/activities");
const { addCoins } = require("./coinService");
const { addXP } = require("./xpService");


// === COOLDOWN MANAGEMENT (persistent — see database/database.js) ===

function checkCooldown(userId, activityId) {

    const row = db.prepare(`
        SELECT cooldown_until FROM activity_cooldowns
        WHERE user_id = ? AND activity = ?
    `).get(userId, activityId);

    if (row && row.cooldown_until > Date.now()) {

        return {
            onCooldown: true,
            remaining: Math.ceil((row.cooldown_until - Date.now()) / 1000),
            untilUnix: Math.ceil(row.cooldown_until / 1000)
        };

    }

    return { onCooldown: false, remaining: 0, untilUnix: null };

}


function getRandomCooldownMs(config) {

    const { min, max } = config.cooldown;
    return Math.floor(Math.random() * (max - min + 1)) + min;

}


function startCooldown(userId, activityId) {

    const config = activities[activityId];
    if (!config) return null;

    const duration = getRandomCooldownMs(config);
    const cooldownUntil = Date.now() + duration;

    db.prepare(`
        INSERT INTO activity_cooldowns (user_id, activity, cooldown_until)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, activity)
        DO UPDATE SET cooldown_until = excluded.cooldown_until
    `).run(userId, activityId, cooldownUntil);

    return { durationMs: duration, untilUnix: Math.ceil(cooldownUntil / 1000) };

}


function clearCooldown(userId, activityId) {

    db.prepare(`
        DELETE FROM activity_cooldowns
        WHERE user_id = ? AND activity = ?
    `).run(userId, activityId);

}


// === OUTCOME ROLLING ===

function getWeightedOutcome(outcomes) {

    const roll = Math.random();
    let cumulative = 0;

    for (const outcome of outcomes) {

        cumulative += outcome.chance;
        if (roll < cumulative) return outcome;

    }

    return outcomes[outcomes.length - 1];

}


function randomBetween(min, max) {

    return Math.floor(Math.random() * (max - min + 1)) + min;

}


// === HISTORY ===

function recordHistory(userId, activityId, coins, xp) {

    db.prepare(`
        INSERT INTO activity_history (user_id, activity, reward_coins, reward_xp, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId, activityId, coins, xp, new Date().toISOString());

}


// === MAIN ENTRY POINT ===

// Returns one of:
//   { error: string }
//   { success: true, outcome, coins, xp, cooldownUntilUnix, npcLine, emoji, leveledUp, newLevel }
function executeActivity(userId, username, activityId) {

    const config = activities[activityId];

    if (!config) return { error: "Activity not found." };
    if (!config.enabled) return { error: "This activity is currently disabled." };

    const cooldown = checkCooldown(userId, activityId);

    if (cooldown.onCooldown) {

        return {
            error: `${config.cooldownEmoji || "⏳"} ${config.cooldownMessage} (${cooldown.remaining}s remaining)`,
            untilUnix: cooldown.untilUnix
        };

    }

    const outcome = getWeightedOutcome(config.outcomes);

    const coins = randomBetween(outcome.coins.min, outcome.coins.max);
    const xp = randomBetween(outcome.xp.min, outcome.xp.max);

    addCoins(userId, username, coins);
    const xpResult = addXP(userId, xp);

    const cooldownResult = startCooldown(userId, activityId);

    recordHistory(userId, activityId, coins, xp);

    // 10% chance of a flavor NPC line, same convention as the casino's
    // NPC dialogue system (presentation only).
    const npcLine = config.npcLines && config.npcLines.length && Math.random() < 0.10
        ? config.npcLines[Math.floor(Math.random() * config.npcLines.length)]
        : null;

    return {
        success: true,
        outcome,
        coins,
        xp,
        cooldownUntilUnix: cooldownResult.untilUnix,
        npcLine,
        emoji: outcome.emoji || config.emoji,
        leveledUp: !!(xpResult && xpResult.leveledUp),
        newLevel: xpResult ? xpResult.newLevel : null
    };

}


function getAllActivities() {

    return Object.keys(activities)
        .filter(key => activities[key].enabled)
        .map(key => ({ id: key, ...activities[key] }));

}


function getActivity(activityId) {

    return activities[activityId] || null;

}


module.exports = {
    checkCooldown,
    startCooldown,
    clearCooldown,
    executeActivity,
    getAllActivities,
    getActivity
};
