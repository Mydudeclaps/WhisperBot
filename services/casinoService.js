const { DICE, CASINO_SESSION, CASINO_RANKS, CASINO_XP } = require("../config/gameConfig");
const db = require("../database/database");


function randomBetween(min, max) {

    return Math.floor(Math.random() * (max - min + 1)) + min;

}


// Weighted-random cooldown applied after a session's plays run out.
// Returns { seconds, label }. Tiers/weights live in
// config/gameConfig.js CASINO_SESSION.COOLDOWN_TIERS.
function getRandomCooldown() {

    const roll = Math.random();
    let cumulative = 0;

    for (const tier of CASINO_SESSION.COOLDOWN_TIERS) {

        cumulative += tier.weight;

        if (roll < cumulative) {
            return { seconds: randomBetween(tier.min, tier.max), label: tier.label };
        }

    }

    // Floating point safety net — should only trigger if the tier
    // weights don't sum to exactly 1.
    const last = CASINO_SESSION.COOLDOWN_TIERS[CASINO_SESSION.COOLDOWN_TIERS.length - 1];
    return { seconds: randomBetween(last.min, last.max), label: last.label };

}


// The effective max bet for a session dropdown: the configured ceiling,
// or 10% of the player's current balance, whichever is lower (never below
// the configured minimum).
function maxBetFor(balance, sessionConfig = CASINO_SESSION) {

    return Math.max(
        sessionConfig.MIN_BET,
        Math.min(sessionConfig.MAX_BET, Math.floor(balance * sessionConfig.MAX_BET_BALANCE_PERCENT))
    );

}


// plays: array of { wagered, won } — one entry per play in a session.
// Returns { plays, wagered, won, net }. Same shape as
// slotsService.getSlotSessionStats, generalized for any casino game.
function getSessionStats(plays) {

    return plays.reduce((totals, p) => {

        totals.wagered += p.wagered;
        totals.won += p.won;
        totals.net = totals.won - totals.wagered;
        return totals;

    }, { plays: plays.length, wagered: 0, won: 0, net: 0 });

}


// Rolls two six-sided dice.
function rollDice() {

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;

    return {
        die1,
        die2,
        total: die1 + die2
    };

}


// guess is "over", "under", or "exact". Returns { won, multiplier }.
function resolveDiceBet(guess, total) {

    if (guess === "exact") {

        return {
            won: total === 7,
            multiplier: DICE.PAYOUT_EXACT
        };

    }

    if (guess === "over") {

        return {
            won: total > 7,
            multiplier: DICE.PAYOUT_OVER
        };

    }

    // "under"
    return {
        won: total < 7,
        multiplier: DICE.PAYOUT_UNDER
    };

}


// === CASINO XP / RANK SYSTEM ===
// Central home for casino progression — every game calls addCasinoXP
// after recording a bet via casinoStatsService.recordBet, rather than
// each command computing/writing XP itself.

function ensureStatsRow(userId) {

    db.prepare(`
        INSERT OR IGNORE INTO casino_stats (user_id)
        VALUES (?)
    `).run(userId);

}


function getCasinoXP(userId) {

    ensureStatsRow(userId);

    const row = db.prepare(
        "SELECT casino_xp FROM casino_stats WHERE user_id = ?"
    ).get(userId);

    return row ? row.casino_xp : 0;

}


function addCasinoXP(userId, amount) {

    ensureStatsRow(userId);

    db.prepare(`
        UPDATE casino_stats
        SET casino_xp = casino_xp + ?
        WHERE user_id = ?
    `).run(Math.max(0, Math.round(amount)), userId);

    return getCasinoXP(userId);

}


// Highest rank the player currently qualifies for.
function getCasinoRank(xp) {

    let rank = CASINO_RANKS[0];

    for (const candidate of CASINO_RANKS) {
        if (xp >= candidate.xp) rank = candidate;
    }

    return rank;

}


// Next rank up, with `remaining` XP needed — or null if already at the
// top rank.
function getNextCasinoRank(xp) {

    const next = CASINO_RANKS.find(r => xp < r.xp);
    if (!next) return null;

    return { ...next, remaining: next.xp - xp };

}


// XP for a single game outcome, per the CASINO_XP table in
// config/gameConfig.js. `netChange` is winnings above the bet (0 or
// negative on a loss/push).
function xpForOutcome(won, netChange) {

    if (won && netChange > 0) {
        return Math.floor(netChange * CASINO_XP.WIN_PERCENT) + CASINO_XP.WIN_FLAT_BONUS;
    }

    return CASINO_XP.LOSS_XP;

}


// Convenience one-shot: awards the right amount of XP for a game outcome
// and returns the new total. Call right after casinoStatsService.recordBet.
function awardGameXP(userId, won, netChange) {

    return addCasinoXP(userId, xpForOutcome(won, netChange));

}


// === GAME HISTORY ===

// result: "win" | "loss" | "push"
function logGameResult(userId, gameType, betAmount, result, winAmount = 0) {

    db.prepare(`
        INSERT INTO casino_history (user_id, game_type, bet_amount, result, win_amount, played_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, gameType, betAmount, result, winAmount, new Date().toISOString());

}


function getRecentGames(userId, limit = 10) {

    return db.prepare(`
        SELECT * FROM casino_history
        WHERE user_id = ?
        ORDER BY datetime(played_at) DESC
        LIMIT ?
    `).all(userId, limit);

}


// Computes the player's most-played game live from casino_stats — no
// stored favorite_game column to keep in sync, just derived on read.
// Returns a display label, or null if they haven't played anything yet.
const FAVORITE_GAME_LABELS = {
    blackjack: "🃏 Blackjack",
    dice: "🎲 Dice",
    highlow: "🎯 High/Low",
    horse: "🐎 Horse Racing",
    slots: "🎰 Slots",
    roulette: "🔴 Roulette",
    poker: "♠️ Poker"
};

function getFavoriteGame(stats) {

    let best = null;
    let bestCount = 0;

    for (const key of Object.keys(FAVORITE_GAME_LABELS)) {

        const count = stats[`${key}_games`] || 0;

        if (count > bestCount) {
            bestCount = count;
            best = key;
        }

    }

    return best ? FAVORITE_GAME_LABELS[best] : null;

}


// === PERSISTENT COOLDOWN MANAGEMENT ===
// Fixes the leave-and-reenter cooldown bypass — see database/database.js
// for the full explanation. Every game command must call checkCooldown()
// before showing its setup screen, and startCooldown() when a session's
// plays run out, instead of tracking cooldownUntil in a local variable.

function checkCooldown(userId, gameType) {

    const row = db.prepare(`
        SELECT cooldown_until FROM casino_cooldowns
        WHERE user_id = ? AND game_type = ?
    `).get(userId, gameType);

    if (row && row.cooldown_until > Date.now()) {

        return {
            onCooldown: true,
            remaining: Math.ceil((row.cooldown_until - Date.now()) / 1000),
            untilUnix: Math.ceil(row.cooldown_until / 1000)
        };

    }

    return { onCooldown: false, remaining: 0, untilUnix: null };

}


function startCooldown(userId, gameType, seconds) {

    const cooldownUntil = Date.now() + (seconds * 1000);

    db.prepare(`
        INSERT INTO casino_cooldowns (user_id, game_type, cooldown_until)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, game_type)
        DO UPDATE SET cooldown_until = excluded.cooldown_until
    `).run(userId, gameType, cooldownUntil);

    return cooldownUntil;

}


function clearCooldown(userId, gameType) {

    db.prepare(`
        DELETE FROM casino_cooldowns
        WHERE user_id = ? AND game_type = ?
    `).run(userId, gameType);

}


// Any game on cooldown at all — exposed for callers that want a global
// "you're on cooldown somewhere" check, but NOT wired into any game by
// default. Each game only blocks on its own cooldown; see
// CASINO_CHANGES.md for why cross-game blocking wasn't turned on.
function hasAnyCooldown(userId) {

    return !!db.prepare(`
        SELECT 1 FROM casino_cooldowns
        WHERE user_id = ? AND cooldown_until > ?
        LIMIT 1
    `).get(userId, Date.now());

}


function getActiveCooldowns(userId) {

    const rows = db.prepare(`
        SELECT game_type, cooldown_until FROM casino_cooldowns
        WHERE user_id = ? AND cooldown_until > ?
    `).all(userId, Date.now());

    return rows.map(r => ({
        gameType: r.game_type,
        remaining: Math.ceil((r.cooldown_until - Date.now()) / 1000),
        untilUnix: Math.ceil(r.cooldown_until / 1000)
    }));

}


// Sweeps expired rows so the table doesn't grow forever. Cheap to run
// occasionally — expired rows are already harmless (checkCooldown
// ignores them), this just keeps the table small. Wired into bot.js on
// an hourly interval.
function cleanupExpiredCooldowns() {

    const result = db.prepare(`
        DELETE FROM casino_cooldowns
        WHERE cooldown_until <= ?
    `).run(Date.now());

    return result.changes;

}


module.exports = {

    rollDice,
    resolveDiceBet,
    randomBetween,
    getRandomCooldown,
    maxBetFor,
    getSessionStats,

    getCasinoXP,
    addCasinoXP,
    getCasinoRank,
    getNextCasinoRank,
    awardGameXP,

    logGameResult,
    getRecentGames,

    getFavoriteGame,

    checkCooldown,
    startCooldown,
    clearCooldown,
    hasAnyCooldown,
    getActiveCooldowns,
    cleanupExpiredCooldowns

};
