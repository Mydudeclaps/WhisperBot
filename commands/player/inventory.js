const {
    SlashCommandBuilder
} = require("discord.js");


const {
    getInventory
} = require("../../services/inventoryService");

const {
    inventoryEmbed
} = require("../../utils/embedFactory");



module.exports = {


    data: new SlashCommandBuilder()

        .setName("inventory")

        .setDescription("View your WhisperSMP inventory"),



    async execute(interaction) {

        await interaction.deferReply();

        const items =
            getInventory(
                interaction.user.id
            );


        const { embed, files } = inventoryEmbed(
            interaction.user.username,
            items,
            interaction.user.displayAvatarURL()
        );

        await interaction.editReply({
            embeds: [embed],
            files
        });


    }


};
