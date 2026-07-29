const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType } = require("discord.js");

const StoryBuilder = require("./StoryBuilder");
const RarityEngine = require("./RarityEngine");
const ComboManager = require("./ComboManager");
const AchievementTracker = require("./AchievementTracker");
const SocialEmbedBuilder = require("./SocialEmbedBuilder");
const SocialStats = require("../models/SocialStats");
const SocialHistory = require("../models/SocialHistory");
const { loadCommandData } = require("../utils/commandLoader");
const { sleep } = require("../utils/helpers");

const STAGE_DELAY_MS = 2500;


// The actual "hug/slap/poke/etc." interaction, once a user and target are
// already known — everything buildTargetCommand's execute() used to do
// inline. Extracted so both the slash command (target from
// interaction.options) and the context menu command (target from
// interaction.targetUser) can share it verbatim rather than duplicating
// the 3-stage story/rarity/combo/achievement/history flow. Discord.js
// gives both ChatInputCommandInteraction and UserContextMenuCommandInteraction
// the same deferReply/editReply/fetchReply/user surface, so nothing here
// needs to know or care which kind of interaction it was called from.
async function runTargetInteraction(interaction, name, commandData) {

    // Deferred immediately — this command does several staged edits plus
    // a final attachment upload, all well past what the initial 3s reply
    // window allows.
    await interaction.deferReply();

    const user = interaction.user;
    const target = interaction.isChatInputCommand()
        ? interaction.options.getUser("target")
        : interaction.targetUser;

    // --- Self-interaction easter egg — deliberately lightweight, no
    // rarity/combo/achievements/history. Just a fun moment. Also covers
    // the bot-target case: nothing here special-cases a bot user, so
    // targeting a bot flows through the exact same normal path a human
    // target would (same as the existing slash commands today — not a
    // new restriction, just preserved behavior). ---
    if (target.id === user.id) {

        const self = StoryBuilder.buildSelf(commandData, user);

        const { embed, files } = SocialEmbedBuilder.buildSelf({
            command: name,
            text: self.text,
            emoji: self.emoji
        });

        await interaction.editReply({
            content: null,
            embeds: [embed],
            files
        });

        return;

    }

    // --- Normal flow ---
    const combo = ComboManager.incrementCombo(user.id, target.id, name);
    const rarity = RarityEngine.roll();

    const story = StoryBuilder.build(commandData, user, target, rarity, combo);

    // Stage 1: intro
    await interaction.editReply({
        content: `${story.stages[0].emoji} ${story.stages[0].text}`,
        embeds: [],
        components: []
    });

    await sleep(STAGE_DELAY_MS);

    // Stage 2: action
    await interaction.editReply({
        content: `${story.stages[1].emoji} ${story.stages[1].text}`
    });

    await sleep(STAGE_DELAY_MS);

    // Stage 3: outcome, achievements, and the full embed
    const stats = SocialStats.recordInteraction(user.id, {
        command: name,
        targetId: target.id,
        rarity,
        combo,
        npcTriggered: !!story.npc,
        plotTwist: !!story.plotTwist
    });

    const achievements = AchievementTracker.checkAchievements(user.id, stats);

    const { embed, files } = SocialEmbedBuilder.build({
        command: name,
        user,
        target,
        rarity,
        combo,
        stages: story.stages,
        npc: story.npc,
        comboLine: story.comboLine,
        plotTwist: story.plotTwist,
        achievements
    });

    await interaction.editReply({
        content: null,
        embeds: [embed],
        files
    });

    // Auto-reaction (10% chance) — purely cosmetic flavor.
    if (Math.random() < 0.1) {

        try {

            const reactions = ["😂", "🔥", "💀", "👏", "❤️", "🎉"];
            const message = await interaction.fetchReply();

            await message.react(
                reactions[Math.floor(Math.random() * reactions.length)]
            );

        } catch (err) {

            // Non-critical — missing react permission shouldn't break
            // the command.

        }

    }

    SocialHistory.recordEvent({
        command: name,
        userId: user.id,
        targetId: target.id,
        targetMentioned: true,
        rarity,
        combo,
        comboWasActive: combo > 1,
        npcInterrupted: !!story.npc,
        npcName: story.npc ? story.npc.name : null,
        plotTwistOccurred: !!story.plotTwist,
        achievementUnlocked: achievements.length ? achievements[0].id : null,
        story: story.stages
    });

}


// Builds a complete { data, execute } command module for a target-based
// social command (one that hugs/slaps/pokes/etc. another user). This is
// the whole "developer experience" promise from the design doc in code
// form — a new command is just:
//
//   module.exports = buildTargetCommand({
//       name: "slap",
//       description: "👋 Slap another user!"
//   });
//
// as long as social-engine/data/commands/<name>.json exists with the
// same shape as hug.json.
function buildTargetCommand({ name, description }) {

    const commandData = loadCommandData(name);

    return {

        data: new SlashCommandBuilder()
            .setName(name)
            .setDescription(description)
            .addUserOption(option =>
                option
                    .setName("target")
                    .setDescription(`Who do you want to ${name}?`)
                    .setRequired(true)
            ),

        async execute(interaction) {
            return runTargetInteraction(interaction, name, commandData);
        }

    };

}


// Context menu counterpart — right-click a user -> Apps -> <displayName>.
// Target always comes from interaction.targetUser (that's the entire
// point of a user context menu command; there's no options object to
// pull from), so this is a much thinner wrapper than buildTargetCommand
// — same commandData, same runTargetInteraction, just a different way of
// discovering who the target is. displayName can differ from the
// underlying social-engine command name (e.g. "Highfive" vs "highfive")
// since context menu names are shown verbatim in Discord's UI and can't
// share a name with each other within the same command type, but can
// freely match or differ from the slash command's own name — Discord
// tracks slash commands and user-context commands as separate
// namespaces.
function buildTargetContextCommand({ name, displayName }) {

    const commandData = loadCommandData(name);

    return {

        data: new ContextMenuCommandBuilder()
            .setName(displayName || name)
            .setType(ApplicationCommandType.User),

        async execute(interaction) {
            return runTargetInteraction(interaction, name, commandData);
        }

    };

}


module.exports = { buildTargetCommand, buildTargetContextCommand, runTargetInteraction };
