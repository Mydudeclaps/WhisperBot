const { SlashCommandBuilder } = require("discord.js");
const { infoEmbed, withThumbnailAndBanner } = require("../../utils/embedFactory");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("🛜Checks WhisperBot latency"),


    async execute(interaction) {

        const start = Date.now();

        await interaction.reply({
            content: "🏓 Checking..."
        });


        const latency = Date.now() - start;
        const apiLatency = interaction.client.ws.ping;


        let emoji = "🟢";

        if (latency > 200) emoji = "🟡";
        if (latency > 500) emoji = "🟠";
        if (latency > 1000) emoji = "🔴";


        const time = new Date().toLocaleTimeString();


        const embed = infoEmbed(
            "🏓 Pong!",
            `🤖 **Bot Latency:** ${latency}ms ${emoji}\n` +
            `📡 **API Latency:** ${apiLatency}ms\n` +
            `📊 **Difference:** ${Math.abs(latency - apiLatency)}ms\n` +
            `🕐 **Time:** ${time}`
        );

         // Add thumbnail + banner using the helper
        const { embed: finalEmbed, files } = withThumbnailAndBanner(embed, "ping");

        await interaction.editReply({
            content: "",
            embeds: [finalEmbed],
            files: files || []
        });

    }

};