const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const { raceStatusEmbed } = require("../../utils/embedFactory");
const { COLORS } = require("../../config/constants");
const { getUser } = require("../../services/userService");

const {
    getPendingChallengeFor,
    declineRace
} = require("../../services/raceService");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("racedecline")
        .setDescription("🏆 Decline a pending daily race challenge"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const race = getPendingChallengeFor(userId);

        if (!race) {

            return interaction.reply({
                content: "❌ You don't have a pending race challenge to decline.",
                flags: MessageFlags.Ephemeral
            });

        }

        declineRace(race.id);

        await interaction.deferReply();

        const { embed, files } = raceStatusEmbed(
            "🚫 Race Declined",
            "You declined the race challenge. The challenger's coins have been returned.",
            COLORS.ERROR
        );

        await interaction.editReply({
            embeds: [embed],
            files
        });

    }

};
