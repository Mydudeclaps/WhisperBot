const { drawCard, formatCard } = require("./cardService");
const { BLACKJACK } = require("../config/gameConfig");


// cardService's drawCard() returns value 1-13 (1=Ace, 11=J, 12=Q, 13=K).
// Blackjack scoring needs Ace=1-or-11 and J/Q/K=10, so we translate here
// rather than touching the shared card service used by High/Low.
function blackjackValue(card) {

    if (card.value === 1)
        return 11; // Ace — hand value logic below demotes to 1 as needed

    if (card.value >= 11)
        return 10; // J, Q, K

    return card.value;

}


// Returns { total, soft } — `soft` is true if an Ace is currently counted
// as 11 (i.e. could still drop to 1 without busting).
function handValue(cards) {

    let total = 0;
    let aces = 0;

    for (const card of cards) {

        const value = blackjackValue(card);

        total += value;

        if (card.value === 1)
            aces++;

    }

    let soft = aces > 0;

    // Demote Aces from 11 to 1 one at a time while busting.
    while (total > 21 && aces > 0) {

        total -= 10;
        aces--;

        if (aces === 0)
            soft = false;

    }

    return { total, soft };

}


function isBlackjack(cards) {

    return cards.length === 2 && handValue(cards).total === 21;

}


function dealInitialHands() {

    return {
        player: [drawCard(), drawCard()],
        dealer: [drawCard(), drawCard()]
    };

}


function hit(hand) {

    hand.push(drawCard());
    return hand;

}


// Dealer hits until reaching the configured stand threshold.
function playDealer(dealerHand) {

    while (handValue(dealerHand).total < BLACKJACK.DEALER_STAND_ON) {

        hit(dealerHand);

    }

    return dealerHand;

}


// Compares final hands once both sides have finished playing.
// Returns "player_blackjack", "win", "lose", or "push".
function resolveHands(playerHand, dealerHand) {

    const playerTotal = handValue(playerHand).total;
    const dealerTotal = handValue(dealerHand).total;

    if (playerTotal > 21)
        return "lose"; // player bust

    if (isBlackjack(playerHand) && !isBlackjack(dealerHand))
        return "player_blackjack";

    if (isBlackjack(dealerHand) && !isBlackjack(playerHand))
        return "lose";

    if (dealerTotal > 21)
        return "win"; // dealer bust

    if (playerTotal > dealerTotal)
        return "win";

    if (playerTotal < dealerTotal)
        return "lose";

    return "push";

}


function formatHand(cards) {

    return cards.map(formatCard).join("  ");

}


module.exports = {

    handValue,
    isBlackjack,
    dealInitialHands,
    hit,
    playDealer,
    resolveHands,
    formatHand

};
