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
//   { error: string, name: string, untilUnix?: number }
//   { success: true, name, emoji, outcome, coins, xp, cooldownUntilUnix, npcLine, leveledUp, newLevel }
//
// `name` is ALWAYS present on the result, in every branch, specifically
// so command files never need to call getActivity(activityId) a second
// time to render an embed title — that redundant second lookup is
// exactly what crashed /hunt: activityId had no matching config, so
// executeActivity() correctly returned an error, but the command file's
// own separate getActivity() call for the error embed's title returned
// null a second time, and nothing guarded against that. Baking `name`
// into every result here means there's only ever ONE lookup, and it's
// the one that's already null-checked.
function executeActivity(userId, username, activityId) {

    const config = activities[activityId];

    // No matching config at all — the one case where there's truly no
    // real name to show. Falls back to a readable label built from the
    // ID itself rather than a broken embed.
    if (!config) return { error: "Activity not found.", name: "Unknown Activity" };

    if (!config.enabled) return { error: "This activity is currently disabled.", name: config.name };

    const cooldown = checkCooldown(userId, activityId);

    if (cooldown.onCooldown) {

        return {
            error: `${config.cooldownEmoji || "⏳"} ${config.cooldownMessage} (${cooldown.remaining}s remaining)`,
            name: config.name,
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
        name: config.name,
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


// === STARTUP VALIDATION ===
//
// Checks every activity in the registry for the class of misconfiguration
// that caused the original /hunt crash (a missing entry) and several
// related ones that would corrupt data or crash silently rather than
// loudly: an empty outcomes array (confirmed via direct testing to crash
// with the exact same "Cannot read properties of undefined" shape as the
// original bug), a malformed reward range that would hand out NaN coins/
// XP, or outcome chances that don't actually sum to 1 (meaning some rolls
// silently fall through to the last outcome more often than the config
// intends). Called once from bot.js at startup — see that file. Throws
// with every problem found (not just the first) so a broken config fails
// loudly at deploy time instead of silently corrupting a player's
// balance or crashing their command at 2am.
function validateActivities() {

    const problems = [];

    for (const [key, config] of Object.entries(activities)) {

        const prefix = `Activity "${key}"`;

        if (config.id !== key) {
            problems.push(`${prefix}: id ("${config.id}") does not match its registry key ("${key}").`);
        }

        if (!config.name || typeof config.name !== "string") {
            problems.push(`${prefix}: missing or invalid "name".`);
        }

        if (!config.emoji || typeof config.emoji !== "string") {
            problems.push(`${prefix}: missing or invalid "emoji".`);
        }

        if (!config.cooldown || typeof config.cooldown.min !== "number" || typeof config.cooldown.max !== "number") {
            problems.push(`${prefix}: missing or invalid "cooldown" (needs numeric min/max).`);
        } else if (config.cooldown.min <= 0 || config.cooldown.max < config.cooldown.min) {
            problems.push(`${prefix}: "cooldown" range is invalid (min must be > 0 and <= max).`);
        }

        if (!Array.isArray(config.outcomes) || config.outcomes.length === 0) {

            problems.push(`${prefix}: "outcomes" must be a non-empty array.`);

        } else {

            let chanceSum = 0;

            config.outcomes.forEach((outcome, i) => {

                const outcomePrefix = `${prefix}, outcome #${i + 1}`;

                if (typeof outcome.chance !== "number" || outcome.chance < 0 || outcome.chance > 1) {
                    problems.push(`${outcomePrefix}: "chance" must be a number between 0 and 1.`);
                } else {
                    chanceSum += outcome.chance;
                }

                if (!outcome.text || typeof outcome.text !== "string") {
                    problems.push(`${outcomePrefix}: missing or invalid "text".`);
                }

                for (const field of ["coins", "xp"]) {

                    const range = outcome[field];

                    if (!range || typeof range.min !== "number" || typeof range.max !== "number") {
                        problems.push(`${outcomePrefix}: missing or invalid "${field}" range (needs numeric min/max).`);
                    } else if (range.min < 0 || range.max < range.min) {
                        problems.push(`${outcomePrefix}: "${field}" range is invalid (min must be >= 0 and <= max).`);
                    }

                }

            });

            if (Math.abs(chanceSum - 1) > 0.001) {
                problems.push(`${prefix}: outcome chances sum to ${chanceSum.toFixed(4)}, expected 1.0.`);
            }

        }

        if (config.npcLines && !Array.isArray(config.npcLines)) {
            problems.push(`${prefix}: "npcLines" must be an array if present.`);
        }

    }

    if (problems.length > 0) {

        throw new Error(
            `Activity configuration validation failed with ${problems.length} problem(s):\n` +
            problems.map(p => `  - ${p}`).join("\n")
        );

    }

    return { valid: true, activitiesChecked: Object.keys(activities).length };

}


module.exports = {
    checkCooldown,
    startCooldown,
    clearCooldown,
    executeActivity,
    getAllActivities,
    getActivity,
    validateActivities
};
