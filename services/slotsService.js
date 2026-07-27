const { SLOTS } = require("../config/gameConfig");


// Kingdom name -> the slot symbol that represents it, used by the
// "kingdom" variant's kingdom-match bonus.
const KINGDOM_SYMBOLS = {
    North: "🏔️",
    South: "🏜️",
    East: "🌊",
    West: "🏰"
};


function weightedSymbol(variant) {

    const total = variant.weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;

    for (let i = 0; i < variant.symbols.length; i++) {

        roll -= variant.weights[i];

        if (roll <= 0) return variant.symbols[i];

    }

    return variant.symbols[variant.symbols.length - 1];

}


function getVariant(variantKey) {

    return SLOTS.VARIANTS[variantKey] || null;

}


// Spins three reels for the given variant key.
function spin(variantKey) {

    const variant = getVariant(variantKey);
    if (!variant) return null;

    return [weightedSymbol(variant), weightedSymbol(variant), weightedSymbol(variant)];

}


// Resolves a spin into { won, matches, multiplier, kingdomBonus }.
function resolveSpin(variantKey, reels, userKingdom = null) {

    const variant = getVariant(variantKey);
    const [a, b, c] = reels;

    if (a === b && b === c) {

        let multiplier = variant.payouts[a] || 0;
        let kingdomBonus = false;

        if (
            variantKey === "kingdom" &&
            userKingdom &&
            a === KINGDOM_SYMBOLS[userKingdom]
        ) {
            multiplier += variant.kingdomMatchBonus;
            kingdomBonus = true;
        }

        return { won: true, matches: 3, multiplier, kingdomBonus };

    }

    if (variantKey === "kingdom" && (a === b || b === c || a === c)) {

        return { won: true, matches: 2, multiplier: variant.twoMatchPayout, kingdomBonus: false };

    }

    return { won: false, matches: 0, multiplier: 0, kingdomBonus: false };

}


// Returns the ordered symbol list for a machine — e.g. for showing a
// "default" idle reel before the first spin.
function getSlotSymbols(variantKey) {

    const variant = getVariant(variantKey);
    return variant ? variant.symbols : [];

}


// ─── New in this update: Fortune Reels (5_REEL) and Mega Slots
// (3x3_GRID) — see SLOTS_TIC_MEMORY_CHANGES.md. Fully separate code
// paths from spin()/resolveSpin() above; those two functions and every
// existing 3-reel variant (classic/treasure/kingdom) are untouched.

// Fills a flat grid of `count` cells with weighted-random symbols from
// the variant. Used by both the 5-reel and 3x3 machines — the only
// difference between them is how many cells and how the paylines index
// into that flat array.
function spinGrid(variant, count) {

    const grid = [];
    for (let i = 0; i < count; i++) grid.push(weightedSymbol(variant));
    return grid;

}


function spinFortune5(variantKey) {

    const variant = getVariant(variantKey);
    if (!variant) return null;

    return spinGrid(variant, variant.reels * variant.rows);

}


// For each line, finds the symbol that appears most often in that line
// and pays out at the matching tier (5/4/3-of-a-kind) if it qualifies.
// Multiple lines can win simultaneously — their multipliers sum.
function resolveFortune5(variantKey, grid) {

    const variant = getVariant(variantKey);
    const winningLines = [];
    let totalMultiplier = 0;
    let bestMatchCount = 0;

    for (let lineIndex = 0; lineIndex < variant.lines.length; lineIndex++) {

        const line = variant.lines[lineIndex];
        const counts = {};

        for (const cell of line) {
            const symbol = grid[cell];
            counts[symbol] = (counts[symbol] || 0) + 1;
        }

        let bestSymbol = null;
        let bestCount = 0;

        for (const [symbol, count] of Object.entries(counts)) {
            if (count > bestCount) { bestCount = count; bestSymbol = symbol; }
        }

        let tierKey = null;
        if (bestCount >= 5) tierKey = "fiveMatch";
        else if (bestCount === 4) tierKey = "fourMatch";
        else if (bestCount === 3) tierKey = "threeMatch";

        if (tierKey && variant.payouts[tierKey][bestSymbol]) {

            const multiplier = variant.payouts[tierKey][bestSymbol];
            totalMultiplier += multiplier;
            bestMatchCount = Math.max(bestMatchCount, bestCount);

            winningLines.push({ lineIndex, symbol: bestSymbol, count: bestCount, multiplier });

        }

    }

    return {
        won: winningLines.length > 0,
        matches: bestMatchCount,
        multiplier: totalMultiplier,
        winningLines,
        kingdomBonus: false
    };

}


function spinMega3x3(variantKey) {

    const variant = getVariant(variantKey);
    if (!variant) return null;

    return spinGrid(variant, variant.rows * variant.cols);

}


function resolveMega3x3(variantKey, grid) {

    const variant = getVariant(variantKey);
    const winningLines = [];
    let totalMultiplier = 0;
    let bestMatchCount = 0;

    for (let lineIndex = 0; lineIndex < variant.paylines.length; lineIndex++) {

        const line = variant.paylines[lineIndex];
        const [a, b, c] = line.map(cell => grid[cell]);

        let tierKey = null;
        let symbol = null;

        if (a === b && b === c) {
            tierKey = "triple";
            symbol = a;
        } else if (a === b || b === c || a === c) {
            tierKey = "double";
            symbol = a === b ? a : (b === c ? b : a); // the symbol shared by the matching pair
        }

        if (tierKey && variant.payouts[tierKey][symbol]) {

            const multiplier = variant.payouts[tierKey][symbol];
            totalMultiplier += multiplier;
            bestMatchCount = Math.max(bestMatchCount, tierKey === "triple" ? 3 : 2);

            winningLines.push({ lineIndex, symbol, count: tierKey === "triple" ? 3 : 2, multiplier });

        }

    }

    return {
        won: winningLines.length > 0,
        matches: bestMatchCount,
        multiplier: totalMultiplier,
        winningLines,
        kingdomBonus: false
    };

}


// Convenience one-shot: spins + resolves + converts to an actual coin
// amount in one call. Returns { reels, result, winAmount } where
// winAmount is 0 on a loss. Dispatches on variant.type — 3-reel variants
// (classic/treasure/kingdom, or any variant with no type set, for
// backwards compatibility) use the original spin()/resolveSpin() path
// completely unchanged; the two grid-based machines use the functions
// above.
function calculateSlotPayout(variantKey, betAmount, userKingdom = null) {

    const variant = getVariant(variantKey);

    if (variant && variant.type === "5_REEL") {

        const reels = spinFortune5(variantKey);
        const result = resolveFortune5(variantKey, reels);
        const winAmount = result.won ? betAmount * result.multiplier : 0;
        return { reels, result, winAmount };

    }

    if (variant && variant.type === "3x3_GRID") {

        const reels = spinMega3x3(variantKey);
        const result = resolveMega3x3(variantKey, reels);
        const winAmount = result.won ? betAmount * result.multiplier : 0;
        return { reels, result, winAmount };

    }

    // Original 3-reel path — byte-for-byte the same call as before this
    // update.
    const reels = spin(variantKey);
    const result = resolveSpin(variantKey, reels, userKingdom);
    const winAmount = result.won ? betAmount * result.multiplier : 0;

    return { reels, result, winAmount };

}


// "[ 🍒 ] [ 🍋 ] [ 🔔 ]"
function getSlotDisplay(symbols) {

    return `[ ${symbols.join(" ] [ ")} ]`;

}


// spins: array of { wagered, won } — one entry per spin played this
// session. Returns { spins, wagered, won, net }.
function getSlotSessionStats(spins) {

    return spins.reduce((totals, s) => {

        totals.wagered += s.wagered;
        totals.won += s.won;
        totals.net = totals.won - totals.wagered;
        return totals;

    }, { spins: spins.length, wagered: 0, won: 0, net: 0 });

}


module.exports = {
    getVariant,
    spin,
    resolveSpin,
    getSlotSymbols,
    calculateSlotPayout,
    getSlotDisplay,
    getSlotSessionStats,
    KINGDOM_SYMBOLS,
    spinFortune5,
    resolveFortune5,
    spinMega3x3,
    resolveMega3x3
};
