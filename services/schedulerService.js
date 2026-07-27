const {
    resetDailyMissions
} = require("./dailyResetService");

const {
    getSetting,
    setSetting
} = require("./settingsService");


let lastResetDate =
    getSetting("last_daily_reset");


function startScheduler() {

    console.log("🕒 Scheduler started.");


    const today =
        new Date().toDateString();


    // If the bot was offline during midnight,
    // reset missions when it starts back up.
    if (lastResetDate !== today) {

        console.log("📅 Daily reset needed.");

        resetDailyMissions();

        lastResetDate = today;

        setSetting(
            "last_daily_reset",
            today
        );

    }


    // Check every minute for midnight
    setInterval(() => {

        const now = new Date();

        const today =
            now.toDateString();

        if (

            now.getHours() === 0 &&
            now.getMinutes() === 0 &&
            lastResetDate !== today

        ) {

            console.log("🌅 Midnight reached.");

            resetDailyMissions();

            lastResetDate = today;

            setSetting(
                "last_daily_reset",
                today
            );

        }

    }, 60000);

}


module.exports = {

    startScheduler

};