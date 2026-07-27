const {
    isDeveloper
} = require("../../services/devService");

const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const {
    resetDailyMissions
} = require("../../services/dailyResetService");

const {
    assignDailyMissions
} = require("../../services/dailyMissionService");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("resetdaily")
        .setDescription("Resets all daily missions (Admin Test)"),

    async execute(interaction) {


        if (!isDeveloper(interaction.user.id)) {

            return interaction.reply({

                content:"❌ You do not have permission to use this.",

                ephemeral:true

            });

        }

        resetDailyMissions();

        assignDailyMissions(interaction.user.id);

        await interaction.reply({

            content: "✅ Daily missions have been reset and reassigned.",

            flags: MessageFlags.Ephemeral

            

        });

    }

};