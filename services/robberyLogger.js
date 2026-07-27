const db = require("../database/database");
const ROB = require("../config/robberyConfig");


function ensureRow(userId) {

    db.prepare(`
        INSERT OR IGNORE INTO robbery_stats (user_id, last_heat_decay)
        VALUES (?, ?)
    `).run(userId, new Date().toISOString());

}


// Reads a user's robbery stats, lazily decaying heat by one level for
// every full HEAT_RESET_TIME period that's passed since the last decay —
// so heat cools off over time without needing a background job.
function getRobberyStats(userId) {

    ensureRow(userId);

    const row = db.prepare(
        "SELECT * FROM robbery_stats WHERE user_id = ?"
    ).get(userId);

    const lastDecay = row.last_heat_decay
        ? new Date(row.last_heat_decay).getTime()
        : Date.now();

    const periodsElapsed = Math.floor(
        (Date.now() - lastDecay) / (ROB.HEAT_RESET_TIME * 1000)
    );

    if (periodsElapsed > 0 && row.heat > 0) {

        const decayedHeat = Math.max(0, row.heat - periodsElapsed);

        db.prepare(`
            UPDATE robbery_stats
            SET heat = ?, last_heat_decay = ?
            WHERE user_id = ?
        `).run(decayedHeat, new Date().toISOString(), userId);

        row.heat = decayedHeat;
        row.last_heat_decay = new Date().toISOString();

    }

    return row;

}


// Applies the results of a resolved robbery to the robber's heat/streak/
// cooldown. `heatDelta` and `streakReset` are decided by the caller based
// on the outcome (see robberyCalculator's outcome table).
function applyRobberyResult(userId, { heatDelta, streakReset, cooldownSeconds }) {

    ensureRow(userId);

    const cooldownUntil = new Date(
        Date.now() + cooldownSeconds * 1000
    ).toISOString();

    if (streakReset) {

        db.prepare(`
            UPDATE robbery_stats
            SET heat = MAX(0, heat + ?),
                streak = 0,
                cooldown_until = ?
            WHERE user_id = ?
        `).run(heatDelta, cooldownUntil, userId);

    } else {

        db.prepare(`
            UPDATE robbery_stats
            SET heat = MAX(0, heat + ?),
                streak = streak + 1,
                cooldown_until = ?
            WHERE user_id = ?
        `).run(heatDelta, cooldownUntil, userId);

    }

}


function logRobbery({
    robberId,
    victimId,
    betAmount,
    lootStolen,
    outcome,
    victimResponse,
    successChance,
    randomRoll
}) {

    db.prepare(`
        INSERT INTO robbery_logs
        (robber_id, victim_id, bet_amount, loot_stolen, outcome, victim_response, success_chance, random_roll, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        robberId,
        victimId,
        betAmount,
        lootStolen,
        outcome,
        victimResponse,
        Math.round(successChance * 100),
        Math.round(randomRoll * 100),
        new Date().toISOString()
    );

}


module.exports = {

    getRobberyStats,
    applyRobberyResult,
    logRobbery

};
