const { SlashCommandBuilder } = require("discord.js");

const { executeActivity } = require("../../services/activityService");
const { activityResultEmbed, activityCooldownEmbed } = require("../../utils/embedFactory");
const { getUser } = require("../../services/userService");

const ACTIVITY_ID = "mine";


module.exports = {

    data: new SlashCommandBuilder()
        .setName("mine")
        .setDescription("⛏️ Mine for valuable resources"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        await interaction.deferReply();

        const result = executeActivity(userId, username, ACTIVITY_ID);

        if (result.error) {

            const { embed, files } = activityCooldownEmbed(result.name, result.error, result.untilUnix);

            return interaction.editReply({ embeds: [embed], files });

        }

        const { embed, files } = activityResultEmbed(username, result.name, result);

        await interaction.editReply({ embeds: [embed], files });

    }

};
