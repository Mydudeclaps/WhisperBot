const { RANK_LABELS, SUITS } = require("../data/cards");


// Draws a random card: { value: 1-13, label: "A"/"2".../"K", suit: "♥️" }
function drawCard() {

    const value = Math.floor(Math.random() * 13) + 1;
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const label = RANK_LABELS[value] || String(value);

    return { value, label, suit };

}


// "🃏 9 ♥️"
function formatCard(card) {

    return `🃏 ${card.label} ${card.suit}`;

}


// Compares the player's guess against dealer vs player card values.
// Returns "win", "lose", or "push" (tie).
function compareGuess(guess, dealerCard, playerCard) {

    if (playerCard.value === dealerCard.value) return "push";

    const playerIsHigher = playerCard.value > dealerCard.value;

    if (guess === "high" && playerIsHigher) return "win";
    if (guess === "low" && !playerIsHigher) return "win";

    return "lose";

}


module.exports = {

    drawCard,

    formatCard,

    compareGuess

};
