const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

const { getCrate } = require("../../config/crateConfig");
const {
    getKeyBalance,
} = require("../../services/crateService");
const { deliverMinecraftCrateKey } = require("../../services/minecraftCrateDeliveryService");
const {
    crateOverviewEmbed,
    crateOpenedEmbed,
    crateNoKeyEmbed,
    crateErrorEmbed
} = require("../../utils/embedFactory");
const { buildCrateOpenRow } = require("../../utils/crateComponents");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("crate")
        .setDescription("View rewards or send a Discord crate key to Minecraft")
        .addSubcommand(subcommand => subcommand
            .setName("view")
            .setDescription("View your keys, rewards, and drop rates"))
        .addSubcommand(subcommand => subcommand
            .setName("open")
            .setDescription("Send one key to your linked Minecraft account")),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const crate = getCrate("whisper");
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "view") {
            const keyBalance = getKeyBalance(interaction.user.id, crate.keyType);
            const { embed, files } = crateOverviewEmbed(
                interaction.user.username,
                crate,
                keyBalance
            );

            await interaction.editReply({
                embeds: [embed],
                files,
                components: [buildCrateOpenRow(interaction.user.id, keyBalance < 1)]
            });
            return;
        }

        try {
            const result = await deliverMinecraftCrateKey({
                userId: interaction.user.id,
                guildId: interaction.guildId,
                interactionId: interaction.id
            });

            if (!result.success) {
                const view = result.reason === "no_key"
                    ? crateNoKeyEmbed(crate)
                    : crateErrorEmbed(result.reason, crate);

                await interaction.editReply({
                    embeds: [view.embed],
                    files: view.files,
                    components: []
                });
                return;
            }

            const { embed, files } = crateOpenedEmbed(
                interaction.user.username,
                result
            );

            await interaction.editReply({
                embeds: [embed],
                files,
                components: [buildCrateOpenRow(
                    interaction.user.id,
                    result.keyBalance < 1
                )]
            });
        } catch (error) {
            console.error("[crate] opening failed:", error);
            const { embed, files } = crateErrorEmbed("delivery_pending", crate);
            await interaction.editReply({ embeds: [embed], files, components: [] });
        }
    }
};
