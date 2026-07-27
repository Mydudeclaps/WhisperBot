// Memory Vault (/memory) — grid generation, flip/match logic, and
// difficulty-based reward calculation.
const { MEMORY } = require("../config/gameConfig");


// Builds a shuffled grid of paired symbols for the given difficulty.
// For difficulties with hasBonusCell (medium's 5x5 = 25 cells, which
// can't split into whole pairs — see the note in gameConfig.js), the
// leftover cell is filled with a bonus marker instead of a 13th pair.
function generateGrid(difficultyKey) {

    const config = MEMORY.DIFFICULTIES[difficultyKey];
    if (!config) return null;

    const totalCells = config.size * config.size;
    const symbols = MEMORY.SYMBOLS.slice(0, config.pairs);

    const deck = [];
    for (const symbol of symbols) {
        deck.push(symbol, symbol);
    }

    if (config.hasBonusCell) {
        deck.push("BONUS");
    }

    // Shuffle (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;

}


function createGame(difficultyKey, bet) {

    const config = MEMORY.DIFFICULTIES[difficultyKey];
    if (!config) return null;

    return {
        difficulty: difficultyKey,
        config,
        bet,
        grid: generateGrid(difficultyKey),
        matched: new Array(config.size * config.size).fill(false), // permanently face-up
        matchedPairs: 0,
        bonusCollected: false,
        attemptsUsed: 0,
        pendingFlips: [], // 0, 1, or 2 positions currently face-up mid-turn (temporary — see clearPendingMismatch)
        bonusCoinsWon: 0
    };

}


// Cells currently visible on the board — permanently matched, plus
// whatever's face-up mid-turn (including a just-revealed mismatch that
// hasn't been auto-hidden yet). This is the actual fix for the "board
// only ever shows ❓" bug: the old version cleared a mismatch's positions
// before the caller ever got a chance to render them face-up.
function getVisiblePositions(game) {

    const visible = [...game.pendingFlips];

    for (let i = 0; i < game.matched.length; i++) {
        if (game.matched[i]) visible.push(i);
    }

    return visible;

}


// Flips one cell. Returns:
//   { type: "first_flip" }                          — first card of the pair, waiting on the second
//   { type: "bonus", coins }                         — hit the bonus cell (medium only)
//   { type: "match", symbol, complete }               — second card matched the first; both are now
//                                                        permanently in `matched` and visible
//   { type: "no_match", symbolA, symbolB, posA, posB } — second card didn't match. Both positions stay
//                                                        in game.pendingFlips (so the caller can render
//                                                        them face-up) until clearPendingMismatch() is
//                                                        called — typically after a short delay so the
//                                                        player actually sees what they flipped.
//   { type: "invalid" }                               — already matched, currently pending, or out of attempts
function flipCard(game, position) {

    if (game.matched[position]) return { type: "invalid" };
    if (game.pendingFlips.includes(position)) return { type: "invalid" };
    if (game.attemptsUsed >= game.config.maxAttempts) return { type: "invalid" };

    if (game.grid[position] === "BONUS" && !game.bonusCollected) {

        game.bonusCollected = true;
        game.matched[position] = true; // bonus cell stays visible too, just never counts as a pair

        const { min, max } = MEMORY.BONUS_CELL_COINS;
        const coins = Math.floor(Math.random() * (max - min + 1)) + min;
        game.bonusCoinsWon += coins;

        return { type: "bonus", coins };

    }

    if (game.pendingFlips.length === 0) {

        game.pendingFlips = [position];
        return { type: "first_flip" };

    }

    // Second flip of this turn — this always counts as one attempt.
    game.attemptsUsed += 1;

    const firstPos = game.pendingFlips[0];
    game.pendingFlips = [firstPos, position]; // both stay visible until resolved below/cleared

    if (game.grid[firstPos] === game.grid[position]) {

        game.matched[firstPos] = true;
        game.matched[position] = true;
        game.matchedPairs += 1;
        game.pendingFlips = []; // now permanently visible via `matched`, no longer "pending"

        return {
            type: "match",
            symbol: game.grid[position],
            complete: game.matchedPairs >= game.config.pairs
        };

    }

    return { type: "no_match", symbolA: game.grid[firstPos], symbolB: game.grid[position], posA: firstPos, posB: position };

}


// Called after the caller has shown a mismatch's two cards for a beat —
// hides them again by clearing pendingFlips. Safe to call even if
// there's nothing pending (e.g. the last flip was a match, which already
// cleared pendingFlips itself).
function clearPendingMismatch(game) {

    game.pendingFlips = [];

}


function isOutOfAttempts(game) {
    return game.attemptsUsed >= game.config.maxAttempts && game.matchedPairs < game.config.pairs;
}

function isComplete(game) {
    return game.matchedPairs >= game.config.pairs;
}


// Reward for a completed (or attempts-exhausted) vault. "Perfect" means
// using the minimum possible attempts (= exactly `pairs`, one correct
// guess per pair with no misses) — that hits perfectMultiplier exactly.
// Using every available attempt (maxAttempts) still completing the vault
// hits baseMultiplier exactly. Scales linearly between those two points.
// Incomplete vaults (ran out of attempts before finding all pairs) pay
// nothing beyond any bonus coins already collected along the way.
function calculateReward(game) {

    if (!isComplete(game)) {
        return { multiplier: 0, coins: game.bonusCoinsWon };
    }

    const { maxAttempts, pairs, baseMultiplier, perfectMultiplier } = game.config;

    const slack = Math.max(1, maxAttempts - pairs); // available "extra" attempts before hitting base
    const attemptsOverMinimum = Math.max(0, game.attemptsUsed - pairs);
    const efficiency = Math.max(0, 1 - (attemptsOverMinimum / slack)); // 1.0 = perfect, 0.0 = used every attempt

    const multiplier = baseMultiplier + (perfectMultiplier - baseMultiplier) * efficiency;
    const coins = Math.floor(game.bet * multiplier) + game.bonusCoinsWon;

    return { multiplier: Math.round(multiplier * 100) / 100, coins };

}


module.exports = {
    generateGrid,
    createGame,
    flipCard,
    clearPendingMismatch,
    getVisiblePositions,
    isOutOfAttempts,
    isComplete,
    calculateReward
};
