const ROB = require("../config/robberyConfig");


function tierValue(tiers, amount) {

    for (const tier of tiers) {

        if (amount >= tier.min)
            return tier.bonus !== undefined ? tier.bonus : tier.penalty;

    }

    return 0;

}


function reputationBonus(rep) {
    return tierValue(ROB.REPUTATION_TIERS, rep || 0);
}

function heatPenalty(heat) {
    return tierValue(ROB.HEAT_TIERS, heat || 0);
}

function streakBonus(streak) {
    return tierValue(ROB.STREAK_TIERS, streak || 0);
}


function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


// Success chance BEFORE any witness roll — shown as the "estimate" during
// the scan phase, and reused (with a possible witness penalty added on
// top) when the real outcome is rolled.
function estimateSuccessChance({ robberRep, victimRep, heat, streak, victimResponse }) {

    let chance = ROB.BASE_SUCCESS_CHANCE;

    chance += reputationBonus(robberRep);
    chance -= reputationBonus(victimRep);
    chance -= heatPenalty(heat);
    chance += streakBonus(streak);

    if (victimResponse === "defend")
        chance -= ROB.VICTIM_DEFENSE_BONUS;

    if (victimResponse === "look_around")
        chance -= ROB.LOOK_AROUND_PENALTY;

    // Never fully guaranteed either way.
    return clamp(chance, 0.05, 0.95);

}


function estimateLootRange(victimCoins) {

    const min = Math.max(
        ROB.MIN_STEAL,
        Math.round(victimCoins * ROB.STEAL_PERCENTAGE_MIN)
    );

    const max = Math.min(
        ROB.MAX_STEAL_CAP,
        Math.round(victimCoins * ROB.STEAL_PERCENTAGE_MAX)
    );

    return { min, max: Math.max(min, max) };

}


// Runs the full weighted outcome pipeline for a resolved robbery attempt.
// Returns an outcome id plus everything needed to apply its effects:
//   { outcome, loot, heatDelta, streakReset, cooldownSeconds,
//     successChance, randomRoll, fine }
function resolveRobbery({
    robberRep,
    victimRep,
    heat,
    streak,
    victimResponse,
    victimCoins,
    bet
}) {

    // Run — the victim may simply get away before any of the rest matters.
    if (victimResponse === "run" && Math.random() < ROB.RUN_ESCAPE_CHANCE) {

        return {
            outcome: "escaped",
            loot: 0,
            heatDelta: 0,
            streakReset: true,
            cooldownSeconds: ROB.COOLDOWN,
            successChance: 0,
            randomRoll: 0,
            fine: 0
        };

    }

    // Arrest — a flat independent chance regardless of anything else.
    if (Math.random() < ROB.ARREST_CHANCE) {

        const fine = ROB.ARREST_FINE_BASE + (heat || 0) * ROB.ARREST_FINE_PER_HEAT;

        return {
            outcome: "arrested",
            loot: 0,
            heatDelta: 2,
            streakReset: true,
            cooldownSeconds: ROB.ARRESTED_COOLDOWN,
            successChance: 0,
            randomRoll: 0,
            fine
        };

    }

    // Witness — may shave off success chance, and rarely escalates straight
    // to an arrest (reported to the authorities).
    let witnessPenalty = 0;

    if (Math.random() < ROB.WITNESS_CHANCE) {

        witnessPenalty = ROB.WITNESS_PENALTY;

        if (Math.random() < ROB.WITNESS_REPORT_CHANCE) {

            const fine = (ROB.ARREST_FINE_BASE + (heat || 0) * ROB.ARREST_FINE_PER_HEAT) * 2;

            return {
                outcome: "arrested",
                loot: 0,
                heatDelta: 2,
                streakReset: true,
                cooldownSeconds: ROB.ARRESTED_COOLDOWN,
                successChance: 0,
                randomRoll: 0,
                fine
            };

        }

    }

    const successChance = clamp(
        estimateSuccessChance({ robberRep, victimRep, heat, streak, victimResponse }) - witnessPenalty,
        0.05,
        0.95
    );

    const roll = Math.random();
    const succeeded = roll < successChance;

    if (!succeeded) {

        if (victimResponse === "defend") {

            const lostAmount = Math.round(bet * ROB.VICTIM_DEFEND_RECOVERY);

            return {
                outcome: "defended",
                loot: -lostAmount, // negative = robber loses this to the victim
                heatDelta: 1,
                streakReset: true,
                cooldownSeconds: ROB.DEFENDED_COOLDOWN,
                successChance,
                randomRoll: roll,
                fine: 0
            };

        }

        return {
            outcome: "escaped",
            loot: 0,
            heatDelta: 0,
            streakReset: true,
            cooldownSeconds: ROB.COOLDOWN,
            successChance,
            randomRoll: roll,
            fine: 0
        };

    }

    // Success — decide which flavor of success this is.
    if (Math.random() < ROB.TREASURE_CHANCE) {

        return {
            outcome: "hidden_cash",
            loot: 40000,
            heatDelta: 1,
            streakReset: false,
            cooldownSeconds: ROB.COOLDOWN,
            successChance,
            randomRoll: roll,
            fine: 0
        };

    }

    if (victimCoins < ROB.MIN_VICTIM_CASH * 2 && Math.random() < ROB.WALLET_EMPTY_CHANCE) {

        return {
            outcome: "wallet_empty",
            loot: 27,
            heatDelta: 1,
            streakReset: false,
            cooldownSeconds: ROB.COOLDOWN,
            successChance,
            randomRoll: roll,
            fine: 0
        };

    }

    const { min, max } = estimateLootRange(victimCoins);
    const loot = Math.round(min + Math.random() * (max - min));

    const isPerfect = witnessPenalty === 0 && Math.random() < ROB.PERFECT_CHANCE;

    return {
        outcome: isPerfect ? "perfect" : "success",
        loot,
        heatDelta: isPerfect ? 0 : 1,
        streakReset: false,
        cooldownSeconds: ROB.COOLDOWN,
        successChance,
        randomRoll: roll,
        fine: 0
    };

}


module.exports = {

    reputationBonus,
    heatPenalty,
    streakBonus,
    estimateSuccessChance,
    estimateLootRange,
    resolveRobbery

};
