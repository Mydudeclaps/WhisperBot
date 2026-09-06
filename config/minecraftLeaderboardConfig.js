const { MINECRAFT_LEADERBOARD_CHANNEL_ID } = require("./notificationConfig");

module.exports = {
    CHANNEL_ID: MINECRAFT_LEADERBOARD_CHANNEL_ID,
    GUILD_ID: process.env.GUILD_ID || "1478108083593941063",
    TIME_ZONE: "America/New_York",
    CRON_SCHEDULE: "0 21 * * *",
    WEGO_ECONOMY_DB_PATH: process.env.WEGO_ECONOMY_DB_PATH || "/minecraft/wegocore/economy.db",
    EBANKS_DB_PATH: process.env.EBANKS_DB_PATH || "/minecraft/ebanks/ebanks.db"
};
