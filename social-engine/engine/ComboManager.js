const db = require("../../database/database");

// Combos expire after this many minutes of inactivity between the same
// pair, per the design doc.
const COMBO_WINDOW_MINUTES = 5;
const COMBO_WINDOW_MS = COMBO_WINDOW_MINUTES * 60 * 1000;


// Order-independent key so "A hugs B" and "B hugs A" share one combo.
function getKey(userId, targetId) {
    return [userId, targetId].sort().join(":");
}


function clearCombo(key) {

    db.prepare(
        "DELETE FROM active_combos WHERE user_pair = ?"
    ).run(key);

}


// Returns the CURRENT combo count for this pair (0 if none active or it
// expired), without incrementing anything. Self-interactions (no target,
// or target === user) never combo.
function getCombo(userId, targetId) {

    if (!targetId || targetId === userId) return 0;

    const key = getKey(userId, targetId);

    const row = db.prepare(
        "SELECT * FROM active_combos WHERE user_pair = ?"
    ).get(key);

    if (!row) return 0;

    const age = Date.now() - new Date(row.last_used).getTime();

    if (age > COMBO_WINDOW_MS) {
        clearCombo(key);
        return 0;
    }

    return row.count;

}


// Increments (or starts) the combo for this pair and returns the new
// count. Call this once per completed interaction, after getCombo() has
// already been read for display purposes if needed.
function incrementCombo(userId, targetId, command) {

    if (!targetId || targetId === userId) return 0;

    const key = getKey(userId, targetId);
    const current = getCombo(userId, targetId);
    const newCount = current + 1;

    db.prepare(`
        INSERT INTO active_combos (user_pair, command, count, last_used)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_pair) DO UPDATE SET
            command = excluded.command,
            count = excluded.count,
            last_used = excluded.last_used
    `).run(key, command, newCount, new Date().toISOString());

    return newCount;

}


module.exports = {

    getCombo,
    incrementCombo,
    clearCombo

};
