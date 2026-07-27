// In-memory lock so a player can't be robbed by two people at once, and
// can't start a second robbery while one is already resolving. Cleared
// when a robbery finishes, is cancelled, or errors out — always via
// unlock() in a finally block from the command itself.
const locked = new Set();

function lock(userId) {
    locked.add(userId);
}

function unlock(userId) {
    locked.delete(userId);
}

function isLocked(userId) {
    return locked.has(userId);
}


// "██████░░░░ (62%)" style progress bar
function progressBar(percent, length = 10) {

    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;

    return "█".repeat(filled) + "░".repeat(empty) + ` (${percent}%)`;

}


// Rough risk label shown during the scan phase, purely descriptive — the
// real outcome uses the full weighted calculation, not this label.
function riskLabel(successChance) {

    if (successChance >= 0.60) return "🟢 Low";
    if (successChance >= 0.40) return "🟡 Medium";
    return "🔴 High";

}


module.exports = {

    lock,
    unlock,
    isLocked,
    progressBar,
    riskLabel

};
