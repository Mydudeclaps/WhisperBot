const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require("discord.js");

const RarityEngine = require("./RarityEngine");
const NPCManager = require("./NPCManager");
const AchievementTracker = require("./AchievementTracker");
const SocialStats = require("../models/SocialStats");
const SocialHistory = require("../models/SocialHistory");
const { loadCommandData } = require("../utils/commandLoader");
const { pickRandom, sleep, capitalize } = require("../utils/helpers");
const { getCommandThumbnail } = require("../../utils/embedFactory");

const STAGE_DELAY_MS = 2000;


// The actual "check rizz/aura" flow, once a target is already known —
// everything buildSimpleResponseCommand's execute() used to do inline.
// Extracted so the context menu version can share it verbatim. `target`
// is passed in already-resolved rather than pulled from interaction
// options, since that's the one thing that differs between a slash
// command (options.getUser, or self if omitted) and a context menu
// command (always interaction.targetUser, no "omitted" case possible).
async function runSimpleResponseInteraction(interaction, name, commandData, question, target, resolve, stage1Text) {

    // Deferred immediately — same reasoning as every other social
    // command: staged edits plus an attachment upload can outrun the 3s
    // initial-reply window.
    await interaction.deferReply();

    const user = interaction.user;

    const emojiSet = commandData.emojiSets ? pickRandom(commandData.emojiSets) : ["✨"];

    await interaction.editReply({
        content: stage1Text(pickRandom(emojiSet), { question, user, target })
    });

    await sleep(STAGE_DELAY_MS);

    const rarity = RarityEngine.roll();
    const tier = RarityEngine.getTierData(rarity);

    const resolved = resolve(commandData, rarity, { question, user, target, tier });

    const npc = NPCManager.rollNPC(commandData);

    const stats = SocialStats.recordInteraction(user.id, {
        command: name,
        targetId: target && target.id !== user.id ? target.id : null,
        rarity,
        combo: 0,
        npcTriggered: !!npc,
        plotTwist: false
    });

    const achievements = AchievementTracker.checkAchievements(user.id, stats);

    const thumb = getCommandThumbnail(name);

    const embed = new EmbedBuilder()
        .setTitle(resolved.title || `${tier.emoji} ${capitalize(name)}`)
        .setDescription(resolved.description)
        .setColor(tier.color)
        .setFooter({ text: "WhisperBot Social Engine" })
        .setTimestamp();

    if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

    embed.addFields({
        name: "🎲 Rarity",
        value: `${tier.stars} ${tier.label}`,
        inline: true
    });

    if (question) {

        embed.addFields({
            name: "❓ Question",
            value: question,
            inline: false
        });

    }

    if (resolved.extraFields) {

        embed.addFields(...resolved.extraFields);

    }

    if (npc) {

        embed.addFields({
            name: `${npc.emoji} ${npc.name}`,
            value: npc.line,
            inline: false
        });

    }

    if (achievements.length > 0) {

        embed.addFields({
            name: "🏆 Achievement Unlocked!",
            value: achievements
                .map(a => `**${a.name}** — ${a.description}${a.title ? ` (title: *${a.title}*)` : ""}`)
                .join("\n"),
            inline: false
        });

    }

    await interaction.editReply({
        content: null,
        embeds: [embed],
        files: thumb ? [thumb] : []
    });

    SocialHistory.recordEvent({
        command: name,
        userId: user.id,
        targetId: target && target.id !== user.id ? target.id : null,
        targetMentioned: !!(target && target.id !== user.id),
        rarity,
        combo: 0,
        comboWasActive: false,
        npcInterrupted: !!npc,
        npcName: npc ? npc.name : null,
        plotTwistOccurred: false,
        achievementUnlocked: achievements.length ? achievements[0].id : null,
        story: [
            ...(question ? [{ stage: 1, text: question }] : []),
            { stage: question ? 2 : 1, text: resolved.description }
        ]
    });

}


// Builds a complete { data, execute } command module for a no-target (or
// optional-target) two-stage command: a quick "thinking..." beat, then a
// rarity-flavored reveal. Covers /8ball, /coinflip, /wouldyourather
// (targetMode: "none") and /rizz, /aura (targetMode: "optional", where a
// missing target just means "rate yourself").
//
//   name, description       - same as any slash command
//   hasQuestion              - adds a required "question" string option (8ball)
//   targetMode                - "none" (default) | "optional"
//   stage1Text(emoji, ctx)    - returns the interim "thinking" content string
//   resolve(commandData, rarity, ctx) -> { title?, description, extraFields? }
//       ctx = { question, user, target }
//       `target` is null when targetMode is "none", and defaults to
//       `user` (self) when targetMode is "optional" and nobody was given.
function buildSimpleResponseCommand({
    name,
    description,
    hasQuestion = false,
    targetMode = "none",
    stage1Text,
    resolve
}) {

    const commandData = loadCommandData(name);

    const builder = new SlashCommandBuilder()
        .setName(name)
        .setDescription(description);

    if (hasQuestion) {

        builder.addStringOption(option =>
            option
                .setName("question")
                .setDescription("What do you want to ask?")
                .setRequired(true)
                .setMaxLength(200)
        );

    }

    if (targetMode === "optional") {

        builder.addUserOption(option =>
            option
                .setName("target")
                .setDescription("Who do you want to check? (defaults to you)")
                .setRequired(false)
        );

    }

    return {

        data: builder,

        async execute(interaction) {

            const question = hasQuestion ? interaction.options.getString("question") : null;

            const target = targetMode === "optional"
                ? (interaction.options.getUser("target") || interaction.user)
                : null;

            return runSimpleResponseInteraction(interaction, name, commandData, question, target, resolve, stage1Text);

        }

    };

}


// Context menu counterpart — only makes sense for targetMode: "optional"
// commands (rizz, aura). A context menu always has a target (the
// right-clicked user, via interaction.targetUser) — there's no "omitted"
// case to default to self for, though right-clicking yourself produces
// exactly that outcome naturally, no special-casing needed since
// runSimpleResponseInteraction / the resolve() callbacks already handle
// target.id === user.id gracefully.
function buildSimpleResponseContextCommand({ name, displayName, resolve, stage1Text }) {

    const commandData = loadCommandData(name);

    return {

        data: new ContextMenuCommandBuilder()
            .setName(displayName || name)
            .setType(ApplicationCommandType.User),

        async execute(interaction) {

            const target = interaction.targetUser;
            return runSimpleResponseInteraction(interaction, name, commandData, null, target, resolve, stage1Text);

        }

    };

}


module.exports = { buildSimpleResponseCommand, buildSimpleResponseContextCommand, runSimpleResponseInteraction };
