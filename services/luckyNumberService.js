// Daily lucky number (0-36, matches roulette's range) shown on the casino
// hub. Refreshes automatically once per calendar day — either via the
// explicit refresh hook in dailyResetService, or lazily the first time
// getLuckyNumber() is called on a new day (so it self-heals even if the
// scheduler was offline at midnight).
const { getSetting, setSetting } = require("./settingsService");

const NUMBER_KEY = "casino_lucky_number";
const DATE_KEY = "casino_lucky_number_date";

function refreshLuckyNumber() {

    const number = Math.floor(Math.random() * 37); // 0-36

    setSetting(NUMBER_KEY, String(number));
    setSetting(DATE_KEY, new Date().toDateString());

    return number;

}

function getLuckyNumber() {

    const today = new Date().toDateString();
    const storedDate = getSetting(DATE_KEY);

    if (storedDate !== today) {
        return refreshLuckyNumber();
    }

    const stored = getSetting(NUMBER_KEY);
    const value = stored !== null ? parseInt(stored, 10) : NaN;

    return Number.isFinite(value) ? value : refreshLuckyNumber();

}

module.exports = {
    getLuckyNumber,
    refreshLuckyNumber
};
