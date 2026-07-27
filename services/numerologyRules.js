// Formula handling for Numerology. Pure functions — no DB access here,
// so this can be unit tested trivially and reused by both the live
// validator (numerologyService.js) and anything that just wants to
// preview "what's the next number" (e.g. an admin dashboard).
const { CUSTOM_FORMULAS, MULTIPLY_STEP } = require("../config/numerologyConfig");

// `state` is the game's formula_state JSON (already parsed), holding
// whatever a formula needs beyond current_number — e.g. `previous` for
// the Fibonacci-style formula. Returns the next expected number.
function computeNext(formula, currentNumber, state = {}) {

    switch (formula) {

        case "increment":
            return currentNumber + 1;

        case "fibonacci": {
            const previous = typeof state.previous === "number" ? state.previous : 0;
            return currentNumber + previous;
        }

        case "multiply":
            return currentNumber * MULTIPLY_STEP;

        case "add_previous": {
            const previous = typeof state.previous === "number" ? state.previous : 0;
            return currentNumber + previous;
        }

        default: {

            // Custom named formulas (multiply_3, subtract_2, add_5, ...)
            const custom = CUSTOM_FORMULAS[formula];
            if (!custom) return currentNumber + 1; // safe fallback, never throws mid-game

            if (custom.op === "add_previous") {
                const previous = typeof state.previous === "number" ? state.previous : 0;
                return currentNumber + previous;
            }

            if (custom.op === "multiply") return currentNumber * custom.arg;
            if (custom.op === "subtract") return currentNumber - custom.arg;
            if (custom.op === "add") return currentNumber + custom.arg;

            return currentNumber + 1;

        }

    }

}

// Called after a CORRECT count is accepted, to compute the new
// formula_state for the NEXT expected number (e.g. rolling `previous`
// forward for the Fibonacci-style formula).
function advanceState(formula, previousCurrentNumber, newCurrentNumber, state = {}) {

    if (formula === "fibonacci" || formula === "add_previous") {
        return { ...state, previous: previousCurrentNumber };
    }

    return { ...state };

}

function getFormulaLabel(formula) {

    if (formula === "increment") return "+1 (Classic)";
    if (formula === "fibonacci") return "Current + Previous";
    if (formula === "multiply") return `× ${MULTIPLY_STEP}`;

    const custom = CUSTOM_FORMULAS[formula];
    return custom ? custom.label : formula;

}

module.exports = {
    computeNext,
    advanceState,
    getFormulaLabel
};
