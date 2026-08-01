const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const { raceChallengeEmbed } = require("../../utils/embedFactory");
const { hasEnoughCoins, getCoins } = require("../../services/coinService");
const { getUser } = require("../../services/userService");
const { RACEBET } = require("../../config/gameConfig");

const {
    hasActiveDailyMission,
    getPendingChallengeFor,
    getPendingChallengeFrom,
    createRace
} = require("../../services/raceService");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("racebet")
        .setDescription("🏆 Challenge another player to a daily mission race")
        .addUserOption(option =>
            option
                .setName("opponent")
                .setDescription("Who are you challenging?")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription(`Bet amount (${RACEBET.MIN_BET.toLocaleString()}-${RACEBET.MAX_BET.toLocaleString()} coins)`)
                .setRequired(true)
                .setMinValue(RACEBET.MIN_BET)
                .setMaxValue(RACEBET.MAX_BET)
        ),

    async execute(interaction) {

        const challenger = interaction.user;
        const opponent = interaction.options.getUser("opponent");
        const amount = interaction.options.getInteger("amount");

        getUser(challenger.id, challenger.username);

        if (opponent.id === challenger.id) {

            return interaction.reply({
                content: "❌ You can't bet against yourself!",
                flags: MessageFlags.Ephemeral
            });

        }

        if (opponent.bot) {

            return interaction.reply({
                content: "❌ You can't challenge a bot!",
                flags: MessageFlags.Ephemeral
            });

        }

        if (!hasEnoughCoins(challenger.id, amount)) {

            return interaction.reply({
                content: `❌ You don't have enough coins! Your balance: ${getCoins(challenger.id).toLocaleString()} coins.`,
                flags: MessageFlags.Ephemeral
            });

        }

        if (!hasActiveDailyMission(challenger.id)) {

            return interaction.reply({
                content: "❌ You need at least one active daily mission to start a race! Use `/daily` first.",
                flags: MessageFlags.Ephemeral
            });

        }

        if (getPendingChallengeFrom(challenger.id)) {

            return interaction.reply({
                content: "❌ You already have a pending race challenge!",
                flags: MessageFlags.Ephemeral
            });

        }

        if (getPendingChallengeFor(opponent.id)) {

            return interaction.reply({
                content: `❌ ${opponent.username} already has a pending race challenge!`,
                flags: MessageFlags.Ephemeral
            });

        }

        getUser(opponent.id, opponent.username);

        createRace(challenger.id, opponent.id, amount);

        await interaction.deferReply();

        const { embed, files } = raceChallengeEmbed(challenger.username, amount);

        await interaction.editReply({
            content: `${opponent}`,
            embeds: [embed],
            files
        });

    }

};
