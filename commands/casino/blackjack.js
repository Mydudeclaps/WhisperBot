const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const {
    dealInitialHands,
    hit,
    playDealer,
    handValue,
    resolveHands
} = require("../../services/blackjackService");

const {
    casinoSetupEmbed,
    casinoSessionEmbed,
    casinoSessionSummaryEmbed,
    casinoCooldownBlockedEmbed
} = require("../../utils/embedFactory");

const {
    betSelectRow,
    startButtonRow,
    cooldownRow,
    validateBet
} = require("../../utils/casinoSessionUI");

const { addCoins, getCoins, hasEnoughCoins } = require("../../services/coinService");
const { recordBet } = require("../../services/casinoStatsService");
const { getUser } = require("../../services/userService");
const { npcLineForGame } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot } = require("../../services/jackpotService");
const { getRandomCooldown, getSessionStats, awardGameXP, logGameResult, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { CASINO_SESSION } = require("../../config/gameConfig");

const GAME_TITLE = "🃏 BLACKJACK — Dealer Frank";
const GAME_LABEL = "Blackjack";

function formatCard(card) {
    return `${card.label}${card.suit}`;
}

function formatHand(cards) {
    return cards.map(formatCard).join(" ");
}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("blackjack")
        .setDescription("🃏 Sit down at the blackjack table"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const cooldown = checkCooldown(userId, "blackjack");

        if (cooldown.onCooldown) {

            const { embed, files } = casinoCooldownBlockedEmbed("Blackjack", cooldown.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });

        }

        await interaction.deferReply();

        // ---------------- Setup: bet amount ----------------

        let bet = null;

        const renderSetup = () => {
            const { embed, files } = casinoSetupEmbed(GAME_TITLE, [
                { label: "Bet Amount", value: bet ? `${bet.toLocaleString()} coins` : null }
            ]);
            return {
                embeds: [embed], files,
                components: [betSelectRow("blackjack_bet_select", bet), startButtonRow("blackjack_start", Boolean(bet))]
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

            if (choice.customId === "blackjack_bet_select") {

                const check = validateBet(userId, parseInt(choice.values[0], 10), getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                } else {
                    bet = check.amount;
                    await choice.update(renderSetup());
                }

            } else if (choice.customId === "blackjack_start") {

                if (!bet) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, bet, getCoins);
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
        let playerHand, dealerHand, playerTotal, effectiveBet, doubled, decisionPhase;

        const renderHand = (extra = {}) => {

            const cooldown = cooldownUntil
                ? { seconds: 0, label: cooldownLabel, untilUnix: Math.ceil(cooldownUntil / 1000) }
                : null;

            const bodyLines = [
                `Your Cards: ${formatHand(playerHand)} (${playerTotal}${playerTotal === 21 && playerHand.length === 2 ? " 🎯 BLACKJACK!" : ""})`,
                decisionPhase
                    ? `Dealer: ${formatCard(dealerHand[0])} ???`
                    : `Dealer: ${formatHand(dealerHand)} (${extra.dealerTotal ?? ""})`
            ];

            const { embed, files } = casinoSessionEmbed({
                title: GAME_TITLE,
                roundLabel: `Hand #${handNumber}`,
                betLine: `${effectiveBet.toLocaleString()} coins${doubled ? " (doubled)" : ""}`,
                balance: getCoins(userId),
                playsLeft: handsLeft,
                maxPlays: CASINO_SESSION.MAX_PLAYS_PER_SESSION,
                playsLabel: "Hands Left",
                bodyLines,
                resultLine: extra.resultLine || null,
                color: extra.color || 0x5865F2,
                cooldown,
                npcLine: extra.npcLine || null
            });

            let components;

            if (cooldown) {
                components = [cooldownRow("blackjack_leave")];
            } else if (decisionPhase) {

                const canDouble = playerHand.length === 2 && hasEnoughCoins(userId, effectiveBet);

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("blackjack_hit").setLabel("🔄 Hit").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("blackjack_stand").setLabel("✋ Stand").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("blackjack_double").setLabel("⏫ Double").setStyle(ButtonStyle.Primary).setDisabled(!canDouble)
                )];

            } else {

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("blackjack_new_hand").setLabel("🃏 New Hand").setStyle(ButtonStyle.Success).setDisabled(handsLeft <= 0),
                    new ButtonBuilder().setCustomId("blackjack_change_bet").setLabel("💰 Change Bet").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("blackjack_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                )];

            }

            return { embeds: [embed], files, components };

        };

        const dealNewHand = () => {
            handNumber += 1;
            const dealt = dealInitialHands();
            playerHand = dealt.player;
            dealerHand = dealt.dealer;
            playerTotal = handValue(playerHand).total;
            effectiveBet = bet;
            doubled = false;
            decisionPhase = playerTotal !== 21; // natural blackjack skips straight to resolution
        };

        // Resolves the current hand (dealer plays, payout, stats) and
        // returns the render() extras for the result screen.
        const resolveCurrentHand = () => {

            if (playerTotal <= 21) playDealer(dealerHand);

            const dealerTotal = handValue(dealerHand).total;
            const outcome = resolveHands(playerHand, dealerHand);

            let netChange;
            let won;

            if (outcome === "player_blackjack") {
                const payout = Math.round(effectiveBet * 2.5);
                netChange = payout - effectiveBet;
                addCoins(userId, username, netChange);
                won = true;
            } else if (outcome === "win") {
                const payout = effectiveBet * 2;
                netChange = payout - effectiveBet;
                addCoins(userId, username, netChange);
                won = true;
            } else if (outcome === "lose") {
                netChange = -effectiveBet;
                addCoins(userId, username, netChange);
                won = false;
            } else {
                netChange = 0;
                won = false;
            }

            plays.push({ wagered: effectiveBet, won: netChange > 0 ? netChange + effectiveBet : (outcome === "push" ? effectiveBet : 0) });
            handsLeft -= 1;

            recordBet(userId, "blackjack", effectiveBet, netChange, won);
            awardGameXP(userId, won, netChange);
            logGameResult(userId, "blackjack", effectiveBet, outcome === "push" ? "push" : (won ? "win" : "loss"), plays[plays.length - 1].won);
            contributeJackpot(effectiveBet);

            const npcOutcomeType = outcome === "push" ? "catchphrase" : (won ? "win" : "lose");
            const npcLine = npcLineForGame("blackjack", npcOutcomeType);

            const resultLabels = {
                player_blackjack: `🎯 Blackjack! You win! +${(Math.round(effectiveBet * 2.5) - effectiveBet).toLocaleString()} coins! (3:2)`,
                win: `You win! +${effectiveBet.toLocaleString()} coins! (2x)`,
                lose: `You lost ${effectiveBet.toLocaleString()} coins.`,
                push: `Push — your ${effectiveBet.toLocaleString()} coin bet was returned.`
            };
            const resultColors = { player_blackjack: 0x57F287, win: 0x57F287, lose: 0xED4245, push: 0xFEE75C };

            decisionPhase = false;

            if (handsLeft <= 0) {
                const c = getRandomCooldown();
                cooldownUntil = startCooldown(userId, "blackjack", c.seconds);
                cooldownLabel = c.label;
            }

            return { dealerTotal, resultLine: resultLabels[outcome], color: resultColors[outcome], npcLine };

        };

        dealNewHand();

        await interaction.editReply(
            decisionPhase ? renderHand() : renderHand(resolveCurrentHand())
        );
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
                    clearCooldown(userId, "blackjack");
                    dealNewHand();
                    await interaction.editReply(decisionPhase ? renderHand() : renderHand(resolveCurrentHand()));
                    message = await interaction.fetchReply();
                    continue;
                }

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "blackjack_leave") {

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "blackjack_change_bet") {

                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Bet Amount", value: `${bet.toLocaleString()} coins` }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [betSelectRow("blackjack_bet_select", bet)] });
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
                        bet = check.amount;
                        await betChoice.update(renderHand());
                        message = await interaction.fetchReply();
                        betChosen = true;
                    }

                }

                continue;

            }

            if (choice.customId === "blackjack_new_hand") {

                if (handsLeft <= 0 || cooldownUntil) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, bet, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                dealNewHand();
                await choice.update(decisionPhase ? renderHand() : renderHand(resolveCurrentHand()));
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "blackjack_hit" && decisionPhase) {

                hit(playerHand);
                playerTotal = handValue(playerHand).total;

                if (playerTotal >= 21) {

                    decisionPhase = false;
                    await choice.update(renderHand(resolveCurrentHand()));

                } else {

                    await choice.update(renderHand());

                }

                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "blackjack_stand" && decisionPhase) {

                decisionPhase = false;
                await choice.update(renderHand(resolveCurrentHand()));
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId === "blackjack_double" && decisionPhase && playerHand.length === 2) {

                if (!hasEnoughCoins(userId, effectiveBet)) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: "❌ Insufficient balance to double down.", flags: MessageFlags.Ephemeral });
                    continue;
                }

                effectiveBet *= 2;
                doubled = true;
                hit(playerHand);
                playerTotal = handValue(playerHand).total;
                decisionPhase = false;

                await choice.update(renderHand(resolveCurrentHand()));
                message = await interaction.fetchReply();
                continue;

            }

        }

    }

};
