const { MessageFlags } = require("discord.js");

const { getCrate } = require("../config/crateConfig");
const { openCrate } = require("../services/crateService");
const {
    crateOpenedEmbed,
    crateNoKeyEmbed,
    crateErrorEmbed
} = require("./embedFactory");
const { buildCrateOpenRow } = require("./crateComponents");

async function handleCrateButton(interaction) {
    const [, ownerId] = interaction.customId.split(":");

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: "❌ That crate chamber belongs to another traveler.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferUpdate();

    const crate = getCrate("whisper");

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
                attachments: [],
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
            attachments: [],
            files,
            components: [buildCrateOpenRow(
                interaction.user.id,
                result.keyBalance < 1
            )]
        });
    } catch (error) {
        console.error("Crate button error:", error);
        const { embed, files } = crateErrorEmbed("transaction_failed");
        await interaction.editReply({
            embeds: [embed],
            attachments: [],
            files,
            components: []
        });
    }
}

module.exports = handleCrateButton;
