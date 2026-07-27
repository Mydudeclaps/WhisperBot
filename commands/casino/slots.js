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
    slotsSetupEmbed,
    slotMachineEmbed,
    slotsLeaveSummaryEmbed,
    casinoCooldownBlockedEmbed
} = require("../../utils/embedFactory");

const {
    getVariant,
    calculateSlotPayout,
    getSlotDisplay,
    getSlotSymbols,
    getSlotSessionStats
} = require("../../services/slotsService");

const { addCoins, getCoins, hasEnoughCoins } = require("../../services/coinService");
const { recordBet } = require("../../services/casinoStatsService");
const { awardGameXP, logGameResult, addCasinoXP, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { getUser } = require("../../services/userService");
const { npcLineForGame } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot, rollJackpot, winJackpot } = require("../../services/jackpotService");
const { maybeAnnounceWin } = require("../../services/casinoAnnouncerService");
const { unlockAchievement, giveAchievementRewards } = require("../../services/achievementService");
const db = require("../../database/database");
const { SLOTS, CASINO_XP } = require("../../config/gameConfig");


const MACHINE_OPTIONS = [
    { label: "Classic Slots", value: "classic", emoji: "🎰" },
    { label: "Treasure Slots", value: "treasure", emoji: "🏰" },
    { label: "Kingdom Slots", value: "kingdom", emoji: "🌎" },
    { label: "Fortune Reels (5-reel)", value: "fortune5", emoji: "🎰" },
    { label: "Mega Slots (3x3 grid)", value: "mega3x3", emoji: "🔷" }
];

// Which grid layout each machine's result should render as — see
// embedFactory.formatSlotGrid(). Anything not listed here defaults to
// the original flat 3-reel row.
const MACHINE_LAYOUT = {
    fortune5: "5reel",
    mega3x3: "3x3"
};

const BET_OPTIONS = SLOTS.BET_OPTIONS.map(amount => ({
    label: `💰 ${amount.toLocaleString()} coins`,
    value: String(amount)
}));


function maxBetFor(balance) {

    return Math.max(
        SLOTS.MIN_BET,
        Math.min(SLOTS.MAX_BET, Math.floor(balance * SLOTS.MAX_BET_BALANCE_PERCENT))
    );

}


// Idle "not spun yet" display, sized to match each machine's actual
// shape (3 for the classic row, 15 for the 5-reel grid, 9 for the 3x3
// grid) — just cycles through that machine's own symbol list, no
// randomness needed since it's never used to resolve a real spin.
function idlePlaceholder(machineKey, layout) {

    const cellCount = layout === "5reel" ? 15 : layout === "3x3" ? 9 : 3;
    const symbols = getSlotSymbols(machineKey);

    const cells = [];
    for (let i = 0; i < cellCount; i++) cells.push(symbols[i % symbols.length]);

    return cells;

}


function machineSelectRow(selectedValue = null) {

    const menu = new StringSelectMenuBuilder()
        .setCustomId("slots_machine_select")
        .setPlaceholder("Select Machine")
        .addOptions(MACHINE_OPTIONS.map(o => ({ ...o, default: o.value === selectedValue })));

    return new ActionRowBuilder().addComponents(menu);

}


function betSelectRow(selectedValue = null) {

    const menu = new StringSelectMenuBuilder()
        .setCustomId("slots_bet_select")
        .setPlaceholder("Select Bet Amount")
        .addOptions(BET_OPTIONS.map(o => ({ ...o, default: o.value === selectedValue })));

    return new ActionRowBuilder().addComponents(menu);

}


function startButtonRow(canStart) {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("slots_start")
            .setLabel("▶ Start Playing")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canStart)
    );

}


function playingRow(spinsLeft, onCooldown) {

    if (onCooldown) {

        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("slots_spin").setLabel("⏳ Waiting...").setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId("slots_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
        );

    }

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("slots_spin").setLabel("🎰 SPIN").setStyle(ButtonStyle.Success).setDisabled(spinsLeft <= 0),
        new ButtonBuilder().setCustomId("slots_change_bet").setLabel("💰 Change Bet").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("slots_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
    );

}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("slots")
        .setDescription("🎰 Sit down at the slot machines and play a session"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        const user = getUser(userId, username);

        const cooldown = checkCooldown(userId, "slots");

        if (cooldown.onCooldown) {

            const { embed, files } = casinoCooldownBlockedEmbed("Slots", cooldown.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });

        }

        await interaction.deferReply();

        // ---------------------------------------------------------
        // Phase 1 — setup: pick a machine, then a bet amount.
        // ---------------------------------------------------------

        let machineKey = null;
        let betAmount = null;

        const renderSetup = () => {

            const variant = machineKey ? getVariant(machineKey) : null;

            const { embed, files } = slotsSetupEmbed(
                variant ? variant.label : null,
                betAmount
            );

            return {
                embeds: [embed],
                files,
                components: [
                    machineSelectRow(machineKey),
                    betSelectRow(betAmount ? String(betAmount) : null),
                    startButtonRow(Boolean(machineKey && betAmount))
                ]
            };

        };

        await interaction.editReply(renderSetup());

        let message = await interaction.fetchReply();
        let setupDone = false;

        while (!setupDone) {

            let choice;

            try {

                choice = await message.awaitMessageComponent({
                    time: SLOTS.SETUP_TIMEOUT_MS,
                    filter: i => i.user.id === userId
                });

            } catch (err) {

                return interaction.editReply({
                    content: "⌛ Slot machine setup timed out.",
                    embeds: [],
                    components: []
                });

            }

            if (choice.customId === "slots_machine_select") {

                machineKey = choice.values[0];
                await choice.update(renderSetup());

            } else if (choice.customId === "slots_bet_select") {

                const requested = parseInt(choice.values[0], 10);
                const cap = maxBetFor(getCoins(userId));

                if (requested > getCoins(userId) || requested > cap) {

                    await choice.deferUpdate();
                    await interaction.followUp({
                        content: `⚠️ Maximum bet right now is ${cap.toLocaleString()} coins (10% of your balance, capped at ${SLOTS.MAX_BET.toLocaleString()}).`,
                        flags: MessageFlags.Ephemeral
                    });

                } else {

                    betAmount = requested;
                    await choice.update(renderSetup());

                }

            } else if (choice.customId === "slots_start") {

                if (!machineKey || !betAmount) {
                    await choice.deferUpdate();
                    continue;
                }

                if (!hasEnoughCoins(userId, betAmount)) {

                    await choice.deferUpdate();
                    await interaction.followUp({
                        content: `❌ Insufficient balance for this bet. Your balance: ${getCoins(userId).toLocaleString()} coins.`,
                        flags: MessageFlags.Ephemeral
                    });
                    continue;

                }

                await choice.deferUpdate();
                setupDone = true;

            }

        }

        // ---------------------------------------------------------
        // Phase 2 — playing: spin, change bet, or leave.
        // ---------------------------------------------------------

        const variant = getVariant(machineKey);
        const spins = []; // { wagered, won }
        let spinsLeft = SLOTS.MAX_SPINS_PER_SESSION;
        let cooldownUntil = null; // ms epoch, or null

        const renderPlaying = (extra = {}) => {

            const cooldownUnix = cooldownUntil ? Math.ceil(cooldownUntil / 1000) : null;
            const layout = MACHINE_LAYOUT[machineKey] || "row";

            const { embed, files } = slotMachineEmbed({
                slotType: machineKey,
                variantLabel: variant.label,
                betAmount,
                balance: getCoins(userId),
                spinsLeft,
                maxSpins: SLOTS.MAX_SPINS_PER_SESSION,
                result: extra.result || null,
                symbols: extra.symbols || idlePlaceholder(machineKey, layout),
                winAmount: extra.winAmount || 0,
                cooldownUntilUnix: cooldownUnix,
                npcLine: extra.npcLine || null,
                layout,
                winningLines: extra.winningLines || null
            });

            return {
                embeds: [embed],
                files,
                components: [playingRow(spinsLeft, Boolean(cooldownUntil))]
            };

        };

        await interaction.editReply(renderPlaying());
        message = await interaction.fetchReply();

        let leftSession = false;

        while (!leftSession) {

            const waitTime = cooldownUntil
                ? Math.max(1000, cooldownUntil - Date.now())
                : SLOTS.SESSION_IDLE_TIMEOUT_MS;

            let choice;

            try {

                choice = await message.awaitMessageComponent({
                    time: waitTime,
                    filter: i => i.user.id === userId
                });

            } catch (err) {

                if (cooldownUntil && Date.now() >= cooldownUntil) {

                    // Expected: cooldown ran out with nobody clicking.
                    // Refresh spins and keep the session going.
                    spinsLeft = SLOTS.MAX_SPINS_PER_SESSION;
                    cooldownUntil = null;
                    clearCooldown(userId, "slots");

                    await interaction.editReply(renderPlaying());
                    message = await interaction.fetchReply();
                    continue;

                }

                // True inactivity timeout — end the session quietly.
                const stats = getSlotSessionStats(spins);
                const { embed, files } = slotsLeaveSummaryEmbed(variant.label, stats);

                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "slots_leave") {

                const stats = getSlotSessionStats(spins);
                const { embed, files } = slotsLeaveSummaryEmbed(variant.label, stats);

                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "slots_change_bet") {

                const setupView = slotsSetupEmbed(variant.label, betAmount);

                await choice.update({
                    embeds: [setupView.embed],
                    files: setupView.files,
                    components: [betSelectRow(String(betAmount))]
                });

                message = await interaction.fetchReply();

                let betChosen = false;

                while (!betChosen) {

                    let betChoice;

                    try {

                        betChoice = await message.awaitMessageComponent({
                            time: SLOTS.SETUP_TIMEOUT_MS,
                            filter: i => i.user.id === userId
                        });

                    } catch (err) {

                        const stats = getSlotSessionStats(spins);
                        const { embed, files } = slotsLeaveSummaryEmbed(variant.label, stats);
                        await interaction.editReply({ embeds: [embed], files, components: [] });
                        return;

                    }

                    const requested = parseInt(betChoice.values[0], 10);
                    const cap = maxBetFor(getCoins(userId));

                    if (requested > getCoins(userId) || requested > cap) {

                        await betChoice.deferUpdate();
                        await interaction.followUp({
                            content: `⚠️ Maximum bet right now is ${cap.toLocaleString()} coins.`,
                            flags: MessageFlags.Ephemeral
                        });

                    } else {

                        betAmount = requested;
                        await betChoice.update(renderPlaying());
                        message = await interaction.fetchReply();
                        betChosen = true;

                    }

                }

                continue;

            }

            if (choice.customId === "slots_spin") {

                if (spinsLeft <= 0 || cooldownUntil) {
                    await choice.deferUpdate();
                    continue;
                }

                if (!hasEnoughCoins(userId, betAmount)) {

                    await choice.deferUpdate();
                    await interaction.followUp({
                        content: `❌ Insufficient balance for this bet. Your balance: ${getCoins(userId).toLocaleString()} coins.`,
                        flags: MessageFlags.Ephemeral
                    });
                    continue;

                }

                const { reels, result, winAmount } = calculateSlotPayout(
                    machineKey, betAmount, user.kingdom !== "None" ? user.kingdom : null
                );

                let netChange;

                if (result.won) {
                    netChange = winAmount - betAmount;
                    addCoins(userId, username, netChange);
                } else {
                    netChange = -betAmount;
                    addCoins(userId, username, netChange);
                }

                spins.push({ wagered: betAmount, won: result.won ? winAmount : 0 });
                spinsLeft -= 1;

                recordBet(userId, "slots", betAmount, netChange, result.won);
                awardGameXP(userId, result.won, netChange);
                logGameResult(userId, "slots", betAmount, result.won ? "win" : "loss", spins[spins.length - 1].won);
                contributeJackpot(betAmount);

                let hitJackpot = false;
                let jackpotAmount = 0;

                if (result.won && rollJackpot()) {

                    jackpotAmount = winJackpot();
                    addCoins(userId, username, jackpotAmount);
                    netChange += jackpotAmount;
                    hitJackpot = true;

                    db.prepare("UPDATE casino_stats SET jackpots_won = jackpots_won + 1 WHERE user_id = ?").run(userId);

                    if (unlockAchievement(userId, "CASINO_JACKPOT_WINNER")) {
                        giveAchievementRewards(userId, "CASINO_JACKPOT_WINNER");
                    }

                    addCasinoXP(userId, CASINO_XP.JACKPOT_XP);

                }

                if (spinsLeft <= 0) {
                    cooldownUntil = startCooldown(userId, "slots", SLOTS.SESSION_COOLDOWN_SECONDS);
                }

                const npcLine = npcLineForGame("slots", result.won ? "win" : "lose");
                const resultType = hitJackpot ? "jackpot" : (result.won ? "win" : "lose");

                await choice.update(renderPlaying({
                    result: resultType,
                    symbols: reels,
                    winAmount: hitJackpot ? winAmount + jackpotAmount : winAmount,
                    npcLine,
                    winningLines: result.winningLines || null
                }));

                message = await interaction.fetchReply();

                if (hitJackpot) {
                    await maybeAnnounceWin(interaction, { game: "slots", username, netWin: netChange, jackpot: true });
                } else if (result.won) {
                    await maybeAnnounceWin(interaction, { game: "slots", username, netWin: netChange, jackpot: false });
                }

            }

        }

    }

};
