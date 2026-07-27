const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getStat } = require("../../services/statsService");
const { withThumbnailAndBanner } = require("../../utils/embedFactory");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("View your WhisperBot statistics"),

    async execute(interaction) {

        await interaction.deferReply();

        const userId = interaction.user.id;

        const messages = getStat(userId, "messages_sent");
        const reactions = getStat(userId, "reactions_received");
        const voice = getStat(userId, "voice_minutes");
        const quests = getStat(userId, "quests_completed");

        // Create the embed
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📊 ${interaction.user.username}'s Statistics`)
            .addFields(
                { name: "💬 Messages", value: messages.toString(), inline: true },
                { name: "🎙️ Voice Minutes", value: voice.toString(), inline: true },
                { name: "📜 Quests Completed", value: quests.toString(), inline: true },
                { name: "👍 Reactions Received", value: reactions.toString(), inline: true }
            )
            .setTimestamp();

        // Add thumbnail + banner using the helper
        const { embed: finalEmbed, files } = withThumbnailAndBanner(embed, "stats");

        await interaction.editReply({
            embeds: [finalEmbed],
            files: files || []
        });

    }

};