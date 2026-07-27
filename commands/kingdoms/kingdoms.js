const {
    SlashCommandBuilder
} = require("discord.js");

const {
    kingdomsOverviewEmbed
} = require("../../utils/kingdomEmbeds");


module.exports = {

    data: new SlashCommandBuilder()

        .setName("kingdoms")

        .setDescription("View an overview of all four WhisperSMP kingdoms"),


    async execute(interaction) {

        await interaction.deferReply();

        const { embed, files } = kingdomsOverviewEmbed();

        return interaction.editReply({
            embeds: [embed],
            files
        });

    }

};
