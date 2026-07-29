require("dotenv").config();

require("./database/database");

// Fails startup loudly with every problem listed if any activity's
// config is broken — catches the class of bug that crashed /hunt (and
// several related ones: empty outcome arrays, malformed reward ranges,
// mismatched chance totals) before the bot is ever reachable, instead
// of letting a live command discover it at 2am.
const { validateActivities } = require("./services/activityService");
validateActivities();

const {
    startScheduler
} = require("./services/schedulerService");

const { Client, GatewayIntentBits, Collection } = require("discord.js");

const { loadCommands } = require("./handlers/commandHandler");

const { loadEvents } = require("./handlers/eventHandler");

const LoreBroadcast = require("./schedulers/loreBroadcast");

const { cleanupExpiredCooldowns } = require("./services/casinoService");


process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    
    ]
});


client.commands = new Collection();


loadCommands(client);
loadEvents(client);


client.once("clientReady", () => {

    console.log(`🟢 WhisperBot online as ${client.user.tag}`);


    client.user.setPresence({
        activities: [
            {
                name: "WhisperSMP 🌎",
                type: 0
            }
        ],
        status: "online"
    });

    new LoreBroadcast(client);

    // Expired casino_cooldowns rows are already harmless (checkCooldown
    // ignores them), this just keeps the table from growing forever.
    setInterval(() => {
        const removed = cleanupExpiredCooldowns();
        if (removed > 0) console.log(`🧹 Cleaned up ${removed} expired casino cooldown(s).`);
    }, 60 * 60 * 1000);

});

startScheduler();

console.log("Starting WhisperBot...");


client.login(process.env.DISCORD_TOKEN);