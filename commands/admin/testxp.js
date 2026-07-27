const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");


const {
    addXP
} = require("../../services/xpService");

const { isBotAdmin } = require("../../services/adminService");


module.exports = {


    data: new SlashCommandBuilder()

        .setName("testxp")

        .setDescription("Test XP system"),



    async execute(interaction) {


        if (!isBotAdmin(interaction.member)) {

            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                flags: MessageFlags.Ephemeral
            });

        }


        const result = addXP(

            interaction.user.id,

            50

        );


        if (!result) {

            return interaction.reply(
                "❌ User not found"
            );

        }



        await interaction.reply(

            `⭐ Gained ${result.xpGained} XP!\n` +

            `Level: ${result.oldLevel} → ${result.newLevel}`

        );


    }

};