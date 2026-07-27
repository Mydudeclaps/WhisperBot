const { SlashCommandBuilder } = require("discord.js");

const { helpEmbed } = require("../../utils/embedFactory");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Shows available commands"),

    async execute(interaction) {

        await interaction.deferReply();

        const { embed, files } = helpEmbed();

        await interaction.editReply({
            embeds: [embed],
            files
        });

    }
};
