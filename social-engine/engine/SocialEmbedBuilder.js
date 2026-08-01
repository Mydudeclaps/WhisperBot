const { EmbedBuilder } = require("discord.js");

// Reuse the thumbnail system built for the core bot commands — social
// commands just need a matching image in assets/images/<command>.<ext>,
// exactly like /hug, /rob, etc.
const { getCommandThumbnail } = require("../../utils/embedFactory");
const RarityEngine = require("./RarityEngine");
const { capitalize } = require("../utils/helpers");

const FOOTER_QUOTES = [
    "Reality briefly stopped loading.",
    "We're not building commands. We're building experiences.",
    "Every interaction is a tiny story.",
    "Screenshot-worthy since day one.",
    "No two moments are ever quite the same."
];


// Builds the final embed for a completed (non-self) interaction.
//
// metadata: {
//   command, user, target, rarity, combo, stages, npc, comboLine,
//   plotTwist, achievements
// }
function build(metadata) {

    const {
        command,
        user,
        target,
        rarity,
        combo,
        stages,
        npc,
        comboLine,
        plotTwist,
        achievements
    } = metadata;

    const tier = RarityEngine.getTierData(rarity);
    const thumb = getCommandThumbnail(command);

    const storyLines = stages.map(s => `${s.emoji} ${s.text}`);

    let description = storyLines.join("\n");

    if (comboLine) {
        description += `\n\n*${comboLine}*`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`${tier.emoji} ${capitalize(command)}!`)
        .setDescription(description)
        .setColor(tier.color)
        .setFooter({ text: `${pickFooter()} • WhisperBot Social Engine` })
        .setTimestamp();

    if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

    embed.addFields({
        name: "🎲 Rarity",
        value: `${tier.stars} ${tier.label}`,
        inline: true
    });

    if (combo > 1) {

        embed.addFields({
            name: "💫 Combo",
            value: `x${combo}`,
            inline: true
        });

    }

    if (npc) {

        embed.addFields({
            name: `${npc.emoji} ${npc.name}`,
            value: npc.line,
            inline: false
        });

    }

    if (achievements && achievements.length > 0) {

        embed.addFields({
            name: "🏆 Achievement Unlocked!",
            value: achievements
                .map(a => `**${a.name}** — ${a.description}${a.title ? ` (title: *${a.title}*)` : ""}`)
                .join("\n"),
            inline: false
        });

    }

    if (plotTwist) {

        embed.addFields({
            name: "🌟 Plot Twist!",
            value: "_Something unexpected happened..._",
            inline: false
        });

    }

    return { embed, files: thumb ? [thumb] : [] };

}


// Lightweight variant for the self-interaction easter egg — no rarity,
// combo, NPC, or achievements, just the flavor line.
function buildSelf({ command, text, emoji }) {

    const thumb = getCommandThumbnail(command);

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${capitalize(command)}!`)
        .setDescription(text)
        .setColor(0x5865F2)
        .setFooter({ text: "WhisperBot Social Engine" })
        .setTimestamp();

    if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

    return { embed, files: thumb ? [thumb] : [] };

}


function pickFooter() {
    return FOOTER_QUOTES[Math.floor(Math.random() * FOOTER_QUOTES.length)];
}


module.exports = { build, buildSelf };
