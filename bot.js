require("dotenv").config();

const { loadDiscordToken } = require("./config/discordCredentials");
const discordToken = loadDiscordToken();

if (!discordToken) {
    console.error("Missing Discord token: set DISCORD_TOKEN or DISCORD_TOKEN_FILE");
    process.exit(1);
}

const db = require("./database/database");

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

const { Client, GatewayIntentBits, Collection, Partials } = require("discord.js");

const { loadCommands } = require("./handlers/commandHandler");

const { loadEvents } = require("./handlers/eventHandler");

const LoreBroadcast = require("./schedulers/loreBroadcast");

const { cleanupExpiredCooldowns } = require("./services/casinoService");
const {
    markStarting,
    markReady,
    markStopping
} = require("./services/runtimeHealthService");


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
        GatewayIntentBits.GuildMessageReactions,
        // Required for /rob's victim-response DM flow: without this intent
        // (and the Channel partial below), DM channels the bot didn't
        // originate stay "partial"/uncached, and button interactions sent
        // back from inside them can fail to resolve through
        // Message#awaitMessageComponent() — the DM sends fine, but the
        // victim's click on Defend/Run/etc. never reaches the collector.
        // See docs/updates/ for the robbery-system audit that traced this.
        GatewayIntentBits.DirectMessages

    ],
    partials: [
        Partials.Channel
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

    startScheduler();

    // Expired casino_cooldowns rows are already harmless (checkCooldown
    // ignores them), this just keeps the table from growing forever.
    setInterval(() => {
        const removed = cleanupExpiredCooldowns();
        if (removed > 0) console.log(`🧹 Cleaned up ${removed} expired casino cooldown(s).`);
    }, 60 * 60 * 1000);

    markReady({
        botTag: client.user.tag,
        guildCount: client.guilds.cache.size
    });

});

console.log("Starting WhisperBot...");

markStarting();

let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Received ${signal}; shutting down WhisperBot...`);
    markStopping();
    client.destroy();
    db.close();
    process.exit(0);
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

client.login(discordToken).catch(error => {
    console.error("Discord login failed:", error.message);
    process.exit(1);
});
