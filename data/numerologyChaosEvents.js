// Chaos Event definitions — the "secret sauce" of Numerology. Each entry
// is applied by services/numerologyChaos.js, which is the only place
// that actually mutates game state in response to one of these; this
// file is content (flavor text + tuning), not logic.
module.exports = {

    count_shifts: {
        id: "count_shifts",
        name: "The Count Shifts",
        emoji: "🌪️",
        publicText: (from, to) => `🌪️ **THE COUNT SHIFTS**\nThe number lurches forward — ${from} becomes **${to}**. Everyone's next guess just got harder.`,
        loreText: (day, from, to) => `The Count Shifted on day ${day}. Number ${from} became ${to}. The numbers were restless. The archives remember.`
    },

    ghost_number: {
        id: "ghost_number",
        name: "The Ghost Number",
        emoji: "👻",
        publicText: (ghost) => `👻 **A GHOST NUMBER APPEARS...**\n*A number drifts through the channel: **${ghost}**. Is it real? Ignore it, or dare to count it...*`,
        loreText: (day, ghost) => `A ghost number — ${ghost} — drifted through the channel on day ${day}. Those who counted it were never seen the same way again.`
    },

    count_warps: {
        id: "count_warps",
        name: "The Count Warps",
        emoji: "🔀",
        publicText: (formulaLabel, moves) => `🔀 **THE COUNT WARPS**\nReality bends. For the next **${moves}** counts, the formula shifts to *${formulaLabel}*.`,
        loreText: (day, formulaLabel) => `On day ${day}, the Count Warped. For a time, the numbers followed a different truth: ${formulaLabel}.`
    },

    counters_curse: {
        id: "counters_curse",
        name: "The Counter's Curse",
        emoji: "😈",
        publicText: () => `😈 **THE COUNTER'S CURSE**\nThe next number carries double the weight — double reward if you're right, and the numbers will remember if you're wrong.`,
        loreText: (day) => `The Counter's Curse fell upon the channel on day ${day}. Fortune and folly both came in double that day.`
    },

    divine_number: {
        id: "divine_number",
        name: "The Divine Number",
        emoji: "🌟",
        publicText: (windowCount) => `🌟 **THE DIVINE NUMBER**\nA holy light touches the count. The next **${windowCount}** correct counters will earn triple reward.`,
        loreText: (day) => `A Divine Number touched the channel on day ${day}. For a while, every whisper was worth three.`
    },

    count_reset: {
        id: "count_reset",
        name: "The Count Reset",
        emoji: "💥",
        publicText: (oldCount) => `💥 **THE COUNT RESETS**\nEverything the community built — ${oldCount.toLocaleString()} numbers strong — collapses back to the beginning. A new era begins.`,
        loreText: (day, oldCount) => `On day ${day}, the Count Reset. ${oldCount.toLocaleString()} numbers, undone in an instant. The community began again, as it always does.`
    }

};
