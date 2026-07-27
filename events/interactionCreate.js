const { MessageFlags } = require("discord.js");

const logger = require("../utils/logger");
const handleLoreButton = require("../utils/loreInteractionHandler");
const handleCasinoButton = require("../utils/casinoInteractionHandler");
const handleTicPvpButton = require("../utils/ticPvpInteractionHandler");

module.exports = {
    name: "interactionCreate",

    async execute(interaction) {

        if (interaction.isButton() && interaction.customId.startsWith("lore_")) {

            try {
                await handleLoreButton(interaction);
            } catch (error) {
                console.error("Lore button error:", error);
            }

            return;

        }

        if (interaction.isButton() && (
            interaction.customId.startsWith("tic_accept_") ||
            interaction.customId.startsWith("tic_decline_") ||
            interaction.customId.startsWith("tic_pvp_move_")
        )) {

            try {
                await handleTicPvpButton(interaction);
            } catch (error) {
                console.error("Tic PvP button error:", error);
            }

            return;

        }

        if (interaction.isButton() && interaction.customId.startsWith("casino_")) {

            try {
                await handleCasinoButton(interaction);
            } catch (error) {
                console.error("Casino button error:", error);
            }

            return;

        }

        // Context menu commands (right-click -> Apps -> ...) use the same
        // dispatch path as slash commands below — same Map lookup by
        // commandName, same command.execute(interaction) call, same error
        // handling. They were never actually reachable before this check
        // included isUserContextMenuCommand(): every context menu command
        // would register with Discord and show up in the menu just fine,
        // but clicking one hit this early return and the bot would never
        // even acknowledge the interaction, appearing as "This
        // interaction failed" to the user with no server-side error at
        // all to debug from.
        if (!interaction.isChatInputCommand() && !interaction.isUserContextMenuCommand()) return;

        console.log(`Command received: ${interaction.commandName}`);


        const command = interaction.client.commands.get(
            interaction.commandName
        );


        if (!command) {
            console.log("Command not found");
            return;
        }


        try {

        const invocation = interaction.isChatInputCommand()
            ? `/${command.data.name}`
            : `${command.data.name} (context menu)`;

        logger.command(
            `${interaction.user.username} used ${invocation}`
        );


        await command.execute(interaction);

        } catch (error) {

            console.error("Command error:", error);

            try {

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: "❌ Command error occurred."
                    });
                } else {
                    await interaction.reply({
                        content: "❌ Command error occurred.",
                        flags: MessageFlags.Ephemeral
                    });
                }

            } catch (fallbackError) {

                // The interaction token may already be dead (e.g. it took
                // longer than 3s to get here, or a brief reconnect
                // happened). Nothing more we can do for this interaction —
                // log it and move on instead of crashing the process.
                console.error(
                    "Failed to send command error fallback reply:",
                    fallbackError.message
                );

            }

        }

    }
};