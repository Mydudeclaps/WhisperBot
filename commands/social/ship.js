const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const RarityEngine = require("../../social-engine/engine/RarityEngine");
const NPCManager = require("../../social-engine/engine/NPCManager");
const AchievementTracker = require("../../social-engine/engine/AchievementTracker");
const SocialStats = require("../../social-engine/models/SocialStats");
const SocialHistory = require("../../social-engine/models/SocialHistory");
const { loadCommandData } = require("../../social-engine/utils/commandLoader");
const { pickRandom } = require("../../social-engine/utils/helpers");
const { getCommandThumbnail } = require("../../utils/embedFactory");

const commandData = loadCommandData("ship");

const STAGE_DELAY_MS = 2000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Simple portmanteau: first half of one name + second half of the other.
function buildShipName(nameA, nameB) {

    const a = nameA.slice(0, Math.ceil(nameA.length / 2));
    const b = nameB.slice(Math.floor(nameB.length / 2));

    return `${a}${b}`;

}


// The actual "ship two people" flow, once both targets are already
// known. Extracted so the context menu version ("Ship With" — ships the
// clicking user with whoever they right-clicked, since a user context
// menu only ever supplies ONE target and /ship fundamentally needs two —
// see commands/context/shipwith.js) can reuse it without duplicating the
// rarity/NPC/achievement/history flow.
async function runShipInteraction(interaction, target1, target2) {

    // Deferred immediately — same reasoning as every other social
    // command: staged edits plus an attachment upload can outrun the 3s
    // initial-reply window.
    await interaction.deferReply();

    const emojiSet = pickRandom(commandData.emojiSets);

    // Shipping someone with themselves is a fun little edge case, not
    // an error — matches the self-interaction easter eggs on the
    // target-based commands.
    if (target1.id === target2.id) {

        const embed = new EmbedBuilder()
            .setTitle(`${pickRandom(emojiSet)} Self-Ship!`)
            .setDescription(`**${target1.username}** and **${target1.username}**: **100% compatible.** Self-love is still love.`)
            .setColor(0xFFD700)
            .setFooter({ text: "WhisperBot Social Engine" })
            .setTimestamp();

        const thumb = getCommandThumbnail("ship");

        if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

        await interaction.editReply({
            content: null,
            embeds: [embed],
            files: thumb ? [thumb] : []
        });

        return;

    }

    await interaction.editReply({
        content: `${pickRandom(emojiSet)} *Calculating compatibility between **${target1.username}** and **${target2.username}**...*`
    });

    await sleep(STAGE_DELAY_MS);

    const rarity = RarityEngine.roll();
    const tier = RarityEngine.getTierData(rarity);

    const pool = commandData.responses[rarity] && commandData.responses[rarity].length
        ? commandData.responses[rarity]
        : commandData.responses.common;

    const line = pickRandom(pool)
        .replaceAll("{target1}", `**${target1.username}**`)
        .replaceAll("{target2}", `**${target2.username}**`);

    const shipName = buildShipName(target1.username, target2.username);
    const npc = NPCManager.rollNPC(commandData);

    // /ship is about two OTHER people, not a repeated user<->target
    // interaction, so there's no combo here — same reasoning as
    // /8ball having none.
    const stats = SocialStats.recordInteraction(interaction.user.id, {
        command: "ship",
        targetId: null,
        rarity,
        combo: 0,
        npcTriggered: !!npc,
        plotTwist: false
    });

    const achievements = AchievementTracker.checkAchievements(interaction.user.id, stats);

    const thumb = getCommandThumbnail("ship");

    const embed = new EmbedBuilder()
        .setTitle(`${tier.emoji} Ship Result: ${shipName}`)
        .setDescription(line)
        .addFields({
            name: "🎲 Rarity",
            value: `${tier.stars} ${tier.label}`,
            inline: true
        })
        .setColor(tier.color)
        .setFooter({ text: "WhisperBot Social Engine" })
        .setTimestamp();

    if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

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
        command: "ship",
        userId: interaction.user.id,
        targetId: null,
        targetMentioned: true,
        rarity,
        combo: 0,
        comboWasActive: false,
        npcInterrupted: !!npc,
        npcName: npc ? npc.name : null,
        plotTwistOccurred: false,
        achievementUnlocked: achievements.length ? achievements[0].id : null,
        story: [
            { stage: 1, text: `${target1.username} x ${target2.username}` },
            { stage: 2, text: line }
        ]
    });

}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("ship")
        .setDescription("💕 Check the compatibility between two users!")
        .addUserOption(option =>
            option
                .setName("target1")
                .setDescription("First person to ship")
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName("target2")
                .setDescription("Second person to ship")
                .setRequired(true)
        ),

    async execute(interaction) {

        const target1 = interaction.options.getUser("target1");
        const target2 = interaction.options.getUser("target2");

        return runShipInteraction(interaction, target1, target2);

    },

    runShipInteraction

};
