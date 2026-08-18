const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

const { getCrate } = require("../../config/crateConfig");
const {
    getKeyBalance,
    openCrate
} = require("../../services/crateService");
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
        .setDescription("Enter the Discord Whisper Crate chamber")
        .addSubcommand(subcommand => subcommand
            .setName("view")
            .setDescription("View your keys, rewards, and drop rates"))
        .addSubcommand(subcommand => subcommand
            .setName("open")
            .setDescription("Use one key to open the Whisper Crate")),

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
            const result = openCrate({
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: interaction.guildId,
                interactionId: interaction.id,
                keyType: crate.keyType
            });

            if (!result.success) {
                const view = result.reason === "no_key"
                    ? crateNoKeyEmbed(crate)
                    : crateErrorEmbed(result.reason);

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
            const { embed, files } = crateErrorEmbed("transaction_failed");
            await interaction.editReply({ embeds: [embed], files, components: [] });
        }
    }
};
