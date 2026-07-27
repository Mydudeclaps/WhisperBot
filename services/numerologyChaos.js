// Chaos event engine — the "secret sauce." Rolled once per CORRECT
// count (never on a mistake — chaos should feel like a reward for
// engagement, not another way to get punished). Roll happens in the
// caller (events/messageCreate.js) right after a correct count is
// accepted; this module decides WHICH event (if any) and mutates game
// state for the ones that need to (warp, curse, divine window).
const db = require("../database/database");
const chaosEvents = require("../data/numerologyChaosEvents");
const { CHAOS_EVENT_CHANCE_MIN, CHAOS_EVENT_CHANCE_MAX, RANDOM_FORMULA_POOL, DIVINE_WINDOW_COUNTS } = require("../config/numerologyConfig");
const { getFormulaLabel } = require("./numerologyRules");

const EVENT_TYPES = Object.keys(chaosEvents);

function rollChaosChance() {

    // Chance varies within the configured range each roll, rather than
    // a single fixed number — keeps the "how often" itself a little
    // unpredictable, matching the "never repetitive" requirement.
    const chance = CHAOS_EVENT_CHANCE_MIN + Math.random() * (CHAOS_EVENT_CHANCE_MAX - CHAOS_EVENT_CHANCE_MIN);
    return Math.random() < chance;

}

function parseState(game) {
    try { return JSON.parse(game.formula_state || "{}"); }
    catch (e) { return {}; }
}

// Returns null if no event fired, otherwise:
//   { type, definition, publicText, loreText, game (updated) }
function maybeTriggerChaosEvent(game) {

    if (!rollChaosChance()) return null;

    const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const definition = chaosEvents[eventType];
    const state = parseState(game);

    let publicText, loreText, updatedGame = game;

    if (eventType === "count_shifts") {

        const from = game.current_number;
        const to = from + 4;

        db.prepare(`UPDATE numerology_games SET current_number = ? WHERE id = ?`).run(to, game.id);
        updatedGame = { ...game, current_number: to };

        publicText = definition.publicText(from, to);
        loreText = definition.loreText(daysSinceStart(game), from, to);

    } else if (eventType === "ghost_number") {

        // A decoy that ISN'T the real next number. Whoever posts it
        // next gets flagged as having "fallen for the ghost" (handled
        // as a normal incorrect attempt by numerologyService — the
        // ghost doesn't change the real expected number at all, it's
        // purely a trap/distraction). No state mutation needed: the
        // real expected number is untouched.
        const ghost = game.current_number + 1 + Math.floor(Math.random() * 5) + 1; // clearly NOT current+1

        publicText = definition.publicText(ghost);
        loreText = definition.loreText(daysSinceStart(game), ghost);

    } else if (eventType === "count_warps") {

        const formula = RANDOM_FORMULA_POOL[Math.floor(Math.random() * RANDOM_FORMULA_POOL.length)];
        const moves = 5;
        const newState = { ...state, warpFormula: formula, warpRemaining: moves, originalFormula: game.formula };

        db.prepare(`UPDATE numerology_games SET formula = ?, formula_state = ? WHERE id = ?`)
            .run(formula, JSON.stringify(newState), game.id);
        updatedGame = { ...game, formula, formula_state: JSON.stringify(newState) };

        const label = getFormulaLabel(formula);
        publicText = definition.publicText(label, moves);
        loreText = definition.loreText(daysSinceStart(game), label);

    } else if (eventType === "counters_curse") {

        const newState = { ...state, cursedNext: true };
        db.prepare(`UPDATE numerology_games SET formula_state = ? WHERE id = ?`).run(JSON.stringify(newState), game.id);
        updatedGame = { ...game, formula_state: JSON.stringify(newState) };

        publicText = definition.publicText();
        loreText = definition.loreText(daysSinceStart(game));

    } else if (eventType === "divine_number") {

        const newState = { ...state, divineRemaining: DIVINE_WINDOW_COUNTS };
        db.prepare(`UPDATE numerology_games SET formula_state = ? WHERE id = ?`).run(JSON.stringify(newState), game.id);
        updatedGame = { ...game, formula_state: JSON.stringify(newState) };

        publicText = definition.publicText(DIVINE_WINDOW_COUNTS);
        loreText = definition.loreText(daysSinceStart(game));

    } else if (eventType === "count_reset") {

        const oldCount = game.current_number;

        db.prepare(`UPDATE numerology_games SET current_number = 0, formula_state = '{}' WHERE id = ?`).run(game.id);
        updatedGame = { ...game, current_number: 0, formula_state: "{}" };

        publicText = definition.publicText(oldCount);
        loreText = definition.loreText(daysSinceStart(game), oldCount);

    }

    db.prepare(`
        INSERT INTO numerology_chaos_events (game_id, event_type, description, triggered_at)
        VALUES (?, ?, ?, ?)
    `).run(game.id, eventType, publicText, new Date().toISOString());

    return { type: eventType, definition, publicText, loreText, game: updatedGame };

}

// If a "Count Warp" is active, ticks it down by one and restores the
// original formula once it runs out. Call this after a correct count
// that happened WHILE a warp was active (not on the count that
// triggered the warp itself).
function tickWarp(game) {

    const state = parseState(game);
    if (!state.warpRemaining) return game;

    const remaining = state.warpRemaining - 1;

    if (remaining <= 0) {

        const newState = { ...state };
        delete newState.warpRemaining;
        delete newState.warpFormula;
        const originalFormula = newState.originalFormula || "increment";
        delete newState.originalFormula;

        db.prepare(`UPDATE numerology_games SET formula = ?, formula_state = ? WHERE id = ?`)
            .run(originalFormula, JSON.stringify(newState), game.id);

        return { ...game, formula: originalFormula, formula_state: JSON.stringify(newState) };

    }

    const newState = { ...state, warpRemaining: remaining };
    db.prepare(`UPDATE numerology_games SET formula_state = ? WHERE id = ?`).run(JSON.stringify(newState), game.id);

    return { ...game, formula_state: JSON.stringify(newState) };

}

// Ticks down an active "Divine Number" window by one. Returns the
// remaining count AFTER this tick (0 means it just ended).
function tickDivineWindow(game) {

    const state = parseState(game);
    if (!state.divineRemaining) return { game, remaining: 0 };

    const remaining = state.divineRemaining - 1;
    const newState = { ...state };

    if (remaining <= 0) delete newState.divineRemaining;
    else newState.divineRemaining = remaining;

    db.prepare(`UPDATE numerology_games SET formula_state = ? WHERE id = ?`).run(JSON.stringify(newState), game.id);

    return { game: { ...game, formula_state: JSON.stringify(newState) }, remaining: Math.max(0, remaining) };

}

// Consumes an active "Counter's Curse" flag (only ever applies to the
// very next count after it's triggered).
function consumeCurse(game) {

    const state = parseState(game);
    if (!state.cursedNext) return { game, wasCursed: false };

    const newState = { ...state };
    delete newState.cursedNext;

    db.prepare(`UPDATE numerology_games SET formula_state = ? WHERE id = ?`).run(JSON.stringify(newState), game.id);

    return { game: { ...game, formula_state: JSON.stringify(newState) }, wasCursed: true };

}

function daysSinceStart(game) {

    const started = new Date(game.started_at).getTime();
    const days = Math.floor((Date.now() - started) / (24 * 60 * 60 * 1000));
    return Math.max(1, days);

}

module.exports = {
    maybeTriggerChaosEvent,
    tickWarp,
    tickDivineWindow,
    consumeCurse
};
