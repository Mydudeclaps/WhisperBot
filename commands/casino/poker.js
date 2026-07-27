const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const {
    casinoSetupEmbed,
    casinoSessionSummaryEmbed,
    pokerProgressiveEmbed,
    casinoCooldownBlockedEmbed
} = require("../../utils/embedFactory");

const {
    betSelectRow,
    startButtonRow,
    cooldownRow,
    validateBet
} = require("../../utils/casinoSessionUI");

const { dealProgressiveHands, compareHands } = require("../../services/pokerService");
const { addCoins, getCoins, hasEnoughCoins } = require("../../services/coinService");
const { recordBet } = require("../../services/casinoStatsService");
const { getUser } = require("../../services/userService");
const { frankPokerLine } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot } = require("../../services/jackpotService");
const { getRandomCooldown, getSessionStats, awardGameXP, logGameResult, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { unlockAchievement, giveAchievementRewards } = require("../../services/achievementService");
const { POKER, CASINO_SESSION } = require("../../config/gameConfig");

const GAME_TITLE = "♠️ PROGRESSIVE 3-CARD POKER — Dealer Frank";
const GAME_LABEL = "Three Card Poker";

const HIDDEN_CARD = "🂠 Hidden";

function formatCard(card) {
    return `${card.label}${card.suit}`;
}

// Builds the player/dealer display lines for a given reveal stage.
// stage: "first" | "second" | "third" | "showdown"
function buildCardLines(playerHand, dealerHand, stage) {

    let playerLine, dealerLine;

    if (stage === "first") {

        playerLine = formatCard(playerHand[0]);
        dealerLine = HIDDEN_CARD;

    } else if (stage === "second") {

        playerLine = `${formatCard(playerHand[0])}  ${formatCard(playerHand[1])}`;
        dealerLine = `${HIDDEN_CARD}  ${formatCard(dealerHand[1])}`;

    } else if (stage === "third") {

        playerLine = playerHand.map(formatCard).join("  ");
        dealerLine = `${HIDDEN_CARD}  ${formatCard(dealerHand[1])}  ${formatCard(dealerHand[2])}`;

    } else {

        // showdown — everything revealed
        playerLine = playerHand.map(formatCard).join("  ");
        dealerLine = dealerHand.map(formatCard).join("  ");

    }

    return { playerLine, dealerLine };

}

const STAGE_LABELS = {
    first: "First Cards",
    second: "Second Cards",
    third: "Third Cards",
    showdown: "🔥 SHOWDOWN! 🔥"
};

const STAGE_DIALOGUE_KEY = {
    first: "firstCard",
    second: "secondCard",
    third: "thirdCard"
};


module.exports = {

    data: new SlashCommandBuilder()
        .setName("poker")
        .setDescription("♠️ Sit down at Progressive Three Card Poker — beat the dealer's hand to win"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const cooldownCheck = checkCooldown(userId, "poker");

        if (cooldownCheck.onCooldown) {

            const { embed, files } = casinoCooldownBlockedEmbed("Three Card Poker", cooldownCheck.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });

        }

        await interaction.deferReply();

        // ---------------- Setup: ante amount ----------------

        let ante = null;

        const renderSetup = () => {
            const { embed, files } = casinoSetupEmbed(GAME_TITLE, [
                { label: "Ante Amount", value: ante ? `${ante.toLocaleString()} coins` : null }
            ]);
            return {
                embeds: [embed], files,
                components: [betSelectRow("poker_bet_select", ante), startButtonRow("poker_start", Boolean(ante))]
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

            if (choice.customId === "poker_bet_select") {

                const check = validateBet(userId, parseInt(choice.values[0], 10), getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                } else {
                    ante = check.amount;
                    await choice.update(renderSetup());
                }

            } else if (choice.customId === "poker_start") {

                if (!ante) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, ante, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                await choice.deferUpdate();
                setupDone = true;

            }

        }

        // ---------------- Playing ----------------

        const plays = [];
        let handsLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
        let handNumber = 0;
        let cooldownUntil = null;
        let cooldownLabel = null;

        // Per-hand mutable state
        let playerHand, dealerHand, currentBet, stage; // stage: "first" | "second" | "third" | "showdown-shown"

        const renderHand = (extra = {}) => {

            const cooldown = cooldownUntil
                ? { seconds: 0, label: cooldownLabel, untilUnix: Math.ceil(cooldownUntil / 1000) }
                : null;

            const displayStage = stage === "showdown-shown" ? "showdown" : stage;
            const { playerLine, dealerLine } = buildCardLines(playerHand, dealerHand, displayStage);

            const { embed, files } = pokerProgressiveEmbed({
                handNumber,
                ante,
                currentBet,
                balance: getCoins(userId),
                handsLeft,
                maxHands: CASINO_SESSION.MAX_PLAYS_PER_SESSION,
                stageLabel: STAGE_LABELS[displayStage],
                playerLine,
                dealerLine,
                npcLine: extra.npcLine || null,
                resultLine: extra.resultLine || null,
                color: extra.color || (displayStage === "showdown" ? 0xF1C40F : 0x9B59B6),
                cooldown
            });

            let components;

            if (cooldown) {

                components = [cooldownRow("poker_leave")];

            } else if (stage === "showdown-shown") {

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("poker_new_hand").setLabel("🃏 New Hand").setStyle(ButtonStyle.Success).setDisabled(handsLeft <= 0),
                    new ButtonBuilder().setCustomId("poker_change_bet").setLabel("💰 Change Bet").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("poker_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                )];

            } else if (stage === "first") {

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("poker_bet").setLabel("💰 Bet").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("poker_fold").setLabel("📊 Fold").setStyle(ButtonStyle.Danger)
                )];

            } else {

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("poker_bet").setLabel("💰 Bet").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("poker_check").setLabel("✅ Check").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("poker_fold").setLabel("📊 Fold").setStyle(ButtonStyle.Danger)
                )];

            }

            return { embeds: [embed], files, components };

        };

        const dealNewHand = () => {

            handNumber += 1;
            const dealt = dealProgressiveHands();
            playerHand = dealt.playerHand;
            dealerHand = dealt.dealerHand;
            currentBet = ante;
            stage = "first";

        };

        // Folding or reaching showdown both end the hand — shared by both paths.
        const settleHand = (folded) => {

            let netChange;
            let won = false;
            let resultLine;
            let npcLine;
            let comparison = null;

            if (folded) {

                netChange = -currentBet;
                addCoins(userId, username, netChange);
                resultLine = `You folded — you forfeit your ${currentBet.toLocaleString()} coin bet.`;
                npcLine = frankPokerLine("fold");

            } else {

                comparison = compareHands(playerHand, dealerHand);

                if (comparison.winner === "player") {

                    const multiplier = POKER.PAYOUTS[comparison.playerEval.rank];
                    const payout = currentBet * multiplier;
                    netChange = payout - currentBet;
                    addCoins(userId, username, netChange);
                    won = true;

                    resultLine =
                        `Your Hand: ${comparison.playerEval.label}\n` +
                        `Dealer Hand: ${comparison.dealerEval.label}\n\n` +
                        `🎉 YOU WIN! +${netChange.toLocaleString()} coins! (${multiplier}x)`;

                    npcLine = frankPokerLine(multiplier >= 30 ? "bigWin" : "win");

                    if (comparison.playerEval.rank === "mini_royal") {
                        if (unlockAchievement(userId, "CASINO_MINI_ROYAL")) {
                            giveAchievementRewards(userId, "CASINO_MINI_ROYAL");
                        }
                    }

                } else if (comparison.winner === "dealer") {

                    netChange = -currentBet;
                    addCoins(userId, username, netChange);

                    resultLine =
                        `Your Hand: ${comparison.playerEval.label}\n` +
                        `Dealer Hand: ${comparison.dealerEval.label}\n\n` +
                        `❌ You lose ${currentBet.toLocaleString()} coins.`;

                    npcLine = frankPokerLine("loss");

                } else {

                    netChange = 0;

                    resultLine =
                        `Your Hand: ${comparison.playerEval.label}\n` +
                        `Dealer Hand: ${comparison.dealerEval.label}\n\n` +
                        `🤝 Push — your ${currentBet.toLocaleString()} coin bet was returned.`;

                    npcLine = frankPokerLine("push");

                }

            }

            const wonAmount = folded ? 0 : (netChange > 0 ? netChange + currentBet : (netChange === 0 ? currentBet : 0));
            plays.push({ wagered: currentBet, won: wonAmount });
            handsLeft -= 1;

            recordBet(userId, "poker", currentBet, netChange, won);
            awardGameXP(userId, won, netChange);
            logGameResult(userId, "poker", currentBet, folded ? "loss" : (netChange === 0 ? "push" : (won ? "win" : "loss")), wonAmount);
            contributeJackpot(currentBet);

            stage = "showdown-shown";

            if (handsLeft <= 0) {
                const c = getRandomCooldown();
                cooldownUntil = startCooldown(userId, "poker", c.seconds);
                cooldownLabel = c.label;
            }

            return {
                resultLine,
                npcLine,
                color: folded ? 0xFEE75C : (won ? 0x57F287 : (netChange === 0 ? 0xFEE75C : 0xED4245))
            };

        };

        dealNewHand();

        await interaction.editReply(renderHand({ npcLine: frankPokerLine("firstCard") }));
        message = await interaction.fetchReply();

        let leftSession = false;

        while (!leftSession) {

            const waitTime = cooldownUntil ? Math.max(1000, cooldownUntil - Date.now()) : CASINO_SESSION.SESSION_IDLE_TIMEOUT_MS;

            let choice;
            try {
                choice = await message.awaitMessageComponent({ time: waitTime, filter: i => i.user.id === userId });
            } catch (err) {

                if (cooldownUntil && Date.now() >= cooldownUntil) {
                    handsLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
                    cooldownUntil = null;
                    cooldownLabel = null;
                    clearCooldown(userId, "poker");
                    dealNewHand();
                    await interaction.editReply(renderHand({ npcLine: frankPokerLine("firstCard") }));
                    message = await interaction.fetchReply();
                    continue;
                }

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "poker_leave") {

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "poker_change_bet") {

                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Ante Amount", value: `${ante.toLocaleString()} coins` }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [betSelectRow("poker_bet_select", ante)] });
                message = await interaction.fetchReply();

                let betChosen = false;
                while (!betChosen) {

                    let betChoice;
                    try {
                        betChoice = await message.awaitMessageComponent({ time: CASINO_SESSION.SETUP_TIMEOUT_MS, filter: i => i.user.id === userId });
                    } catch (err) {
                        const stats = getSessionStats(plays);
                        const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                        await interaction.editReply({ embeds: [embed], files, components: [] });
                        return;
                    }

                    const check = validateBet(userId, parseInt(betChoice.values[0], 10), getCoins);
                    if (!check.ok) {
                        await betChoice.deferUpdate();
                        await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    } else {
                        ante = check.amount;
                        await betChoice.update(renderHand());
                        message = await interaction.fetchReply();
                        betChosen = true;
                    }

                }

                continue;

            }

            if (choice.customId === "poker_new_hand") {

                if (handsLeft <= 0 || cooldownUntil) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, ante, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                dealNewHand();
                await choice.update(renderHand({ npcLine: frankPokerLine("firstCard") }));
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "poker_fold" && stage !== "showdown-shown") {

                const result = settleHand(true);
                await choice.update(renderHand(result));
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "poker_check" && (stage === "second" || stage === "third")) {

                if (stage === "second") {

                    stage = "third";
                    await choice.update(renderHand({ npcLine: frankPokerLine("thirdCard") }));

                } else {

                    // Third-card Check moves straight to showdown.
                    const result = settleHand(false);
                    await choice.update(renderHand(result));

                }

                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "poker_bet" && stage !== "showdown-shown") {

                if (!hasEnoughCoins(userId, ante)) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: "❌ Insufficient balance to bet again.", flags: MessageFlags.Ephemeral });
                    continue;
                }

                currentBet += ante;

                if (stage === "first") {

                    stage = "second";
                    await choice.update(renderHand({ npcLine: frankPokerLine("secondCard") }));

                } else if (stage === "second") {

                    stage = "third";
                    await choice.update(renderHand({ npcLine: frankPokerLine("thirdCard") }));

                } else {

                    // Bet on the third card moves straight to showdown.
                    const result = settleHand(false);
                    await choice.update(renderHand(result));

                }

                message = await interaction.fetchReply();
                continue;

            }

        }

    }

};
