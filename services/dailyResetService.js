const db = require("../database/database");

const {
    assignDailyMissions
} = require("./dailyMissionService");

const {
    resolveDailyRaces
} = require("./raceService");

const {
    refreshLuckyNumber
} = require("./luckyNumberService");

function resetDailyMissions() {

    console.log("🌅 Resetting daily missions...");

    // Resolve any active race bets against today's mission counts
    // BEFORE the progress rows get wiped out below.
    const raceResults = resolveDailyRaces();

    if (raceResults.length) {
        console.log(`🏆 Resolved ${raceResults.length} daily race(s).`);
    }

    db.prepare(`
        DELETE FROM user_daily_missions
    `).run();

    console.log("✅ Old missions removed.");

    const luckyNumber = refreshLuckyNumber();
    console.log(`🎯 Casino lucky number is now ${luckyNumber}.`);

}

module.exports = {

    resetDailyMissions

};