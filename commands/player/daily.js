const {
    SlashCommandBuilder
} = require("discord.js");


const {
    dailyMissionEmbed
} = require("../../utils/embedFactory");


const {
    assignDailyMissionsIfNeeded
} = require("../../services/dailyAssignmentService");


const db = require("../../database/database");


const missions =
require("../../data/dailyMissions");



module.exports = {


    data: new SlashCommandBuilder()

        .setName("daily")

        .setDescription("View your daily missions"),



    async execute(interaction) {

        // Acknowledge immediately — see profile.js for why.
        await interaction.deferReply();


        const userId =
        interaction.user.id;



        // Give missions if player doesn't have today's missions
        assignDailyMissionsIfNeeded(
            userId
        );



        const activeMissions =
        db.prepare(`

            SELECT *

            FROM user_daily_missions

            WHERE user_id = ?

            AND assigned_date = ?

        `).all(

            userId,

            new Date().toDateString()

        );

        console.log(
            "DAILY MISSIONS FOUND:",
            activeMissions
        );



        const { embed, files } = dailyMissionEmbed(

            interaction.user.username,

            activeMissions,

            missions,

            interaction.user.displayAvatarURL()

        );

        await interaction.editReply({

            embeds: [embed],

            files

        });


    }


};