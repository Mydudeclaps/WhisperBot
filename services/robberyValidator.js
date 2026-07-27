const { getCoins } = require("./coinService");
const { getUser } = require("./userService");
const { getRobberyStats } = require("./robberyLogger");
const { isLocked } = require("../utils/robberyUtils");

const ROB = require("../config/robberyConfig");


// Returns { valid: true } or { valid: false, reason: "..." }
function validateRobbery(robberId, robberUsername, victim, bet) {

    if (victim.id === robberId) {

        return { valid: false, reason: "You can't rob yourself!" };

    }

    if (victim.bot) {

        return { valid: false, reason: "You can't rob a bot!" };

    }

    if (isLocked(robberId)) {

        return { valid: false, reason: "You're already in the middle of a robbery!" };

    }

    if (isLocked(victim.id)) {

        return { valid: false, reason: `${victim.username} is already being targeted by someone else right now — try again in a bit.` };

    }

    const robber = getUser(robberId, robberUsername);
    const robberCoins = getCoins(robberId);

    if (bet < ROB.MIN_BET || bet > ROB.MAX_BET) {

        return {
            valid: false,
            reason: `Bet must be between ${ROB.MIN_BET.toLocaleString()} and ${ROB.MAX_BET.toLocaleString()} coins.`
        };

    }

    if (robberCoins < bet) {

        return {
            valid: false,
            reason: `You don't have enough coins to risk that bet! Your balance: ${robberCoins.toLocaleString()} coins.`
        };

    }

    if ((robber.kingdom_rep || 0) < ROB.MIN_ROBBER_REP) {

        return {
            valid: false,
            reason: `You need at least ${ROB.MIN_ROBBER_REP.toLocaleString()} reputation to attempt a robbery.`
        };

    }

    const victimCoins = getCoins(victim.id);

    if (victimCoins < ROB.MIN_VICTIM_CASH) {

        return {
            valid: false,
            reason: `${victim.username} doesn't have enough coins to be worth robbing (needs at least ${ROB.MIN_VICTIM_CASH.toLocaleString()}).`
        };

    }

    const stats = getRobberyStats(robberId);

    if (stats.cooldown_until) {

        const cooldownMs = new Date(stats.cooldown_until).getTime() - Date.now();

        if (cooldownMs > 0) {

            const minutes = Math.ceil(cooldownMs / 60000);

            return {
                valid: false,
                reason: `You're laying low after your last attempt. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
            };

        }

    }

    return { valid: true };

}


module.exports = {

    validateRobbery

};
