module.exports = {

    // How often a player can check in.
    COOLDOWN_HOURS: 24,

    // Base rewards for a normal check-in (before any streak bonus).
    BASE_COINS: 1000,
    BASE_XP: 100,
    BASE_REP: 2,

    // Every Nth consecutive day, rewards for that check-in are multiplied.
    // e.g. interval 5 + multiplier 2 means day 5, 10, 15, 20... all pay 2x.
    STREAK_BONUS_INTERVAL: 5,
    STREAK_BONUS_MULTIPLIER: 2,

    // How many hours late a player can check in and still keep their streak
    // going (rather than resetting to day 1). 0 = must check in within
    // exactly COOLDOWN_HOURS of the last check-in.
    GRACE_PERIOD_HOURS: 0

};
