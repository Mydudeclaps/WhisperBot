module.exports = {

    XP: {

        PER_MESSAGE: 5,

        PER_LEVEL: 1000,

        MAX_LEVEL: 1000

    },

    DAILY: {

        COINS: 500,

        XP: 50,

        STREAK_RESET_HOURS: 48

    },

    LEVEL_REWARDS: {

        COINS_PER_LEVEL: 250

    },

    KINGDOMS: {

        STARTING_REPUTATION: 0

    },

    VOICE: {
        XP: 10,              // XP every 5 minutes
        INTERVAL: 300000,    // 5 minutes in milliseconds
        REQUIRE_OTHERS: true, // Requires someone else in voice
        REQUIRES_UNMUTED: true, // Requires the user to be unmuted
        REQUIRES_UNDEAFENED: true // Requires the user to be undeafened
    },

    FISHING: {
        COOLDOWN_SECONDS: 30,
        CATCH_CHANCE: 0.40,          // 40% chance to catch something at all
        TREASURE_CHANCE: 0.01,       // 1% chance for the treasure chest outcome
        RARE_CHANCE: 0.05            // 5% chance a successful catch is a rare one
    },

    HIGHLOW: {
        MIN_BET: 100,
        MAX_BET: 50000,
        WIN_MULTIPLIER: 2,
        CARD_COUNT: 13,
        DECISION_TIMEOUT: 30000      // 30 seconds to pick HIGH or LOW
    },

    RACEBET: {
        MIN_BET: 100,
        MAX_BET: 50000,
        ACCEPT_TIMEOUT: 300          // 5 minutes in seconds
    },

    DICE: {
        MIN_BET: 100,
        MAX_BET: 50000,
        COOLDOWN: 30,                // seconds
        PAYOUT_OVER: 2,
        PAYOUT_UNDER: 2,
        PAYOUT_EXACT: 5
    },

    BLACKJACK: {
        MIN_BET: 100,
        MAX_BET: 50000,
        COOLDOWN: 60,                // seconds
        PAYOUT_WIN: 2,
        BLACKJACK_PAYOUT: 1.5,       // extra profit multiplier on a natural 21 (paid on top of the returned bet, i.e. 2.5x total)
        DEALER_STAND_ON: 17,
        DECISION_TIMEOUT: 60000      // ms to Hit/Stand before auto-stand
    },

    // Cross-game anti-spam limit: caps total casino bets (any game combined)
    // in a rolling window, independent of each game's own per-game cooldown.
    CASINO_RATE_LIMIT: {
        MAX_BETS: 5,
        WINDOW_SECONDS: 60
    },

    HORSE: {
        MIN_BET: 1000,
        MAX_BET: 500000,
        COOLDOWN: 20,                 // seconds
        RACE_SIZE: 5,                 // horses drawn per race from the roster in data/horses.js
        OWNERSHIP_COST: 25000000,
        OWNER_WIN_BONUS: 0.05,        // +5% win chance for your own horse
        OWNER_PAYOUT_BONUS: 0.10      // +10% payout when your own horse wins
    },

    // Shared "sit down and play" session config, used by roulette, horse,
    // blackjack, dice, highlow, and poker (slots has its own near-identical
    // block above, kept separate since it shipped first).
    CASINO_SESSION: {
        BET_OPTIONS: [250, 500, 1000, 2500, 5000, 10000],
        MIN_BET: 250,
        MAX_BET: 10000,
        MAX_BET_BALANCE_PERCENT: 0.10,
        MAX_PLAYS_PER_SESSION: 5,
        SETUP_TIMEOUT_MS: 60000,
        SESSION_IDLE_TIMEOUT_MS: 120000,
        // Weighted random cooldown after 5 plays — cumulative weights must
        // sum to 1. getRandomCooldown() in services/casinoService.js walks
        // these in order.
        COOLDOWN_TIERS: [
            { weight: 0.30, min: 45,  max: 60,  label: "Quick Reset" },
            { weight: 0.40, min: 120, max: 180, label: "Standard Wait" },
            { weight: 0.20, min: 240, max: 360, label: "Busy Tables" },
            { weight: 0.10, min: 420, max: 600, label: "High Traffic" }
        ]
    },

    SLOTS: {
        BET_OPTIONS: [250, 500, 1000, 2500, 5000, 10000],
        MIN_BET: 250,
        MAX_BET: 10000,
        MAX_BET_BALANCE_PERCENT: 0.10, // effective max is also capped at 10% of balance
        MAX_SPINS_PER_SESSION: 5,
        SESSION_COOLDOWN_SECONDS: 60,  // wait after using up all 5 spins
        SETUP_TIMEOUT_MS: 60000,       // time to pick machine + bet before the prompt expires
        SESSION_IDLE_TIMEOUT_MS: 120000, // ends the session if no button click for this long
        VARIANTS: {
            classic: {
                type: "3_REEL",
                label: "🎰 Classic Slots",
                symbols:  ["🍒", "🍋", "🔔", "💎", "7️⃣", "👑"],
                weights:  [35,   25,   18,   12,   7,    3],
                payouts:  { "🍒": 5, "🍋": 10, "🔔": 20, "💎": 50, "7️⃣": 100, "👑": 250 }
            },
            treasure: {
                type: "3_REEL",
                label: "🏰 Whisper Treasure Slots",
                symbols:  ["🗝️", "💎", "🥚", "⭐", "🏰", "👑"],
                weights:  [35,   25,   18,   12,   7,    3],
                payouts:  { "🗝️": 10, "💎": 25, "🥚": 50, "⭐": 100, "🏰": 200, "👑": 500 }
            },
            kingdom: {
                type: "3_REEL",
                label: "🌎 Kingdom Slots",
                symbols:  ["🏔️", "🏜️", "🌊", "🏰"],
                weights:  [25,   25,   25,   25],
                payouts:  { "🏔️": 50, "🏜️": 50, "🌊": 50, "🏰": 50 },
                twoMatchPayout: 5,      // any 2 matching symbols
                kingdomMatchBonus: 100  // 3 matching AND it's the player's kingdom symbol
            },
            // ─── New in this update — see SLOTS_TIC_MEMORY_CHANGES.md ───
            // 5 reels x 3 rows (15 cells), 3 horizontal paylines. Each
            // line is scored independently: whichever symbol appears the
            // most times within that line (if >= 3) pays out at the
            // fiveMatch/fourMatch/threeMatch tier for that symbol.
            // Payout values are MULTIPLIERS on the bet (same convention
            // as every other variant above), not flat coin amounts —
            // see the balance note in SLOTS_TIC_MEMORY_CHANGES.md before
            // enabling this for real play, some of these are very high.
            fortune5: {
                type: "5_REEL",
                label: "🎰 Fortune Reels",
                reels: 5,
                rows: 3,
                symbols: ["🍒", "💎", "7️⃣", "👑", "🔥", "🍀", "⭐", "🏆", "💰", "🎰"],
                weights: [0.20, 0.15, 0.12, 0.10, 0.10, 0.10, 0.08, 0.07, 0.05, 0.03],
                lines: [
                    [0, 1, 2, 3, 4],       // top row
                    [5, 6, 7, 8, 9],       // middle row
                    [10, 11, 12, 13, 14]   // bottom row
                ],
                payouts: {
                    // Rebalanced from the original spec numbers — see
                    // SLOTS_TIC_MEMORY_CHANGES.md. The spec's values
                    // (fiveMatch 👑:1000 etc.) simulated to a 5.27x
                    // average return (players would win over 5x what they
                    // wager, on average — would drain the economy fast).
                    // These values simulated to 0.578x over 50,000 spins,
                    // in line with Classic Slots' existing 0.633x.
                    fiveMatch:  { "👑": 100, "7️⃣": 50, "💎": 25, "🍒": 10 },
                    fourMatch:  { "👑": 20,  "7️⃣": 10, "💎": 5,  "🍒": 2 },
                    threeMatch: { "👑": 5,   "7️⃣": 2,  "💎": 1,  "🍒": 1 }
                }
            },
            // 3x3 grid (9 cells), 8 paylines (3 horizontal, 3 vertical,
            // 2 diagonal). Each line scored independently: 3-in-a-line
            // pays the `triple` tier, 2-in-a-line (out of that line's 3
            // cells) pays `double`. A single spin can win on multiple
            // lines at once — all winning lines pay out and sum together.
            mega3x3: {
                type: "3x3_GRID",
                label: "🔷 Mega Slots",
                rows: 3,
                cols: 3,
                symbols: ["🍒", "💎", "7️⃣", "👑", "🔥", "🍀", "⭐", "🏆"],
                weights: [0.20, 0.15, 0.12, 0.10, 0.10, 0.10, 0.08, 0.08],
                paylines: [
                    [0, 1, 2], [3, 4, 5], [6, 7, 8],  // horizontal
                    [0, 3, 6], [1, 4, 7], [2, 5, 8],  // vertical
                    [0, 4, 8], [2, 4, 6]              // diagonal
                ],
                payouts: {
                    // Rebalanced from the original spec numbers — see
                    // SLOTS_TIC_MEMORY_CHANGES.md. With 8 overlapping
                    // paylines (the center cell alone is part of 4 of
                    // them), the spec's numbers simulated to a 47.67x
                    // average return — not a balance nitpick, that's an
                    // infinite-money bug. Fix required two changes, not
                    // just smaller numbers: the `double` (2-of-3) tier is
                    // removed entirely — with 8 overlapping lines a
                    // partial match happens constantly, and paying out on
                    // it at all compounds fast — and triple payouts are
                    // cut roughly 30x. Result: 0.609x over 50,000 spins,
                    // in line with Classic Slots' 0.633x.
                    triple: { "👑": 17, "7️⃣": 9, "💎": 4, "🍒": 2 },
                    double: {}
                }
            }
        }
    },

    // ─── Gambling Tic Tac Toe (/tic) ───────────────────────────────────
    TIC_TAC_TOE: {
        HOUSE_BET_OPTIONS: [100, 500, 1000, 5000, 10000],
        HOUSE_PAYOUT_MULTIPLIER: 2,   // win against the house pays 2x bet
        MAX_GAMES_PER_SESSION: 5,
        SESSION_COOLDOWN_SECONDS: 60,
        SETUP_TIMEOUT_MS: 60000,
        SESSION_IDLE_TIMEOUT_MS: 120000,
        // Player challenges (/tic @user amount) — separate range from the
        // house mode dropdown since it's a typed amount, not a select.
        CHALLENGE_MIN_BET: 100,
        CHALLENGE_MAX_BET: 100000,
        CHALLENGE_EXPIRY_MS: 5 * 60 * 1000 // challenge auto-expires after 5 minutes unanswered
    },

    // ─── Memory Vault (/memory) ────────────────────────────────────────
    MEMORY: {
        BET_OPTIONS: [100, 500, 1000, 5000],
        MAX_GAMES_PER_SESSION: 5,
        SESSION_COOLDOWN_SECONDS: 60,
        SETUP_TIMEOUT_MS: 60000,
        SESSION_IDLE_TIMEOUT_MS: 180000, // grids take longer to work through than a hand of cards
        MATCH_BONUS_COINS: 100,          // small flat bonus paid immediately on each successful match
        // NOTE: the spec's medium tier was "5×5 — 12.5 pairs" — a 5x5
        // grid has 25 cells, which is odd and can't form whole pairs
        // (12.5 isn't a real number of pairs). Fixed by keeping the 5x5
        // grid but making the 25th cell a bonus cell instead of part of
        // a pair — it's flagged with hasBonusCell below. Flipping it
        // awards MEMORY.BONUS_CELL_COINS immediately and doesn't count
        // toward pairs found (so 12 real pairs = 24 cells + 1 bonus = 25).
        DIFFICULTIES: {
            easy:   { label: "🟢 Easy (4×4 — 8 pairs)",     size: 4, pairs: 8,  maxAttempts: 16, baseMultiplier: 2,   perfectMultiplier: 3 },
            medium: { label: "🟡 Medium (5×5 — 12 pairs)",  size: 5, pairs: 12, maxAttempts: 20, baseMultiplier: 2.5, perfectMultiplier: 5, hasBonusCell: true },
            hard:   { label: "🔴 Hard (6×6 — 18 pairs)",    size: 6, pairs: 18, maxAttempts: 25, baseMultiplier: 3,   perfectMultiplier: 8 }
        },
        BONUS_CELL_COINS: { min: 200, max: 500 },
        SYMBOLS: ["🐉", "🦅", "🐺", "🦊", "🐢", "🦉", "🐬", "🦁", "🐯", "🦄", "🐸", "🦋", "🐙", "🦂", "🐿️", "🦩", "🦔", "🦚"]
    },

    ROULETTE: {
        MIN_BET: 1000,
        MAX_BET: 250000,
        COOLDOWN: 15,                 // seconds
        PAYOUTS: {
            color: 2,
            parity: 2,
            dozen: 3,
            number: 36
        }
    },

    POKER: {
        COOLDOWN: 20,                 // seconds — legacy, superseded by CASINO_SESSION's random cooldown tiers
        // Progressive 3-Card Poker (commands/casino/poker.js). Ante amount
        // comes from the shared CASINO_SESSION.BET_OPTIONS dropdown, same
        // as every other game — MIN_ANTE/MAX_ANTE below are unused
        // leftovers from the original ante-only variant, kept in case
        // anything external still references them.
        MIN_ANTE: 5000,
        MAX_ANTE: 100000,
        // The player can "Bet" at up to 2 decision points (after the 1st
        // and 2nd card reveals) to add another ante-sized wager to
        // currentBet, or "Check" to hold at the current amount. Folding
        // forfeits currentBet entirely — real stakes, unlike the old
        // variant where the worst case was always a push.
        // Multiplier applies to the FULL currentBet (ante + any bets) and
        // only pays out if the player's hand beats the dealer's — see
        // pokerService.compareHands(). A loss forfeits currentBet, a push
        // (identical hands) returns it.
        PAYOUTS: {
            mini_royal: 500,
            straight_flush: 40,
            three_kind: 30,
            straight: 6,
            flush: 3,
            pair: 2,
            high_card: 1
        }
    },

    JACKPOT: {
        BASE_AMOUNT: 1000000,
        CONTRIBUTION_RATE: 0.01,      // 1% of every casino bet feeds the jackpot
        TRIGGER_CHANCE: 0.0005        // per qualifying bet, chance to hit the jackpot
    },

    // Kept for backwards compatibility (e.g. any future "biggest lifetime
    // wagerer" flavor text) but no longer surfaced as "VIP" anywhere —
    // superseded by CASINO_RANKS below. See CASINO_CHANGES.md.
    VIP: {
        RANKS: [
            { id: "bronze",  label: "🥉 Bronze Gambler",   threshold: 10000000,    dailyBonus: 0 },
            { id: "silver",  label: "🥈 Silver Gambler",   threshold: 50000000,    dailyBonus: 0 },
            { id: "gold",    label: "🥇 Gold Gambler",     threshold: 250000000,   dailyBonus: 0.05 },
            { id: "diamond", label: "💎 Diamond Gambler",  threshold: 1000000000,  dailyBonus: 0.10 },
            { id: "legend",  label: "👑 Whisper Legend",   threshold: 10000000000, dailyBonus: 0.25 }
        ]
    },

    // Casino XP / rank system — replaces VIP above as the thing /casino vip
    // and the passport actually display. Earned through play (see
    // CASINO_XP below), not raw wager size, so it rewards showing up and
    // playing rather than just betting big once.
    CASINO_RANKS: [
        { id: "visitor",     label: "🎲 Visitor",       xp: 0 },
        { id: "regular",     label: "🎰 Regular",       xp: 1000 },
        { id: "vip",         label: "💎 VIP",           xp: 10000 },
        { id: "high_roller", label: "👑 High Roller",   xp: 100000 },
        { id: "legend",      label: "🏆 Casino Legend", xp: 1000000 }
    ],

    CASINO_XP: {
        WIN_PERCENT: 0.10,     // 10% of net winnings, rounded down
        WIN_FLAT_BONUS: 1,     // + a flat 1 XP on top of the win percent
        LOSS_XP: 1,            // participation XP on a loss
        DAILY_BONUS_XP: 10,
        JACKPOT_XP: 500
    },


    CASINO_DAILY_BONUS: {
        BASE_COINS: 5000,
        STREAK_STEP_COINS: 500,       // extra coins per streak day, capped below
        MAX_STREAK_DAYS: 20,          // streak days that count toward the bonus
        COOLDOWN_HOURS: 20,           // must wait this long before claiming again
        STREAK_WINDOW_HOURS: 48       // claiming later than this resets the streak to 1
    },

    // Only announce casino wins at or above this net profit, and only with
    // this probability even then — keeps the channel from getting spammed.
    CASINO_ANNOUNCER: {
        MIN_WIN_TO_ANNOUNCE: 1000000,
        ANNOUNCE_CHANCE: 0.5
    }

}