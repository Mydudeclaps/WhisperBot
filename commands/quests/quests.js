const {
    SlashCommandBuilder
} = require("discord.js");


const {
    questListEmbed
} = require("../../utils/embedFactory");


const quests =
require("../../data/quests");


module.exports = {


    data: new SlashCommandBuilder()

        .setName("quests")

        .setDescription("View available WhisperBot quests"),


    async execute(interaction) {

        await interaction.deferReply();

        const { embed, files } = questListEmbed(Object.values(quests));

        await interaction.editReply({
            embeds: [embed],
            files
        });

    }


};
