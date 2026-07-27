const {
    SlashCommandBuilder
} = require("discord.js");

const {
    checkIn
} = require("../../services/dailyCheckinService");

const {
    giveLevelReward
} = require("../../services/rewardService");

const {
    dailyCheckinEmbed,
    dailyCheckinCooldownEmbed,
    levelUpEmbed
} = require("../../utils/embedFactory");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("here")
        .setDescription("📍 Check in for your daily reward"),

    async execute(interaction) {

        await interaction.deferReply();

        const userId = interaction.user.id;
        const username = interaction.user.username;

        const result = checkIn(userId, username);

        if (!result.success) {

            const { embed, files } = dailyCheckinCooldownEmbed(result.msUntilNext);

            return interaction.editReply({
                embeds: [embed],
                files
            });

        }

        const { embed, files } = dailyCheckinEmbed(
            username,
            result,
            interaction.user.displayAvatarURL()
        );

        await interaction.editReply({
            embeds: [embed],
            files
        });

        // If the XP from this check-in pushed the player up a level, follow
        // up with the same level-up embed/reward flow used elsewhere.
        if (result.levelResult && result.levelResult.leveledUp) {

            const reward = giveLevelReward(
                userId,
                result.levelResult.newLevel
            );

            await interaction.followUp({
                embeds: [
                    levelUpEmbed(
                        username,
                        result.levelResult.newLevel,
                        reward
                    )
                ]
            });

        }

    }

};
