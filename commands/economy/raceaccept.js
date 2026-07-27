const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const { raceStatusEmbed } = require("../../utils/embedFactory");
const { hasEnoughCoins, getCoins } = require("../../services/coinService");
const { getUser } = require("../../services/userService");

const {
    hasActiveDailyMission,
    getPendingChallengeFor,
    acceptRace
} = require("../../services/raceService");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("raceaccept")
        .setDescription("🏆 Accept a pending daily race challenge"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const race = getPendingChallengeFor(userId);

        if (!race) {

            return interaction.reply({
                content: "❌ You don't have a pending race challenge to accept.",
                flags: MessageFlags.Ephemeral
            });

        }

        if (!hasEnoughCoins(userId, race.bet_amount)) {

            return interaction.reply({
                content: `❌ You don't have enough coins to accept! Needed: ${race.bet_amount.toLocaleString()}, you have: ${getCoins(userId).toLocaleString()}.`,
                flags: MessageFlags.Ephemeral
            });

        }

        if (!hasActiveDailyMission(userId)) {

            return interaction.reply({
                content: "❌ You need at least one active daily mission to race! Use `/daily` first.",
                flags: MessageFlags.Ephemeral
            });

        }

        acceptRace(race.id, username);

        await interaction.deferReply();

        const { embed, files } = raceStatusEmbed(
            "🏁 Race Accepted!",
            `The race is on for **${race.bet_amount.toLocaleString()} coins**! Whoever completes more daily missions before reset wins the pot.`
        );

        await interaction.editReply({
            embeds: [embed],
            files
        });

    }

};
