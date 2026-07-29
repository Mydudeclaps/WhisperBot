const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { isBotAdmin } = require("../../services/adminService");

const {
    getActiveGameByChannel,
    startGame,
    stopGame,
    resetGame
} = require("../../services/numerologyService");

const { getGameStats, getGlobalLeaderboard } = require("../../services/numerologyStats");

const {
    dashboardEmbed,
    dashboardButtons,
    modeSelectRow,
    customFormulaSelectRow,
    setupSummaryEmbed,
    setupButtonsRow,
    statsEmbed
} = require("../../utils/numerologyEmbeds");

const { MODES, CHANNEL_ID } = require("../../config/numerologyConfig");

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes idle, same as the embed builder admin tool
const MODAL_TIMEOUT = 5 * 60 * 1000;


module.exports = {

    data: new SlashCommandBuilder()
        .setName("numerology")
        .setDescription("🔢 Numerology admin controls (staff only)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName("admin").setDescription("Open the Numerology Control Center")),

    async execute(interaction) {

        if (!interaction.guild) {
            return interaction.reply({ content: "❌ This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        }

        if (!isBotAdmin(interaction.member)) {
            return interaction.reply({ content: "❌ You need Administrator permission (or an approved admin role) to use Numerology admin controls.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.guild.id;

        const renderDashboard = () => {

            const game = getActiveGameByChannel(CHANNEL_ID);
            const stats = game ? getGameStats(game.id) : { topCounters: [] };

            const { embed, files } = dashboardEmbed(game, stats);

            return { embeds: [embed], files, components: dashboardButtons(!!game) };

        };

        await interaction.editReply(renderDashboard());
        let message = await interaction.fetchReply();

        // Setup draft state — persists across the Settings flow until
        // Start Game or Cancel.
        let draft = { mode: null, formula: null, startNumber: 0, goalNumber: null };

        while (true) {

            let choice;

            try {

                choice = await message.awaitMessageComponent({
                    time: SESSION_TIMEOUT,
                    filter: i => i.user.id === interaction.user.id
                });

            } catch (err) {

                return interaction.editReply({ content: "⌛ Numerology admin session timed out.", embeds: [], components: [] });

            }

            if (choice.customId === "numerology_stop") {

                stopGame(CHANNEL_ID);
                await choice.update(renderDashboard());
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "numerology_reset") {

                resetGame(CHANNEL_ID, 0, null);
                await choice.update(renderDashboard());
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "numerology_stats") {

                const game = getActiveGameByChannel(CHANNEL_ID);
                const gameStats = game ? getGameStats(game.id) : null;
                const leaderboard = getGlobalLeaderboard(10);

                const { embed, files } = statsEmbed(gameStats, leaderboard);

                await choice.update({
                    embeds: [embed], files,
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("numerology_back").setLabel("⬅ Back").setStyle(ButtonStyle.Secondary)
                    )]
                });

                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "numerology_back") {

                await choice.update(renderDashboard());
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "numerology_start" || choice.customId === "numerology_settings") {

                draft = { mode: null, formula: null, startNumber: 0, goalNumber: null };

                const setupView = setupSummaryEmbed(draft);

                await choice.update({
                    embeds: [setupView.embed], files: setupView.files,
                    components: [modeSelectRow(draft.mode), setupButtonsRow(false)]
                });

                message = await interaction.fetchReply();

                let settingUp = true;

                while (settingUp) {

                    let setupChoice;

                    try {

                        setupChoice = await message.awaitMessageComponent({
                            time: SESSION_TIMEOUT,
                            filter: i => i.user.id === interaction.user.id
                        });

                    } catch (err) {

                        return interaction.editReply({ content: "⌛ Numerology setup timed out.", embeds: [], components: [] });

                    }

                    const rerender = async (extraRow = null) => {

                        const view = setupSummaryEmbed(draft);
                        const canStart = !!(draft.mode && (draft.mode !== "custom" || draft.formula));

                        const rows = [modeSelectRow(draft.mode)];
                        if (draft.mode === "custom") rows.push(customFormulaSelectRow(draft.formula));
                        rows.push(setupButtonsRow(canStart));

                        await setupChoice.update({ embeds: [view.embed], files: view.files, components: rows });
                        message = await interaction.fetchReply();

                    };

                    if (setupChoice.customId === "numerology_mode_select") {

                        draft.mode = setupChoice.values[0];
                        draft.formula = draft.mode === "custom" ? null : MODES[draft.mode].formula;
                        await rerender();
                        continue;

                    }

                    if (setupChoice.customId === "numerology_customformula_select") {

                        draft.formula = setupChoice.values[0];
                        await rerender();
                        continue;

                    }

                    if (setupChoice.customId === "numerology_cancel") {

                        await setupChoice.update(renderDashboard());
                        message = await interaction.fetchReply();
                        settingUp = false;
                        continue;

                    }

                    if (setupChoice.customId === "numerology_set_numbers") {

                        const modal = new ModalBuilder()
                            .setCustomId("numerology_numbers_modal")
                            .setTitle("Start & Goal Numbers");

                        const startInput = new TextInputBuilder()
                            .setCustomId("numerology_start_input")
                            .setLabel("Start Number (blank = 0)")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false);

                        const goalInput = new TextInputBuilder()
                            .setCustomId("numerology_goal_input")
                            .setLabel("Goal Number (blank = open-ended)")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false);

                        modal.addComponents(
                            new ActionRowBuilder().addComponents(startInput),
                            new ActionRowBuilder().addComponents(goalInput)
                        );

                        await setupChoice.showModal(modal);

                        try {

                            const modalSubmit = await setupChoice.awaitModalSubmit({
                                time: MODAL_TIMEOUT,
                                filter: i => i.user.id === interaction.user.id && i.customId === "numerology_numbers_modal"
                            });

                            const startRaw = modalSubmit.fields.getTextInputValue("numerology_start_input").trim();
                            const goalRaw = modalSubmit.fields.getTextInputValue("numerology_goal_input").trim();

                            draft.startNumber = startRaw && /^\d+$/.test(startRaw) ? Number(startRaw) : 0;
                            draft.goalNumber = goalRaw && /^\d+$/.test(goalRaw) ? Number(goalRaw) : null;

                            const view = setupSummaryEmbed(draft);
                            const canStart = !!(draft.mode && (draft.mode !== "custom" || draft.formula));

                            const rows = [modeSelectRow(draft.mode)];
                            if (draft.mode === "custom") rows.push(customFormulaSelectRow(draft.formula));
                            rows.push(setupButtonsRow(canStart));

                            await modalSubmit.update({ embeds: [view.embed], files: view.files, components: rows });
                            message = await interaction.fetchReply();

                        } catch (err) {
                            // Modal timed out/dismissed — stay on the setup screen unchanged.
                        }

                        continue;

                    }

                    if (setupChoice.customId === "numerology_confirm_start") {

                        const result = startGame(guildId, CHANNEL_ID, draft.mode, draft.formula, draft.startNumber, draft.goalNumber);

                        if (result.error) {

                            await setupChoice.deferUpdate();
                            await interaction.followUp({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
                            continue;

                        }

                        await setupChoice.update(renderDashboard());
                        message = await interaction.fetchReply();
                        settingUp = false;
                        continue;

                    }

                }

                continue;

            }

        }

    }

};
