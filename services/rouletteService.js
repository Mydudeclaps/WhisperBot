const { ROULETTE } = require("../config/gameConfig");

const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36
]);


function spin() {

    return Math.floor(Math.random() * 37); // 0-36, 0 is green

}


function colorOf(number) {

    if (number === 0) return "green";

    return RED_NUMBERS.has(number) ? "red" : "black";

}


// betType: "color" | "parity" | "dozen" | "number"
// betValue: "red"/"black" | "odd"/"even" | "1-12"/"13-24"/"25-36" | "0"-"36"
// Returns { won, multiplier } — multiplier is total return on the bet
// (bet included), matching the convention used elsewhere in this bot.
function resolveBet(betType, betValue, number) {

    const color = colorOf(number);

    if (betType === "color") {

        const won = color === betValue;
        return { won, multiplier: won ? ROULETTE.PAYOUTS.color : 0 };

    }

    if (betType === "parity") {

        if (number === 0) return { won: false, multiplier: 0 };

        const isEven = number % 2 === 0;
        const won = (betValue === "even") === isEven;

        return { won, multiplier: won ? ROULETTE.PAYOUTS.parity : 0 };

    }

    if (betType === "dozen") {

        if (number === 0) return { won: false, multiplier: 0 };

        const dozen =
            number <= 12 ? "1-12" :
            number <= 24 ? "13-24" :
            "25-36";

        const won = dozen === betValue;

        return { won, multiplier: won ? ROULETTE.PAYOUTS.dozen : 0 };

    }

    if (betType === "number") {

        const won = number === parseInt(betValue, 10);
        return { won, multiplier: won ? ROULETTE.PAYOUTS.number : 0 };

    }

    return { won: false, multiplier: 0 };

}


module.exports = {
    spin,
    colorOf,
    resolveBet,
    RED_NUMBERS
};
