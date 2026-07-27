const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

const {
    memoryGameEmbed,
    casinoSetupEmbed,
    casinoSessionSummaryEmbed,
    casinoCooldownBlockedEmbed
} = require("../../utils/embedFactory");

const { cooldownRow } = require("../../utils/casinoSessionUI");

const {
    createGame,
    flipCard,
    clearPendingMismatch,
    getVisiblePositions,
    isOutOfAttempts,
    isComplete,
    calculateReward
} = require("../../services/memoryService");

const { addCoins, getCoins, hasEnoughCoins } = require("../../services/coinService");
const { recordBet } = require("../../services/casinoStatsService");
const { getUser } = require("../../services/userService");
const { lucyMemoryLine } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot } = require("../../services/jackpotService");
const { getRandomCooldown, getSessionStats, awardGameXP, logGameResult, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { MEMORY, CASINO_SESSION } = require("../../config/gameConfig");

const GAME_LABEL = "Memory Vault";
const COLORS_DEFAULT = 0x3498DB;

// How long a mismatch stays visible before auto-flipping back, and how
// long cell buttons are disabled for while that's showing.
const MISMATCH_DISPLAY_MS = 1500;

// Cell-picking uses real buttons, and still has to respect Discord's
// 25-component-per-message cap. Page size is computed per-difficulty
// inside cellButtonRows() (row width matches the actual board width, so
// it's 4 wide for Easy, 5 for Medium/Hard) rather than a single fixed
// constant here — see that function for the reasoning.
const DIFFICULTY_OPTIONS = Object.entries(MEMORY.DIFFICULTIES).map(([key, d]) => ({
    label: d.label,
    value: key
}));

const BET_OPTIONS = MEMORY.BET_OPTIONS.map(amount => ({
    label: `💰 ${amount.toLocaleString()} coins`,
    value: String(amount)
}));

function difficultySelectRow(selected = null) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("memory_difficulty_select")
        .setPlaceholder("Select Difficulty")
        .addOptions(DIFFICULTY_OPTIONS.map(o => ({ ...o, default: o.value === selected })));
    return new ActionRowBuilder().addComponents(menu);
}

function betSelectRow(selected = null) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("memory_bet_select")
        .setPlaceholder("Select Bet Amount")
        .addOptions(BET_OPTIONS.map(o => ({ ...o, default: o.value === String(selected) })));
    return new ActionRowBuilder().addComponents(menu);
}

function startButtonRow(canStart) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("memory_start").setLabel("▶ Start Playing").setStyle(ButtonStyle.Success).setDisabled(!canStart)
    );
}

// Builds the cell-button grid for the CURRENT PAGE only, plus a control
// row (Prev/Leave/Next). `locked` disables every cell button at once —
// used while a mismatch is being shown, so the player can't queue up a
// third flip mid-animation.
function cellButtonRows(game, page, locked) {

    // Button rows now match the board's actual width (4 for Easy, 5 for
    // Medium, 5 for Hard — Discord's own 5-per-row cap means a true 6-wide
    // Hard board still renders at 5, same as before, but Easy previously
    // rendered as 5-wide rows against a 4-wide board, visually
    // misaligned with the board text above it).
    const rowWidth = Math.min(game.config.size, 5);
    const cellsPerPage = rowWidth * 4; // 4 cell-rows, 1 row reserved for controls

    const totalCells = game.grid.length;
    const totalPages = Math.max(1, Math.ceil(totalCells / cellsPerPage));
    const start = page * cellsPerPage;
    const end = Math.min(start + cellsPerPage, totalCells);
    const visible = new Set(getVisiblePositions(game));

    const rows = [];

    for (let i = start; i < end; i += rowWidth) {

        const row = new ActionRowBuilder();

        for (let j = i; j < Math.min(i + rowWidth, end); j++) {

            const isMatched = game.matched[j];
            const isPending = game.pendingFlips.includes(j);
            const faceUp = visible.has(j);

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`memory_cell_${j}`)
                    .setLabel(faceUp ? (game.grid[j] === "BONUS" ? "🎁" : game.grid[j]) : `${j + 1}`)
                    .setStyle(isMatched ? ButtonStyle.Success : (isPending ? ButtonStyle.Primary : ButtonStyle.Secondary))
                    .setDisabled(locked || isMatched || isPending)
            );

        }

        rows.push(row);

    }

    const controls = new ActionRowBuilder();

    if (totalPages > 1) {
        controls.addComponents(
            new ButtonBuilder().setCustomId("memory_page_prev").setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(page <= 0)
        );
    }

    controls.addComponents(
        new ButtonBuilder().setCustomId("memory_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
    );

    if (totalPages > 1) {
        controls.addComponents(
            new ButtonBuilder().setCustomId("memory_page_next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1)
        );
    }

    rows.push(controls);

    return rows;

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("memory")
        .setDescription("🧠 Sit down at the Memory Vault — find matching pairs to win"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const cooldownCheck = checkCooldown(userId, "memory");

        if (cooldownCheck.onCooldown) {
            const { embed, files } = casinoCooldownBlockedEmbed("Memory Vault", cooldownCheck.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();

        // ---------------- Setup: difficulty + bet amount ----------------

        let difficulty = null;
        let bet = null;

        const renderSetup = () => {
            const config = difficulty ? MEMORY.DIFFICULTIES[difficulty] : null;
            const { embed, files } = casinoSetupEmbed("🧠 MEMORY VAULT — Dealer Lucy", [
                { label: "Difficulty", value: config ? config.label : null },
                { label: "Bet Amount", value: bet ? `${bet.toLocaleString()} coins` : null }
            ]);
            return {
                embeds: [embed], files,
                components: [
                    difficultySelectRow(difficulty),
                    betSelectRow(bet),
                    startButtonRow(Boolean(difficulty && bet))
                ]
            };
        };

        await interaction.editReply(renderSetup());
        let message = await interaction.fetchReply();
        let setupDone = false;

        while (!setupDone) {

            let choice;
            try {
                choice = await message.awaitMessageComponent({ time: CASINO_SESSION.SETUP_TIMEOUT_MS, filter: i => i.user.id === userId });
            } catch (err) {
                return interaction.editReply({ content: "⌛ Setup timed out.", embeds: [], components: [] });
            }

            if (choice.customId === "memory_difficulty_select") {

                difficulty = choice.values[0];
                await choice.update(renderSetup());

            } else if (choice.customId === "memory_bet_select") {

                const requested = parseInt(choice.values[0], 10);
                if (requested > getCoins(userId)) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: "❌ Insufficient balance for that bet.", flags: MessageFlags.Ephemeral });
                } else {
                    bet = requested;
                    await choice.update(renderSetup());
                }

            } else if (choice.customId === "memory_start") {

                if (!difficulty || !bet) { await choice.deferUpdate(); continue; }

                if (!hasEnoughCoins(userId, bet)) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: "❌ Insufficient balance for that bet.", flags: MessageFlags.Ephemeral });
                    continue;
                }

                await choice.deferUpdate();
                setupDone = true;

            }

        }

        // ---------------- Playing ----------------

        const plays = [];
        let vaultsLeft = MEMORY.MAX_GAMES_PER_SESSION;
        let cooldownUntil = null;
        let cooldownLabel = null;
        let game, gameOver, page, consecutiveMatches, consecutiveMisses;

        const config = MEMORY.DIFFICULTIES[difficulty];

        const renderGame = (extra = {}) => {

            const cooldown = cooldownUntil
                ? { seconds: 0, label: cooldownLabel, untilUnix: Math.ceil(cooldownUntil / 1000) }
                : null;

            const visible = new Set(getVisiblePositions(game));
            const visibleArray = game.grid.map((_, i) => visible.has(i));

            const { embed, files } = memoryGameEmbed({
                difficultyLabel: config.label,
                size: config.size,
                bet,
                balance: getCoins(userId),
                attemptsUsed: game.attemptsUsed,
                maxAttempts: config.maxAttempts,
                matchedPairs: game.matchedPairs,
                totalPairs: config.pairs,
                grid: game.grid,
                revealed: visibleArray,
                resultLine: extra.resultLine || null,
                npcLine: extra.npcLine || null,
                color: extra.color || COLORS_DEFAULT,
                cooldown
            });

            let components;

            if (cooldown) {

                components = [cooldownRow("memory_leave")];

            } else if (gameOver) {

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("memory_play_again").setLabel("🔄 Play Again").setStyle(ButtonStyle.Success).setDisabled(vaultsLeft <= 0),
                    new ButtonBuilder().setCustomId("memory_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                )];

            } else {

                components = cellButtonRows(game, page, Boolean(extra.locked));

            }

            return { embeds: [embed], files, components };

        };

        const settleVault = () => {

            const reward = calculateReward(game);
            const complete = isComplete(game);
            const netChange = reward.coins - bet;

            addCoins(userId, username, netChange);

            const won = netChange > 0;
            const isPerfect = complete && game.attemptsUsed === config.pairs;

            let resultLine, npcLine;

            if (complete) {
                resultLine = `🎉 VAULT UNLOCKED! 🎉\n\n💰 Reward: ${reward.coins.toLocaleString()} coins! (${reward.multiplier}x)`;
                npcLine = isPerfect ? lucyMemoryLine("perfect") : lucyMemoryLine("win");
            } else {
                resultLine = `😔 Out of attempts — the vault stays locked.\n\n` +
                    (reward.coins > 0 ? `💰 Bonus coins kept: ${reward.coins.toLocaleString()}` : "You lost your ante.");
                npcLine = lucyMemoryLine("loss");
            }

            plays.push({ wagered: bet, won: reward.coins });
            vaultsLeft -= 1;

            recordBet(userId, "memory", bet, netChange, won);
            awardGameXP(userId, won, netChange);
            logGameResult(userId, "memory", bet, complete ? (won ? "win" : "push") : "loss", reward.coins);
            contributeJackpot(bet);

            gameOver = true;

            if (vaultsLeft <= 0) {
                const c = getRandomCooldown();
                cooldownUntil = startCooldown(userId, "memory", c.seconds);
                cooldownLabel = c.label;
            }

            return { resultLine, npcLine, color: complete ? (won ? 0x57F287 : 0xFEE75C) : 0xED4245 };

        };

        const dealNewGame = () => {
            game = createGame(difficulty, bet);
            gameOver = false;
            page = 0;
            consecutiveMatches = 0;
            consecutiveMisses = 0;
        };

        dealNewGame();

        await interaction.editReply(renderGame());
        message = await interaction.fetchReply();

        let leftSession = false;

        while (!leftSession) {

            const waitTime = cooldownUntil ? Math.max(1000, cooldownUntil - Date.now()) : MEMORY.SESSION_IDLE_TIMEOUT_MS;

            let choice;
            try {
                choice = await message.awaitMessageComponent({ time: waitTime, filter: i => i.user.id === userId });
            } catch (err) {

                if (cooldownUntil && Date.now() >= cooldownUntil) {
                    vaultsLeft = MEMORY.MAX_GAMES_PER_SESSION;
                    cooldownUntil = null;
                    cooldownLabel = null;
                    clearCooldown(userId, "memory");
                    dealNewGame();
                    await interaction.editReply(renderGame());
                    message = await interaction.fetchReply();
                    continue;
                }

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "memory_leave") {

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "memory_play_again") {

                if (vaultsLeft <= 0 || cooldownUntil) { await choice.deferUpdate(); continue; }

                if (!hasEnoughCoins(userId, bet)) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: "❌ Insufficient balance for that bet.", flags: MessageFlags.Ephemeral });
                    continue;
                }

                dealNewGame();
                await choice.update(renderGame());
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "memory_page_prev") {
                page = Math.max(0, page - 1);
                await choice.update(renderGame());
                message = await interaction.fetchReply();
                continue;
            }

            if (choice.customId === "memory_page_next") {
                page += 1;
                await choice.update(renderGame());
                message = await interaction.fetchReply();
                continue;
            }

            if (choice.customId.startsWith("memory_cell_") && !gameOver) {

                const position = parseInt(choice.customId.replace("memory_cell_", ""), 10);
                const flipResult = flipCard(game, position);

                if (flipResult.type === "invalid") {
                    await choice.deferUpdate();
                    continue;
                }

                if (flipResult.type === "bonus") {

                    addCoins(userId, username, flipResult.coins);

                    await choice.update(renderGame({
                        resultLine: `✅ BONUS CELL! +${flipResult.coins.toLocaleString()} coins!`
                    }));
                    message = await interaction.fetchReply();

                    if (isOutOfAttempts(game)) {
                        await interaction.editReply(renderGame(settleVault()));
                        message = await interaction.fetchReply();
                    }

                    continue;

                }

                if (flipResult.type === "first_flip") {

                    await choice.update(renderGame());
                    message = await interaction.fetchReply();
                    continue;

                }

                if (flipResult.type === "match") {

                    consecutiveMatches += 1;
                    consecutiveMisses = 0;

                    if (flipResult.complete) {

                        addCoins(userId, username, MEMORY.MATCH_BONUS_COINS);
                        await choice.update(renderGame(settleVault()));

                    } else {

                        addCoins(userId, username, MEMORY.MATCH_BONUS_COINS);

                        const npcLine = consecutiveMatches >= 2 ? lucyMemoryLine("matchStreak") : lucyMemoryLine("match");

                        await choice.update(renderGame({
                            resultLine: `✅ MATCH FOUND! +${MEMORY.MATCH_BONUS_COINS} bonus coins!`,
                            npcLine,
                            color: 0x57F287
                        }));

                    }

                    message = await interaction.fetchReply();
                    continue;

                }

                if (flipResult.type === "no_match") {

                    consecutiveMisses += 1;
                    consecutiveMatches = 0;

                    const npcLine = consecutiveMisses >= 2 ? lucyMemoryLine("noMatchStreak") : lucyMemoryLine("noMatch");

                    // Show both mismatched cards face-up (this is the
                    // actual bug fix — the board now genuinely shows
                    // what was flipped) with every cell locked so the
                    // player can't queue a third flip mid-animation.
                    await choice.update(renderGame({
                        resultLine: `❌ No match — ${flipResult.symbolA} and ${flipResult.symbolB} don't match.\n\n*Cards will flip back in a moment...*`,
                        npcLine,
                        color: 0xED4245,
                        locked: true
                    }));
                    message = await interaction.fetchReply();

                    await sleep(MISMATCH_DISPLAY_MS);

                    clearPendingMismatch(game);

                    if (isOutOfAttempts(game)) {

                        await interaction.editReply(renderGame(settleVault()));

                    } else {

                        await interaction.editReply(renderGame({ resultLine: "**Keep going!**" }));

                    }

                    message = await interaction.fetchReply();
                    continue;

                }

            }

        }

    }

};
