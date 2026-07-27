// Progressive casino jackpot. Stored via the existing settingsService
// (bot_settings table) rather than a dedicated table — it's a single
// running number, exactly what that table is for.
const { getSetting, setSetting } = require("./settingsService");
const { JACKPOT } = require("../config/gameConfig");

const SETTING_KEY = "casino_jackpot";

function getJackpot() {

    const stored = getSetting(SETTING_KEY);

    if (stored === null) {
        setSetting(SETTING_KEY, String(JACKPOT.BASE_AMOUNT));
        return JACKPOT.BASE_AMOUNT;
    }

    const value = parseInt(stored, 10);
    return Number.isFinite(value) ? value : JACKPOT.BASE_AMOUNT;

}

// Adds 1% (JACKPOT.CONTRIBUTION_RATE) of a bet to the jackpot. Call this
// once per real bet placed in any casino game, regardless of outcome.
function contribute(betAmount) {

    const current = getJackpot();
    const added = Math.max(1, Math.floor(betAmount * JACKPOT.CONTRIBUTION_RATE));
    const updated = current + added;

    setSetting(SETTING_KEY, String(updated));

    return updated;

}

// Small per-bet chance of hitting the jackpot outright. Call once per bet;
// if true, the caller should pay out getJackpot() and then call
// winJackpot() to reset it.
function rollJackpot() {

    return Math.random() < JACKPOT.TRIGGER_CHANCE;

}

// Pays out and resets the jackpot to its base amount. Returns the amount
// that was won (call this BEFORE resetting, or capture the return value —
// it returns the pre-reset amount either way).
function winJackpot() {

    const amount = getJackpot();

    setSetting(SETTING_KEY, String(JACKPOT.BASE_AMOUNT));

    return amount;

}

module.exports = {
    getJackpot,
    contribute,
    rollJackpot,
    winJackpot
};
