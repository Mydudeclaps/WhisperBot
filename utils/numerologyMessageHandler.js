// All Discord-side-effect orchestration for Numerology (reacting,
// deleting, DMing, posting chaos/milestone embeds) lives here rather
// than in services/numerologyService.js — same separation this codebase
// already keeps everywhere else (RarityEngine/NPCManager/etc. never
// touch a Discord interaction object directly; ticPvpInteractionHandler.js
// is where that kind of orchestration actually lives). Called once from
// events/messageCreate.js for messages in the configured Numerology
// channel; nothing else in the bot needs to know this file exists.
const numerologyService = require("../services/numerologyService");
const numerologyRewards = require("../services/numerologyRewards");
const numerologyChaos = require("../services/numerologyChaos");
const numerologyAntiSpam = require("../services/numerologyAntiSpam");
const numerologyStats = require("../services/numerologyStats");
const numerologyNPC = require("../services/numerologyNPC");
const numerologyReactions = require("../data/numerologyReactions");
const { FAILURE_MESSAGES } = require("../data/numerologyMessages");
const embeds = require("../utils/numerologyEmbeds");
const loreService = require("../services/loreService");
const adminConfig = require("../config/adminConfig");
const { PUBLIC_FAILURE_CHANCE, LORE_ENTRY_EVERY, REACTION_RARITY, REACTION_COUNT_WEIGHTS } = require("../config/numerologyConfig");

function pickWeighted(weightedList, key, valueKey) {

    const roll = Math.random();
    let cumulative = 0;

    for (const entry of weightedList) {
        cumulative += entry[key];
        if (roll <= cumulative) return entry[valueKey];
    }

    return weightedList[weightedList.length - 1][valueKey];

}

async function reactToCorrectMessage(message) {

    // Occasionally a pure wildcard emoji instead of a rarity-tier pool,
    // purely so results never feel fully predictable.
    const useWildcard = Math.random() < 0.05;
    const pool = useWildcard ? numerologyReactions.wildcard : numerologyReactions[pickWeighted(REACTION_RARITY, "chance", "tier")];

    const count = pickWeighted(REACTION_COUNT_WEIGHTS, "chance", "count");
    const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, pool.length));

    for (const emoji of chosen) {

        try { await message.react(emoji); }
        catch (err) { /* missing react permission shouldn't break anything else */ }

    }

}

async function sendFailureDM(message, expected, given) {

    const joke = FAILURE_MESSAGES[Math.floor(Math.random() * FAILURE_MESSAGES.length)];
    const embed = embeds.failureDMEmbed(expected, given, joke);

    try { await message.author.send({ embeds: [embed] }); }
    catch (err) { /* DMs disabled — nothing more we can do, and that's fine */ }

}

async function handleIncorrect(message, result) {

    try { await message.delete(); }
    catch (err) { /* missing Manage Messages permission — leave the message rather than crash */ }

    await sendFailureDM(message, result.expected, result.given);

    const spamResult = numerologyAntiSpam.evaluateMistake(message.author.id);

    if (spamResult.tier === "warning") {

        try {
            await message.author.send({ embeds: [embeds.warningDMEmbed(Math.round(spamResult.cooldownMs / 1000))] });
        } catch (err) { /* DMs disabled */ }

    } else if (spamResult.tier === "lockout" || spamResult.tier === "abuse") {

        try {
            await message.author.send({ embeds: [embeds.lockoutDMEmbed(Math.round(spamResult.cooldownMs / 1000))] });
        } catch (err) { /* DMs disabled */ }

    }

    if (spamResult.shouldLogToMod && adminConfig.ADMIN_LOG_CHANNEL_ID) {

        try {

            const logChannel = await message.client.channels.fetch(adminConfig.ADMIN_LOG_CHANNEL_ID);

            if (logChannel) {
                await logChannel.send({
                    content: `⚠️ **Numerology anti-spam:** <@${message.author.id}> hit ${spamResult.count} mistakes in the last 5 minutes and has been given a ${Math.round(spamResult.cooldownMs / 1000)}s cooldown.`
                });
            }

        } catch (err) { /* channel fetch/permission issue — not worth crashing over */ }

    }

    if (Math.random() < PUBLIC_FAILURE_CHANCE) {

        const { embed, files } = embeds.publicIncidentEmbed(message.author.username, result.expected);
        try { await message.channel.send({ embeds: [embed], files }); }
        catch (err) { /* non-critical */ }

    }

}

function formatElapsed(startedAt) {

    const ms = Date.now() - new Date(startedAt).getTime();
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days}d ${hours}h`;

}

async function handleCorrect(message, result) {

    await reactToCorrectMessage(message);

    let game = result.game;

    // Consume any active curse/divine window BEFORE computing rewards,
    // so the multiplier reflects this exact count. Check "was a divine
    // window active" against the PRE-tick state (result.game, captured
    // before numerologyChaos touches anything) — that's the only
    // reliable source of "was this specific count inside the window."
    const wasDivineActive = (() => {
        try { return !!JSON.parse(result.game.formula_state || "{}").divineRemaining; }
        catch (e) { return false; }
    })();

    const curseResult = numerologyChaos.consumeCurse(game);
    game = curseResult.game;

    const divineTick = numerologyChaos.tickDivineWindow(game);
    game = divineTick.game;

    const reward = numerologyRewards.awardForCorrectCount(message.author.id, message.author.username, {
        cursed: curseResult.wasCursed,
        divine: wasDivineActive
    });

    // Tick down an active warp (only matters if one is active; no-op otherwise).
    game = numerologyChaos.tickWarp(game);

    const userStats = numerologyStats.getUserStats(message.author.id);

    // Exact "before" value, straight from attemptCount() — no
    // approximation needed now that the service returns it directly.
    const milestone = numerologyRewards.checkMilestone(result.previousNumber, result.newNumber);
    const divineNumber = numerologyRewards.checkDivineNumber(result.previousNumber, result.newNumber);

    if (milestone) {

        numerologyStats.incrementMilestoneCount(message.author.id);

        const npcLines = numerologyNPC.getMilestoneAppearance(milestone);

        const { embed, files } = embeds.milestoneEmbed(
            milestone,
            result.newNumber,
            formatElapsed(game.started_at),
            `${game.highest_count.toLocaleString()}${game.highest_count === result.newNumber ? " (NEW!)" : ""}`,
            npcLines
        );

        try { await message.channel.send({ embeds: [embed], files }); }
        catch (err) { /* non-critical */ }

        if (message.guild) {

            try {
                loreService.submitSystemEntry(
                    message.guild.id,
                    message.client.user.id,
                    `The count reached ${milestone.toLocaleString()} today. The numbers whispered through the channel. The community had spoken.`,
                    "history"
                );
            } catch (err) { /* non-critical */ }

        }

    }

    if (divineNumber) {

        const line = numerologyNPC.getDivineNumberAppearance();

        if (line) {

            try { await message.channel.send({ content: line }); }
            catch (err) { /* non-critical */ }

        }

    }

    // Roll for a brand-new chaos event on this correct count.
    const chaosResult = numerologyChaos.maybeTriggerChaosEvent(game);

    if (chaosResult) {

        numerologyStats.incrementChaosWitnessCount(message.author.id);

        const npcLine = numerologyNPC.getChaosEventAppearance();
        const { embed, files } = embeds.chaosEventEmbed(chaosResult.definition, chaosResult.publicText, npcLine);

        try { await message.channel.send({ embeds: [embed], files }); }
        catch (err) { /* non-critical */ }

        if (message.guild && chaosResult.loreText) {

            try {
                loreService.submitSystemEntry(message.guild.id, message.client.user.id, chaosResult.loreText, "history");
            } catch (err) { /* non-critical */ }

        }

    } else {

        // No chaos event this time — occasionally still drop a
        // low-probability streak/cheer line for warmth, matching the
        // "keep players guessing" spirit without it being mechanical.
        const streakLine = numerologyNPC.getStreakAppearance(result.streak);

        if (streakLine) {

            try { await message.channel.send({ content: streakLine }); }
            catch (err) { /* non-critical */ }

        }

    }

    // Achievement checks, using the freshest stats row.
    const freshStats = numerologyStats.getUserStats(message.author.id);
    const unlocked = numerologyRewards.checkAchievements(message.author.id, message.author.username, freshStats, {
        isFirstEver: result.isFirstEver,
        witnessedDivine: !!divineNumber
    });

    for (const achievement of unlocked) {

        try {

            const { achievementEmbed } = require("../utils/embedFactory");
            await message.channel.send({ embeds: [achievementEmbed(achievement)] });

        } catch (err) { /* non-critical */ }

    }

    // Goal completion check — after everything above, since a chaos
    // event or milestone firing on the exact goal-crossing count should
    // still show before "complete."
    const finalGame = numerologyService.getGameById(game.id);

    if (finalGame.goal_number && finalGame.current_number >= finalGame.goal_number && finalGame.status === "active") {

        const contributors = numerologyStats.getContributorTotals(finalGame.id);
        const { embed, files } = embeds.goalCompleteEmbed(finalGame.current_number, contributors);

        try { await message.channel.send({ embeds: [embed], files }); }
        catch (err) { /* non-critical */ }

        numerologyService.stopGame(message.channel.id);

    }

}

async function handleNumerologyMessage(message) {

    const result = numerologyService.attemptCount(
        message.guild ? message.guild.id : "unknown",
        message.channel.id,
        message.author.id,
        message.author.username,
        message.content
    );

    if (result.type === "ignored" || result.type === "no_game") return;

    if (result.type === "correct") {
        await handleCorrect(message, result);
        return;
    }

    if (result.type === "incorrect") {
        await handleIncorrect(message, result);
        return;
    }

}

module.exports = { handleNumerologyMessage };
