// Numerology — The Chaos Engine. Tunable behavior lives here, following
// this codebase's existing config/ (tunable settings) vs data/ (content
// like dialogue/messages) split — the original design doc suggested
// putting this in data/, but every other "how does the game behave"
// file in this project (gameConfig.js, dailyConfig.js) lives in config/,
// so this does too for consistency.
module.exports = {

    // The one channel this whole system watches. Messages everywhere
    // else are completely unaffected.
    CHANNEL_ID: "1526621924141301820",

    MODES: {
        classic: { label: "🔢 Classic (+1)", formula: "increment" },
        fibonacci: { label: "🌀 Fibonacci-style (current + previous)", formula: "fibonacci" },
        multiply: { label: "✖️ Multiply", formula: "multiply" },
        custom: { label: "🛠️ Custom Formula", formula: "custom" }
    },

    // Multiply mode's step, and custom mode's available operations —
    // extend this object to add new formulas without touching
    // numerologyRules.js's dispatch logic itself.
    MULTIPLY_STEP: 2,

    CUSTOM_FORMULAS: {
        add_previous: { label: "Current + Previous", op: "add_previous" },
        multiply_3: { label: "Current × 3", op: "multiply", arg: 3 },
        subtract_2: { label: "Current - 2", op: "subtract", arg: 2 },
        add_5: { label: "Current + 5", op: "add", arg: 5 }
    },

    // "Random" hardcore mode: picks a new formula from this pool every
    // N correct counts.
    RANDOM_FORMULA_POOL: ["increment", "multiply", "add_previous", "add_5"],
    RANDOM_FORMULA_SWITCH_EVERY: 10,

    // ─── Reaction feedback (correct answers) ────────────────────────
    REACTION_RARITY: [
        { tier: "common", chance: 0.60 },
        { tier: "rare", chance: 0.30 },
        { tier: "legendary", chance: 0.08 },
        { tier: "divine", chance: 0.02 }
    ],
    // How many reactions to drop on a single message — randomized so it
    // never feels mechanical.
    REACTION_COUNT_WEIGHTS: [
        { count: 1, chance: 0.55 },
        { count: 2, chance: 0.30 },
        { count: 3, chance: 0.15 }
    ],

    // ─── Public chaos-incident announcements on a mistake ───────────
    PUBLIC_FAILURE_CHANCE: 0.10,

    // ─── Anti-spam escalation (mistakes within a rolling window) ────
    ANTI_SPAM: {
        WINDOW_MS: 60 * 1000,           // the "1-5+" tier window
        LONG_WINDOW_MS: 5 * 60 * 1000,  // the "10+ in 5 min" tier window
        WARNING_THRESHOLD: 4,           // 4th mistake in WINDOW_MS -> warning DM + short cooldown
        WARNING_COOLDOWN_MS: 10 * 1000,
        LOCKOUT_THRESHOLD: 5,           // 5th+ mistake in WINDOW_MS -> longer cooldown
        LOCKOUT_COOLDOWN_MS: 60 * 1000,
        ABUSE_THRESHOLD: 10,            // 10+ mistakes in LONG_WINDOW_MS -> mod-log + long cooldown
        ABUSE_COOLDOWN_MS: 5 * 60 * 1000
    },

    // ─── Milestones ──────────────────────────────────────────────────
    MILESTONES: [100, 250, 500, 1000, 5000, 10000],

    // Numbers that trigger a rare Tree of Life appearance regardless of
    // whether they happen to also be a milestone.
    DIVINE_NUMBERS: [777, 999],

    // ─── Chaos events ────────────────────────────────────────────────
    CHAOS_EVENT_CHANCE_MIN: 0.02,
    CHAOS_EVENT_CHANCE_MAX: 0.05,

    // ─── Lore integration ───────────────────────────────────────────
    LORE_ENTRY_EVERY: 1000, // an archive entry every N total correct counts

    // ─── XP / coin rewards ───────────────────────────────────────────
    REWARD_PER_CORRECT_XP: 1,
    REWARD_PER_CORRECT_COINS: 2,
    MILESTONE_BONUS_XP: 50,
    CURSE_MULTIPLIER: 2, // "Counter's Curse" chaos event
    DIVINE_XP_MULTIPLIER: 3,
    DIVINE_WINDOW_COUNTS: 10

};
