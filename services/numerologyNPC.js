// NPC dialogue selection for Numerology. Separate from
// casinoNpcService.js — these are the same-named personas (Old Tom,
// Lucy, Frank) but a different persona set/dialogue pool for a
// completely different context, plus Tree of Life, who doesn't exist
// anywhere in the casino system at all.
const { NPC_DIALOGUE } = require("../data/numerologyMessages");

function randomLine(pool) {
    if (!pool || !pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function formatLine(npcKey, line) {
    const npc = NPC_DIALOGUE[npcKey];
    if (!npc || !line) return null;
    return `${npc.emoji} **${npc.name}:** *"${line}"*`;
}

// Milestone appearances: Old Tom always shows up at 100/250/500;
// Old Tom + Lucy both at 1000+.
function getMilestoneAppearance(milestone) {

    const lines = [];

    lines.push(formatLine("old_tom", randomLine(NPC_DIALOGUE.old_tom.milestone)));

    if (milestone >= 1000) {
        lines.push(formatLine("lucy", randomLine(NPC_DIALOGUE.lucy.milestone)));
    }

    return lines.filter(Boolean);

}

// Divine numbers (777/999): 50% chance of a rare Tree of Life line.
function getDivineNumberAppearance() {

    if (Math.random() >= 0.5) return null;
    return formatLine("tree_of_life", randomLine(NPC_DIALOGUE.tree_of_life.rare));

}

// Chaos events: 30% chance of a random NPC's chaos-flavored line.
function getChaosEventAppearance() {

    if (Math.random() >= 0.3) return null;

    const candidates = ["old_tom", "frank"]; // the two personas with chaos-specific dialogue
    const npcKey = candidates[Math.floor(Math.random() * candidates.length)];

    return formatLine(npcKey, randomLine(NPC_DIALOGUE[npcKey].chaos));

}

// Daily check-in flavor: 10% chance of a Lucy line on someone's first
// correct count of a UTC calendar day (tracked by the caller via
// numerology_stats.last_contribution).
function getDailyCheckinAppearance() {

    if (Math.random() >= 0.1) return null;
    return formatLine("lucy", randomLine(NPC_DIALOGUE.lucy.daily));

}

// Streak commentary: Frank comments on notably long personal streaks.
function getStreakAppearance(streak) {

    if (streak < 25 || streak % 25 !== 0) return null; // every 25th streak count, not every single one
    return formatLine("frank", randomLine(NPC_DIALOGUE.frank.streak));

}

// A generic "cheer" line — used at the caller's discretion for a bit of
// unpredictable warmth on an otherwise-ordinary correct count. Not tied
// to any specific trigger table entry; kept low-probability by the
// caller if used at all.
function getCheerLine() {

    return formatLine("lucy", randomLine(NPC_DIALOGUE.lucy.cheer));

}

module.exports = {
    getMilestoneAppearance,
    getDivineNumberAppearance,
    getChaosEventAppearance,
    getDailyCheckinAppearance,
    getStreakAppearance,
    getCheerLine
};
