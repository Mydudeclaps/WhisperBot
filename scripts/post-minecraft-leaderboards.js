require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const { loadDiscordToken } = require("../config/discordCredentials");
const leaderboardConfig = require("../config/minecraftLeaderboardConfig");
const {
    buildLeaderboardPayload,
    postLeaderboards,
    readMinecraftData
} = require("../services/minecraftLeaderboardService");

const token = loadDiscordToken();
if (!token) throw new Error("Missing Discord token");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const editIndex = process.argv.indexOf("--edit");
const editMessageId = editIndex >= 0 ? process.argv[editIndex + 1] : null;

client.once("clientReady", async () => {
    try {
        if (editMessageId) {
            const channel = await client.channels.fetch(leaderboardConfig.CHANNEL_ID);
            if (!channel?.isTextBased() || channel.guildId !== leaderboardConfig.GUILD_ID) {
                throw new Error("Configured leaderboard destination is not an approved text channel");
            }
            const message = await channel.messages.fetch(editMessageId);
            if (message.author.id !== client.user.id) {
                throw new Error("Refusing to edit a message not authored by Whisperbot");
            }
            const payload = buildLeaderboardPayload(readMinecraftData(), { preview: true });
            payload.attachments = [];
            await message.edit(payload);
            console.log(`Preview message ${message.id} updated.`);
            client.destroy();
            process.exit(0);
        }

        const result = await postLeaderboards(client, { preview: true });
        console.log(`Preview posted as message ${result.messageId}.`);
        client.destroy();
        process.exit(0);
    } catch (error) {
        console.error("Leaderboard preview failed:", error);
        client.destroy();
        process.exit(1);
    }
});

client.login(token).catch(error => {
    console.error("Discord login failed:", error.message);
    process.exit(1);
});
