const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const {
    incrementStat
} = require("../../services/statsService");

const {
    updateMissionProgress
} = require("../../services/dailyProgressService");

const { isBotAdmin } = require("../../services/adminService");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("testvoice")
        .setDescription("Adds voice minutes for testing.")
        .addIntegerOption(option =>
            option
                .setName("minutes")
                .setDescription("Minutes to add")
                .setRequired(true)
        ),

    async execute(interaction) {

        if (!isBotAdmin(interaction.member)) {

            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                flags: MessageFlags.Ephemeral
            });

        }

        const minutes =
            interaction.options.getInteger("minutes");

        incrementStat(
            interaction.user.id,
            "voice_minutes",
            minutes
        );

        await updateMissionProgress(
            interaction.user.id,
            "voice_minutes",
            minutes,
            interaction.channel
        );

        await interaction.reply({
            content: `✅ Added **${minutes}** voice minutes for testing.`,
            flags: MessageFlags.Ephemeral
        });

    }

};