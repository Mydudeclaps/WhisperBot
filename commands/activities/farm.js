const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const { executeActivity, getActivity } = require("../../services/activityService");
const { activityResultEmbed, activityCooldownEmbed } = require("../../utils/embedFactory");
const { getUser } = require("../../services/userService");

const ACTIVITY_ID = "farm";


module.exports = {

    data: new SlashCommandBuilder()
        .setName("farm")
        .setDescription("🌾 Farm crops for a harvest"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        await interaction.deferReply();

        const result = executeActivity(userId, username, ACTIVITY_ID);

        if (result.error) {

            const config = getActivity(ACTIVITY_ID);
            const { embed, files } = activityCooldownEmbed(config.name, result.error, result.untilUnix);

            return interaction.editReply({ embeds: [embed], files });

        }

        const config = getActivity(ACTIVITY_ID);
        const { embed, files } = activityResultEmbed(username, config.name, result);

        await interaction.editReply({ embeds: [embed], files });

    }

};
