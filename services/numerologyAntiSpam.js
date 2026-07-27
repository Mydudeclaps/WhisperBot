// Anti-spam escalation. Deliberately DB-backed (numerology_mistakes
// table) rather than an in-memory Map — see the comment on that table
// in database/database.js for why. Distinguishes honest mistakes from
// abuse purely by RATE (mistakes per time window), never by content —
// there's no way to tell a genuine typo from deliberate spam except how
// often it happens, so that's the only signal this uses.
const db = require("../database/database");
const { ANTI_SPAM } = require("../config/numerologyConfig");

const cooldownUntilByUser = new Map(); // ephemeral is fine here — worst
// case on a bot restart mid-cooldown is someone gets to count slightly
// early, not a security issue like a casino cooldown bypass would be.

function recentMistakeCount(userId, windowMs) {

    const cutoff = Date.now() - windowMs;

    const row = db.prepare(`
        SELECT COUNT(*) AS count FROM numerology_mistakes
        WHERE user_id = ? AND occurred_at >= ?
    `).get(userId, cutoff);

    return row.count;

}

function isOnCooldown(userId) {

    const until = cooldownUntilByUser.get(userId);
    if (!until) return { onCooldown: false };

    if (Date.now() >= until) {
        cooldownUntilByUser.delete(userId);
        return { onCooldown: false };
    }

    return { onCooldown: true, remainingMs: until - Date.now() };

}

// Call AFTER numerologyService.attemptCount() has already logged the
// mistake. Returns:
//   { tier: "none" }
//   { tier: "warning", cooldownMs }
//   { tier: "lockout", cooldownMs }
//   { tier: "abuse", cooldownMs, shouldLogToMod: true }
function evaluateMistake(userId) {

    const shortWindowCount = recentMistakeCount(userId, ANTI_SPAM.WINDOW_MS);
    const longWindowCount = recentMistakeCount(userId, ANTI_SPAM.LONG_WINDOW_MS);

    if (longWindowCount >= ANTI_SPAM.ABUSE_THRESHOLD) {

        cooldownUntilByUser.set(userId, Date.now() + ANTI_SPAM.ABUSE_COOLDOWN_MS);
        return { tier: "abuse", cooldownMs: ANTI_SPAM.ABUSE_COOLDOWN_MS, shouldLogToMod: true, count: longWindowCount };

    }

    if (shortWindowCount >= ANTI_SPAM.LOCKOUT_THRESHOLD) {

        cooldownUntilByUser.set(userId, Date.now() + ANTI_SPAM.LOCKOUT_COOLDOWN_MS);
        return { tier: "lockout", cooldownMs: ANTI_SPAM.LOCKOUT_COOLDOWN_MS, count: shortWindowCount };

    }

    if (shortWindowCount >= ANTI_SPAM.WARNING_THRESHOLD) {

        cooldownUntilByUser.set(userId, Date.now() + ANTI_SPAM.WARNING_COOLDOWN_MS);
        return { tier: "warning", cooldownMs: ANTI_SPAM.WARNING_COOLDOWN_MS, count: shortWindowCount };

    }

    return { tier: "none", count: shortWindowCount };

}

// Sweeps mistake rows older than the longest window this system checks
// — nothing needs them after that. Harmless either way (checks already
// filter by timestamp), just keeps the table small.
function cleanupOldMistakes() {

    const cutoff = Date.now() - ANTI_SPAM.LONG_WINDOW_MS;
    const result = db.prepare(`DELETE FROM numerology_mistakes WHERE occurred_at < ?`).run(cutoff);
    return result.changes;

}

module.exports = {
    isOnCooldown,
    evaluateMistake,
    cleanupOldMistakes
};
