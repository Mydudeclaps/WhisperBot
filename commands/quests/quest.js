const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType,
    MessageFlags
} = require("discord.js");


const {
    startQuest,
    getQuest,
    getActiveUserQuest,
    abandonQuest,
    getActiveQuests,
    getAvailableQuests
} = require("../../services/questService");


const { getAllActivities } = require("../../services/activityService");


const {
    questStartedEmbed,
    activeQuestsEmbed,
    errorEmbed,
    successEmbed,
    infoEmbed,
    questHubEmbed,
    questBoardEmbed,
    questDetailsEmbed,
    activitiesListEmbed
} = require("../../utils/embedFactory");


const quests =
require("../../data/quests");


// Shared handler for both /quest leave and /quest abandon — same behavior,
// just a different subcommand name for player convenience.
async function handleAbandon(interaction) {

    const userId = interaction.user.id;

    const questId =
    interaction.options.getString("quest");

    const userQuest =
    getActiveUserQuest(userId, questId);

    const quest = getQuest(questId);

    if (!userQuest || !quest) {

        return interaction.reply({
            embeds: [
                errorEmbed("You don't have that quest active.")
            ],
            flags: MessageFlags.Ephemeral
        });

    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("quest_abandon_confirm")
            .setLabel("✅ Confirm")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("quest_abandon_cancel")
            .setLabel("❌ Cancel")
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        embeds: [
            infoEmbed(
                `⚠️ Abandon "${quest.name}"?`,
                `Your progress (**${userQuest.progress}/${quest.goal}**) will be **permanently lost** ` +
                `and can't be recovered. You'll be able to start this quest again later.`
            )
        ],
        components: [row],
        flags: MessageFlags.Ephemeral
    });

    const message = await interaction.fetchReply();

    let choice;

    try {

        choice = await message.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30000,
            filter: i => i.user.id === userId
        });

    } catch (err) {

        return interaction.editReply({
            content: "⌛ No response — quest was not abandoned.",
            embeds: [],
            components: []
        });

    }

    if (choice.customId === "quest_abandon_cancel") {

        return choice.update({
            content: "❌ Cancelled — your quest progress is safe.",
            embeds: [],
            components: []
        });

    }

    const removed = abandonQuest(userId, questId);

    return choice.update({
        embeds: [
            removed
                ? successEmbed(`🗑️ Abandoned "${quest.name}". You can start it again anytime.`)
                : errorEmbed("Something went wrong — that quest may already be gone.")
        ],
        components: []
    });

}


// Cosmetic only — display-only reference number for the hub's
// "Active Quests: X/Y" line. Nothing in questService enforces a cap on
// simultaneous active quests (startQuest only blocks re-starting the
// SAME quest), so this is not an actual limit, just a target the UI
// shows players to aim for. Change freely.
const DISPLAY_MAX_ACTIVE_QUESTS = 5;

const QUEST_BOARD_PAGE_SIZE = 5;


// /quest hub — the Quest Journal. A single loop over one message,
// switching between "hub", "board", "details", and "activities" views
// rather than spinning up a fresh collector per view (which leaks
// listeners the more a player navigates back and forth).
async function handleHub(interaction) {

    const userId = interaction.user.id;
    const username = interaction.user.username;

    await interaction.deferReply();

    let view = "hub";
    let boardPage = 0;
    let selectedQuestId = null;

    const renderHub = () => {

        const activeCount = getActiveQuests(userId).length;
        const availableCount = getAvailableQuests(userId).length;

        const { embed, files } = questHubEmbed(username, activeCount, DISPLAY_MAX_ACTIVE_QUESTS, availableCount);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("quest_board_btn").setLabel("📋 Quest Board").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("quest_activities_btn").setLabel("🎮 Activities").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("quest_history_btn").setLabel("📖 History").setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        return { embeds: [embed], files, components: [row] };

    };

    const renderBoard = () => {

        const available = getAvailableQuests(userId);
        const totalPages = Math.max(1, Math.ceil(available.length / QUEST_BOARD_PAGE_SIZE));

        boardPage = Math.min(boardPage, totalPages - 1);

        const start = boardPage * QUEST_BOARD_PAGE_SIZE;
        const pageQuests = available.slice(start, start + QUEST_BOARD_PAGE_SIZE);

        const { embed, files } = questBoardEmbed(pageQuests, boardPage, totalPages);

        const components = [];

        if (pageQuests.length) {

            const select = new StringSelectMenuBuilder()
                .setCustomId("quest_select")
                .setPlaceholder("Select a quest to view details...")
                .addOptions(pageQuests.map(q => ({
                    label: q.name.replace(/^\S+\s/, "").slice(0, 100),
                    description: q.description.slice(0, 100),
                    value: q.id
                })));

            components.push(new ActionRowBuilder().addComponents(select));

        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("quest_board_prev").setLabel("⬅ Previous").setStyle(ButtonStyle.Secondary).setDisabled(boardPage <= 0),
            new ButtonBuilder().setCustomId("quest_board_next").setLabel("Next ➡").setStyle(ButtonStyle.Secondary).setDisabled(boardPage >= totalPages - 1),
            new ButtonBuilder().setCustomId("quest_back_to_hub").setLabel("⬅ Back to Journal").setStyle(ButtonStyle.Danger)
        ));

        return { embeds: [embed], files, components };

    };

    const renderDetails = () => {

        const quest = getQuest(selectedQuestId);
        const { embed, files } = questDetailsEmbed(quest);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("quest_start_confirm").setLabel("✅ Start Quest").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("quest_back_to_board").setLabel("⬅ Back").setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], files, components: [row] };

    };

    const renderActivities = () => {

        const { embed, files } = activitiesListEmbed(getAllActivities());

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("quest_back_to_hub").setLabel("⬅ Back to Journal").setStyle(ButtonStyle.Danger)
        );

        return { embeds: [embed], files, components: [row] };

    };

    await interaction.editReply(renderHub());
    let message = await interaction.fetchReply();

    while (true) {

        let choice;

        try {

            choice = await message.awaitMessageComponent({
                time: 300000, // 5 minutes idle timeout
                filter: i => i.user.id === userId
            });

        } catch (err) {

            // Idle timeout — just leave the last view on screen with
            // disabled-looking (but not actually disabled, Discord
            // doesn't let us edit after the fact without a new
            // interaction) buttons. Simplest correct behavior: leave it.
            return;

        }

        if (choice.customId === "quest_board_btn") {

            view = "board";
            boardPage = 0;
            await choice.update(renderBoard());

        } else if (choice.customId === "quest_activities_btn") {

            view = "activities";
            await choice.update(renderActivities());

        } else if (choice.customId === "quest_back_to_hub") {

            view = "hub";
            await choice.update(renderHub());

        } else if (choice.customId === "quest_board_prev") {

            boardPage = Math.max(0, boardPage - 1);
            await choice.update(renderBoard());

        } else if (choice.customId === "quest_board_next") {

            boardPage += 1;
            await choice.update(renderBoard());

        } else if (choice.customId === "quest_select") {

            selectedQuestId = choice.values[0];
            view = "details";
            await choice.update(renderDetails());

        } else if (choice.customId === "quest_back_to_board") {

            view = "board";
            await choice.update(renderBoard());

        } else if (choice.customId === "quest_start_confirm") {

            const started = startQuest(userId, selectedQuestId);
            const quest = getQuest(selectedQuestId);

            if (!started) {

                await choice.update({
                    embeds: [errorEmbed("You already have this quest active, or have already completed it.")],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("quest_back_to_board").setLabel("⬅ Back to Board").setStyle(ButtonStyle.Secondary)
                    )]
                });

                message = await interaction.fetchReply();
                continue;

            }

            const { embed, files } = questStartedEmbed(quest);

            await choice.update({
                embeds: [embed],
                files,
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("quest_back_to_hub").setLabel("⬅ Back to Journal").setStyle(ButtonStyle.Primary)
                )]
            });

        }

        message = await interaction.fetchReply();

    }

}


module.exports = {


    data: new SlashCommandBuilder()

        .setName("quest")

        .setDescription("Manage WhisperBot quests")

        .addSubcommand(sub =>
            sub
            .setName("hub")
            .setDescription("📜 Open the Whisper Quest Journal")
        )

        .addSubcommand(sub =>
            sub
            .setName("start")
            .setDescription("Start a quest")
            .addStringOption(option =>
                option
                .setName("quest")
                .setDescription("Choose a quest")
                .setRequired(true)
                .addChoices(
                    ...Object.values(quests).map(q => ({
                        name: q.name,
                        value: q.id
                    }))
                )
            )
        )
    
        .addSubcommand(sub =>
            sub
            .setName("active")
            .setDescription("View your active quests")
        )

        .addSubcommand(sub =>
            sub
            .setName("leave")
            .setDescription("Abandon an active quest and lose its progress")
            .addStringOption(option =>
                option
                .setName("quest")
                .setDescription("Choose a quest to abandon")
                .setRequired(true)
                .addChoices(
                    ...Object.values(quests).map(q => ({
                        name: q.name,
                        value: q.id
                    }))
                )
            )
        )

        .addSubcommand(sub =>
            sub
            .setName("abandon")
            .setDescription("Abandon an active quest and lose its progress")
            .addStringOption(option =>
                option
                .setName("quest")
                .setDescription("Choose a quest to abandon")
                .setRequired(true)
                .addChoices(
                    ...Object.values(quests).map(q => ({
                        name: q.name,
                        value: q.id
                    }))
                )
            )
        ),

    async execute(interaction) {


        const subcommand =
        interaction.options.getSubcommand();

        if (subcommand === "hub") {

            return handleHub(interaction);

        }

        if (subcommand === "leave" || subcommand === "abandon") {

            return handleAbandon(interaction);

        }

        if (subcommand === "active") {

            await interaction.deferReply();

            const db =
            require("../../database/database");


            const active =
            db.prepare(`

                SELECT *

                FROM user_quests

                WHERE user_id = ?

                AND completed = 0

            `).all(interaction.user.id);


            const { embed, files } = activeQuestsEmbed(
                interaction.user.username,
                active,
                quests,
                interaction.user.displayAvatarURL()
            );

            return interaction.editReply({
                embeds: [embed],
                files
            });

        }


        const questId =
        interaction.options.getString("quest");


        const started =
        startQuest(

            interaction.user.id,

            questId

        );


        const quest =
        getQuest(questId);


        if (!started) {


            return interaction.reply({

                embeds: [
                    errorEmbed("You already have this quest active.")
                ],

                flags: MessageFlags.Ephemeral

            });


        }


        await interaction.deferReply();

        const { embed, files } = questStartedEmbed(quest);

        await interaction.editReply({
            embeds: [embed],
            files
        });


    }


};
