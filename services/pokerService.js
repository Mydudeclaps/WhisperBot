// Three Card Poker. evaluateHand()/dealHand() below are unchanged from
// the original ante-only variant. dealProgressiveHands()/compareHands()
// are new — they add a real dealer hand that the player's hand is
// compared against, for Progressive 3-Card Poker (see
// commands/casino/poker.js). Reuses the shared cardService so its cards
// look/sort identically to High/Low's.
const { drawCard } = require("./cardService");
const { POKER } = require("../config/gameConfig");


function dealHand() {

    return [drawCard(), drawCard(), drawCard()];

}


function isConsecutive(sortedValues) {

    return sortedValues[1] === sortedValues[0] + 1 &&
           sortedValues[2] === sortedValues[1] + 1;

}


// Returns { rank, multiplier, label }. `rank` is a machine key,
// `multiplier` comes straight from config/gameConfig.js POKER.PAYOUTS.
function evaluateHand(cards) {

    const values = cards.map(c => c.value).sort((a, b) => a - b);
    const suits = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);

    let straight = isConsecutive(values);
    let isMiniRoyal = false;

    // cardService's Ace is value 1 — also check the Ace-high straight
    // (Q, K, A), which is the strongest straight and doubles as the
    // "Mini Royal" when it's also a flush.
    if (!straight && values[0] === 1) {

        const highAceValues = [values[1], values[2], 14].sort((a, b) => a - b);

        if (isConsecutive(highAceValues)) {
            straight = true;
            if (values[1] === 12 && values[2] === 13) isMiniRoyal = true; // Q, K, A
        }

    }

    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    const countValues = Object.values(counts);

    const isThreeKind = countValues.includes(3);
    const isPair = countValues.includes(2);

    if (isFlush && straight && isMiniRoyal) {
        return { rank: "mini_royal", label: "✨ Mini Royal", multiplier: POKER.PAYOUTS.mini_royal };
    }

    if (isFlush && straight) {
        return { rank: "straight_flush", label: "🌈 Straight Flush", multiplier: POKER.PAYOUTS.straight_flush };
    }

    if (isThreeKind) {
        return { rank: "three_kind", label: "🎯 Three of a Kind", multiplier: POKER.PAYOUTS.three_kind };
    }

    if (straight) {
        return { rank: "straight", label: "📈 Straight", multiplier: POKER.PAYOUTS.straight };
    }

    if (isFlush) {
        return { rank: "flush", label: "🌊 Flush", multiplier: POKER.PAYOUTS.flush };
    }

    if (isPair) {
        return { rank: "pair", label: "👥 Pair", multiplier: POKER.PAYOUTS.pair };
    }

    return { rank: "high_card", label: "🃏 High Card", multiplier: POKER.PAYOUTS.high_card };

}


// Deals both hands up front (both fixed for the whole hand — Progressive
// 3-Card Poker reveals cards one at a time for suspense, but nothing is
// actually redrawn mid-hand; the "reveal" is presentational only, same
// as every other card game in this bot, none of which track deck
// depletion). Dealer's first card starts hidden — the caller is
// responsible for not showing dealerHand[0] to the player until showdown.
function dealProgressiveHands() {

    return {
        playerHand: dealHand(),
        dealerHand: dealHand()
    };

}


const RANK_ORDER = ["high_card", "pair", "flush", "straight", "three_kind", "straight_flush", "mini_royal"];


// Adds a tiebreak key to evaluateHand()'s result so two hands of the same
// rank tier (e.g. two flushes) can be compared card-by-card. Ace is
// treated as high (14) for every comparison here — evaluateHand() itself
// still only recognizes the Ace-low-adjacent (Q,K,A) straight, unchanged.
function evaluateHandWithTiebreak(cards) {

    const base = evaluateHand(cards);
    const compValues = cards.map(c => c.value === 1 ? 14 : c.value).sort((a, b) => b - a);

    let tiebreak;

    if (base.rank === "three_kind") {

        tiebreak = [compValues[0]];

    } else if (base.rank === "pair") {

        const counts = {};
        for (const v of compValues) counts[v] = (counts[v] || 0) + 1;

        const pairValue = Number(Object.keys(counts).find(v => counts[v] === 2));
        const kicker = compValues.find(v => v !== pairValue);

        tiebreak = [pairValue, kicker];

    } else if (base.rank === "straight" || base.rank === "straight_flush" || base.rank === "mini_royal") {

        tiebreak = [Math.max(...compValues)];

    } else {

        // flush, high_card — compare all three cards top to bottom
        tiebreak = compValues;

    }

    return { ...base, tiebreak };

}


// Compares the player's hand against the dealer's. Returns
// { winner: "player" | "dealer" | "push", playerEval, dealerEval } where
// each eval is evaluateHand()'s result plus a `tiebreak` array.
function compareHands(playerCards, dealerCards) {

    const playerEval = evaluateHandWithTiebreak(playerCards);
    const dealerEval = evaluateHandWithTiebreak(dealerCards);

    const playerRankIndex = RANK_ORDER.indexOf(playerEval.rank);
    const dealerRankIndex = RANK_ORDER.indexOf(dealerEval.rank);

    if (playerRankIndex !== dealerRankIndex) {

        return {
            winner: playerRankIndex > dealerRankIndex ? "player" : "dealer",
            playerEval,
            dealerEval
        };

    }

    const len = Math.max(playerEval.tiebreak.length, dealerEval.tiebreak.length);

    for (let i = 0; i < len; i++) {

        const p = playerEval.tiebreak[i] || 0;
        const d = dealerEval.tiebreak[i] || 0;

        if (p !== d) {
            return { winner: p > d ? "player" : "dealer", playerEval, dealerEval };
        }

    }

    return { winner: "push", playerEval, dealerEval };

}


module.exports = {
    dealHand,
    evaluateHand,
    dealProgressiveHands,
    compareHands
};
