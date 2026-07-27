module.exports = {

    // Cooldowns (seconds)
    COOLDOWN: 7200,              // 2 hours between attempts
    ARRESTED_COOLDOWN: 14400,    // 4 hours if caught
    DEFENDED_COOLDOWN: 7200,     // same as standard — no extra penalty beyond losing the bet

    // Bet (robber's own money put at risk — lost on Defend/Arrest, kept on
    // Escape, untouched on a win since loot comes from the victim instead)
    MIN_BET: 100,
    MAX_BET: 50000,

    // Eligibility
    MIN_VICTIM_CASH: 1000,       // victim must have at least this much to be worth robbing
    MIN_ROBBER_REP: 0,

    // Loot (stolen from the victim's balance on a successful robbery)
    STEAL_PERCENTAGE_MIN: 0.05,  // 5%
    STEAL_PERCENTAGE_MAX: 0.15,  // 15%
    MAX_STEAL_CAP: 50000,
    MIN_STEAL: 100,

    // Timing (seconds unless noted)
    SCAN_DURATION: 3,
    DECISION_TIMEOUT: 10,        // victim's window to respond in DMs
    PROCEED_TIMEOUT: 20,         // robber's window to hit Proceed/Cancel
    EXECUTION_WAIT: 6,           // suspense delay before resolving

    // Odds
    BASE_SUCCESS_CHANCE: 0.50,
    VICTIM_DEFENSE_BONUS: 0.15,  // success chance reduction if victim Defends
    LOOK_AROUND_PENALTY: 0.08,   // success chance reduction if victim Looks Around
    RUN_ESCAPE_CHANCE: 0.35,     // chance a Run attempt immediately ends the robbery
    ARREST_CHANCE: 0.05,
    TREASURE_CHANCE: 0.01,       // rare "hidden cash" outcome on a success roll
    WALLET_EMPTY_CHANCE: 0.03,   // rare "victim's wallet was nearly empty" outcome on a success roll
    PERFECT_CHANCE: 0.5,         // of a normal success, the odds it's a "perfect" (undetected, no heat) robbery
    WITNESS_CHANCE: 0.10,        // chance a bystander notices at all
    WITNESS_PENALTY: 0.10,       // success chance reduction if witnessed
    WITNESS_REPORT_CHANCE: 0.30, // of a witness event, the odds they report it (forces an arrest)

    // Reputation bonus tiers — same table applies to both the robber's
    // success bonus and the victim's defensive bonus, using kingdom_rep.
    REPUTATION_TIERS: [
        { min: 1000, bonus: 0.12 },
        { min: 500, bonus: 0.08 },
        { min: 250, bonus: 0.05 },
        { min: 100, bonus: 0.02 },
        { min: 0, bonus: 0 }
    ],

    // Heat system — repeated robbing lowers your own odds. Decays by one
    // level every HEAT_RESET_TIME seconds of no new robbery attempts.
    HEAT_RESET_TIME: 604800,     // 7 days
    HEAT_TIERS: [
        { min: 11, penalty: 0.20 },
        { min: 6, penalty: 0.10 },
        { min: 3, penalty: 0.05 },
        { min: 0, penalty: 0 }
    ],

    // Hot streak — consecutive successful robberies raise your odds.
    // Any non-success outcome resets the streak to 0.
    STREAK_TIERS: [
        { min: 10, bonus: 0.20 },
        { min: 5, bonus: 0.10 },
        { min: 3, bonus: 0.05 },
        { min: 2, bonus: 0.02 },
        { min: 0, bonus: 0 }
    ],

    // Fines
    ARREST_FINE_BASE: 10000,
    ARREST_FINE_PER_HEAT: 2000,
    VICTIM_DEFEND_RECOVERY: 0.50 // fraction of the robber's bet the victim recovers on a successful Defend
};
