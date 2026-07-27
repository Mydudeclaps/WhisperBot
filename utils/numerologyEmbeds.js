// All Numerology embed builders. Lives in utils/ (not services/, despite
// the original design doc suggesting services/numerologyEmbeds.js) —
// every other embed builder in this codebase lives in utils/
// (embedFactory.js, kingdomEmbeds.js, the embedBuilder/ admin tool),
// following that established convention instead.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { COLORS } = require("../config/constants");
const { withThumbnail } = require("./embedFactory");
const { getFormulaLabel } = require("../services/numerologyRules");


// ─── Public in-channel embeds ──────────────────────────────────────

function milestoneEmbed(milestone, count, elapsedLabel, record, npcLines = []) {

    const embed = new EmbedBuilder()
        .setTitle("🏆 NUMEROLOGY MILESTONE")
        .setColor(COLORS.GOLD)
        .setDescription(`The count has reached **${milestone.toLocaleString()}**!`)
        .addFields(
            { name: "Current Count", value: count.toLocaleString(), inline: true },
            { name: "Time", value: elapsedLabel, inline: true },
            { name: "Record", value: record, inline: true }
        )
        .setTimestamp();

    if (npcLines.length) {
        embed.addFields({ name: "\u200b", value: npcLines.join("\n"), inline: false });
    }

    return withThumbnail(embed, "numerology");

}

function chaosEventEmbed(eventDefinition, publicText, npcLine = null) {

    const embed = new EmbedBuilder()
        .setTitle(`${eventDefinition.emoji} ${eventDefinition.name.toUpperCase()}`)
        .setColor(COLORS.WARNING)
        .setDescription(publicText)
        .setTimestamp();

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "numerology");

}

function publicIncidentEmbed(username, correctAnswer) {

    const embed = new EmbedBuilder()
        .setTitle("💀 NUMEROLOGY INCIDENT")
        .setColor(COLORS.ERROR)
        .setDescription(
            `**${username}** attempted to defeat mathematics.\n` +
            `The numbers remain undefeated.\n\n` +
            `Correct Answer: **${correctAnswer}**\n\n` +
            `*The channel goes silent for a moment...*`
        )
        .setTimestamp();

    return withThumbnail(embed, "numerology");

}

function goalCompleteEmbed(finalNumber, contributors) {

    const list = contributors
        .slice(0, 10)
        .map((c, i) => `${i + 1}. <@${c.user_id}> (${c.contributions.toLocaleString()})`)
        .join("\n");

    const embed = new EmbedBuilder()
        .setTitle("🏆 NUMEROLOGY COMPLETE")
        .setColor(COLORS.GOLD)
        .setDescription(`Final Number: **${finalNumber.toLocaleString()}**`)
        .addFields({ name: "Contributors", value: list || "—", inline: false })
        .setFooter({ text: "🏆 Rewards distributed based on contribution!" })
        .setTimestamp();

    return withThumbnail(embed, "numerology");

}


// ─── DM failure embed ────────────────────────────────────────────

function failureDMEmbed(correctAnswer, givenAnswer, joke) {

    const embed = new EmbedBuilder()
        .setTitle("🚨 NUMEROLOGY FAILURE 🚨")
        .setColor(COLORS.ERROR)
        .setDescription(
            `Correct Answer: **${correctAnswer}** | Your Answer: **${givenAnswer}**\n\n${joke}`
        )
        .setFooter({ text: "Your message was removed so the count stays clean. Try again!" });

    return embed;

}

function warningDMEmbed(cooldownSeconds) {

    return new EmbedBuilder()
        .setTitle("⚠️ Slow down!")
        .setColor(COLORS.WARNING)
        .setDescription(`That's a few mistakes in a row. Take a breath — you can count again in **${cooldownSeconds}s**.`);

}

function lockoutDMEmbed(cooldownSeconds) {

    return new EmbedBuilder()
        .setTitle("⏳ Numerology Cooldown")
        .setColor(COLORS.ERROR)
        .setDescription(`Too many mistakes too fast — you're on a **${cooldownSeconds}s** cooldown before you can count again.`);

}


// ─── Admin GUI ──────────────────────────────────────────────────────

function dashboardEmbed(game, stats) {

    const embed = new EmbedBuilder()
        .setTitle("🔢 NUMEROLOGY CONTROL CENTER")
        .setColor(COLORS.INFO)
        .setTimestamp();

    if (!game) {

        embed.setDescription("Status: 🔴 No active game in this channel.");
        return withThumbnail(embed, "numerology");

    }

    embed.setDescription(
        `Status: 🟢 Active | Channel: <#${game.channel_id}>\n` +
        `Mode: ${game.mode} (${getFormulaLabel(game.formula)}) | Current: ${game.current_number.toLocaleString()}` +
        (game.goal_number ? ` | Goal: ${game.goal_number.toLocaleString()}` : "")
    );

    embed.addFields(
        { name: "Players", value: `${stats.topCounters.length ? new Set(stats.topCounters.map(c => c.user_id)).size : 0}+`, inline: true },
        { name: "Highest Record", value: game.highest_count.toLocaleString(), inline: true },
        { name: "Total Contributions", value: game.total_contributions.toLocaleString(), inline: true }
    );

    return withThumbnail(embed, "numerology");

}

function dashboardButtons(hasActiveGame) {

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("numerology_start").setLabel("▶ Start").setStyle(ButtonStyle.Success).setDisabled(hasActiveGame),
            new ButtonBuilder().setCustomId("numerology_stop").setLabel("⏹ Stop").setStyle(ButtonStyle.Danger).setDisabled(!hasActiveGame),
            new ButtonBuilder().setCustomId("numerology_reset").setLabel("🔄 Reset").setStyle(ButtonStyle.Secondary).setDisabled(!hasActiveGame)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("numerology_settings").setLabel("⚙ Settings").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("numerology_stats").setLabel("📊 Statistics").setStyle(ButtonStyle.Primary)
        )
    ];

}

function modeSelectRow(selected = null) {

    const menu = new StringSelectMenuBuilder()
        .setCustomId("numerology_mode_select")
        .setPlaceholder("Select Mode")
        .addOptions([
            { label: "Classic (+1)", value: "classic", default: selected === "classic" },
            { label: "Fibonacci-style (current + previous)", value: "fibonacci", default: selected === "fibonacci" },
            { label: "Multiply", value: "multiply", default: selected === "multiply" },
            { label: "Custom Formula", value: "custom", default: selected === "custom" }
        ]);

    return new ActionRowBuilder().addComponents(menu);

}

function customFormulaSelectRow(selected = null) {

    const { CUSTOM_FORMULAS } = require("../config/numerologyConfig");

    const menu = new StringSelectMenuBuilder()
        .setCustomId("numerology_customformula_select")
        .setPlaceholder("Select Custom Formula")
        .addOptions(Object.entries(CUSTOM_FORMULAS).map(([key, def]) => ({
            label: def.label,
            value: key,
            default: selected === key
        })));

    return new ActionRowBuilder().addComponents(menu);

}

function setupSummaryEmbed(draft) {

    const embed = new EmbedBuilder()
        .setTitle("⚙ NUMEROLOGY SETUP")
        .setColor(COLORS.INFO)
        .setDescription("━━━━━━━━━━━━━━━━━━━━━━━━")
        .addFields(
            { name: "Mode", value: draft.mode || "*Not selected*", inline: true },
            { name: "Formula", value: draft.formula ? getFormulaLabel(draft.formula) : "*Not selected*", inline: true },
            { name: "Start Number", value: draft.startNumber !== null && draft.startNumber !== undefined ? String(draft.startNumber) : "0 (default)", inline: true },
            { name: "Goal", value: draft.goalNumber ? String(draft.goalNumber) : "*None (open-ended)*", inline: true }
        );

    return withThumbnail(embed, "numerology");

}

function setupButtonsRow(canStart) {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("numerology_set_numbers").setLabel("🔢 Set Start/Goal").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("numerology_confirm_start").setLabel("✅ Start Game").setStyle(ButtonStyle.Success).setDisabled(!canStart),
        new ButtonBuilder().setCustomId("numerology_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger)
    );

}

function statsEmbed(gameStats, globalLeaderboard) {

    const embed = new EmbedBuilder()
        .setTitle("📊 NUMEROLOGY STATISTICS")
        .setColor(COLORS.INFO)
        .setTimestamp();

    if (gameStats) {

        embed.addFields(
            {
                name: "This Session",
                value:
                    `Total Numbers: ${gameStats.totalCorrect.toLocaleString()} | Attempts: ${gameStats.totalAttempts.toLocaleString()}\n` +
                    `Success: ${(gameStats.successRate * 100).toFixed(1)}% | Chaos Events: ${gameStats.chaosEventCount}`,
                inline: false
            },
            {
                name: "Top Counters (this session)",
                value: gameStats.topCounters.length
                    ? gameStats.topCounters.map((c, i) => `${["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][i] || "•"} <@${c.user_id}> (${c.correct_count})`).join("\n")
                    : "—",
                inline: false
            }
        );

    }

    if (globalLeaderboard && globalLeaderboard.length) {

        embed.addFields({
            name: "🏆 All-Time Leaderboard (by highest count reached)",
            value: globalLeaderboard.map((u, i) => `${i + 1}. <@${u.user_id}> — ${u.highest_count_achieved.toLocaleString()}`).join("\n"),
            inline: false
        });

    }

    return withThumbnail(embed, "numerology");

}


module.exports = {
    milestoneEmbed,
    chaosEventEmbed,
    publicIncidentEmbed,
    goalCompleteEmbed,
    failureDMEmbed,
    warningDMEmbed,
    lockoutDMEmbed,
    dashboardEmbed,
    dashboardButtons,
    modeSelectRow,
    customFormulaSelectRow,
    setupSummaryEmbed,
    setupButtonsRow,
    statsEmbed
};
