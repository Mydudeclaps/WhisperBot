const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

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

const { drawCard, compareGuess } = require("../../services/cardService");
const { addCoins, getCoins, hasEnoughCoins } = require("../../services/coinService");
const { recordResult, recordPush } = require("../../services/highlowService");
const { recordBet } = require("../../services/casinoStatsService");
const { getUser } = require("../../services/userService");
const { npcLineForGame } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot } = require("../../services/jackpotService");
const { getRandomCooldown, getSessionStats, awardGameXP, logGameResult, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { CASINO_SESSION } = require("../../config/gameConfig");

const GAME_TITLE = "🎯 HIGH/LOW — Dealer Old Tom";
const GAME_LABEL = "High/Low";


module.exports = {

    data: new SlashCommandBuilder()
        .setName("highlow")
        .setDescription("🎯 Sit down at the High/Low table — bet against the dealer's card"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const cooldown = checkCooldown(userId, "highlow");

        if (cooldown.onCooldown) {

            const { embed, files } = casinoCooldownBlockedEmbed("High/Low", cooldown.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });

        }

        await interaction.deferReply();

        // ---------------- Setup: bet amount only ----------------

        let betAmount = null;

        const renderSetup = () => {
            const { embed, files } = casinoSetupEmbed(GAME_TITLE, [
                { label: "Bet Amount", value: betAmount ? `${betAmount.toLocaleString()} coins` : null }
            ]);
            return {
                embeds: [embed], files,
                components: [betSelectRow("highlow_bet_select", betAmount), startButtonRow("highlow_start", Boolean(betAmount))]
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

            if (choice.customId === "highlow_bet_select") {

                const check = validateBet(userId, parseInt(choice.values[0], 10), getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                } else {
                    betAmount = check.amount;
                    await choice.update(renderSetup());
                }

            } else if (choice.customId === "highlow_start") {

                if (!betAmount) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, betAmount, getCoins);
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
        let roundsLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
        let roundNumber = 1;
        let cooldownUntil = null;
        let cooldownLabel = null;
        let dealerCard = drawCard();
        // true = fresh dealer card is up, waiting on Higher/Lower.
        // false = a round just resolved, showing its result + Next Round.
        // This is the fix: the old version left Higher/Lower clickable
        // on the result screen, silently drawing a NEW dealer card the
        // player never saw the moment they clicked again. Now there's an
        // explicit "Next Round" step that draws and shows the fresh card
        // BEFORE Higher/Lower becomes clickable again.
        let awaitingGuess = true;

        const renderPlaying = (extra = {}) => {

            const cooldown = cooldownUntil
                ? { seconds: 0, label: cooldownLabel, untilUnix: Math.ceil(cooldownUntil / 1000) }
                : null;

            const bodyLines = [`Dealer Card: ${dealerCard.label} ${dealerCard.suit}`];

            if (!awaitingGuess && extra.playerCard) {
                bodyLines.push(`Your Card: ${extra.playerCard.label} ${extra.playerCard.suit}`);
            } else {
                bodyLines.push("Will your card be Higher or Lower?");
            }

            const { embed, files } = casinoSessionEmbed({
                title: GAME_TITLE,
                roundLabel: `Round #${roundNumber}`,
                betLine: `${betAmount.toLocaleString()} coins`,
                balance: getCoins(userId),
                playsLeft: roundsLeft,
                maxPlays: CASINO_SESSION.MAX_PLAYS_PER_SESSION,
                playsLabel: "Rounds Left",
                bodyLines,
                resultLine: extra.resultLine || null,
                color: extra.color || 0x3498DB,
                cooldown,
                npcLine: extra.npcLine || null
            });

            let components;

            if (cooldown) {

                components = [cooldownRow("highlow_leave")];

            } else if (awaitingGuess) {

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("highlow_high").setLabel("⬆ Higher").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("highlow_low").setLabel("⬇ Lower").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("highlow_change_bet").setLabel("💰 Change Bet").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("highlow_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                )];

            } else {

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("highlow_next_round").setLabel("🔄 Next Round").setStyle(ButtonStyle.Success).setDisabled(roundsLeft <= 0),
                    new ButtonBuilder().setCustomId("highlow_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                )];

            }

            return { embeds: [embed], files, components };

        };

        await interaction.editReply(renderPlaying());
        message = await interaction.fetchReply();

        let leftSession = false;

        while (!leftSession) {

            const waitTime = cooldownUntil ? Math.max(1000, cooldownUntil - Date.now()) : CASINO_SESSION.SESSION_IDLE_TIMEOUT_MS;

            let choice;
            try {
                choice = await message.awaitMessageComponent({ time: waitTime, filter: i => i.user.id === userId });
            } catch (err) {

                if (cooldownUntil && Date.now() >= cooldownUntil) {
                    roundsLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
                    cooldownUntil = null;
                    cooldownLabel = null;
                    clearCooldown(userId, "highlow");
                    dealerCard = drawCard();
                    awaitingGuess = true;
                    await interaction.editReply(renderPlaying());
                    message = await interaction.fetchReply();
                    continue;
                }

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "highlow_leave") {

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "highlow_change_bet") {

                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Bet Amount", value: `${betAmount.toLocaleString()} coins` }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [betSelectRow("highlow_bet_select", betAmount)] });
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
                        betAmount = check.amount;
                        await betChoice.update(renderPlaying());
                        message = await interaction.fetchReply();
                        betChosen = true;
                    }

                }

                continue;

            }

            if (choice.customId === "highlow_high" || choice.customId === "highlow_low") {

                if (roundsLeft <= 0 || cooldownUntil || !awaitingGuess) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, betAmount, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                const guess = choice.customId === "highlow_high" ? "high" : "low";
                const playerCard = drawCard();
                const outcome = compareGuess(guess, dealerCard, playerCard);

                let netChange = 0;
                let won = false;

                if (outcome === "win") {
                    netChange = betAmount;
                    won = true;
                    addCoins(userId, username, netChange);
                    recordResult(userId, true, betAmount);
                } else if (outcome === "lose") {
                    netChange = -betAmount;
                    addCoins(userId, username, netChange);
                    recordResult(userId, false, betAmount);
                } else {
                    recordPush(userId);
                }

                plays.push({ wagered: betAmount, won: won ? betAmount * 2 : (outcome === "push" ? betAmount : 0) });
                roundsLeft -= 1;

                recordBet(userId, "highlow", betAmount, netChange, won);
                awardGameXP(userId, won, netChange);
                logGameResult(userId, "highlow", betAmount, outcome === "push" ? "push" : (won ? "win" : "loss"), plays[plays.length - 1].won);
                contributeJackpot(betAmount);

                const npcOutcomeType = outcome === "push" ? "catchphrase" : (won ? "win" : "lose");
                const npcLine = npcLineForGame("highlow", npcOutcomeType);

                const resultLabels = {
                    win: `You win! +${(betAmount * 2).toLocaleString()} coins! (2x)`,
                    lose: `You lost ${betAmount.toLocaleString()} coins.`,
                    push: `Push — your ${betAmount.toLocaleString()} coin bet was returned.`
                };
                const resultColors = { win: 0x57F287, lose: 0xED4245, push: 0xFEE75C };

                let newCooldown = null;
                if (roundsLeft <= 0) {
                    const c = getRandomCooldown();
                    cooldownUntil = startCooldown(userId, "highlow", c.seconds);
                    cooldownLabel = c.label;
                }

                awaitingGuess = false;

                await choice.update(renderPlaying({
                    playerCard,
                    resultLine: resultLabels[outcome],
                    color: resultColors[outcome],
                    npcLine
                }));

                message = await interaction.fetchReply();

            }

            if (choice.customId === "highlow_next_round") {

                if (cooldownUntil) { await choice.deferUpdate(); continue; }

                roundNumber += 1;
                dealerCard = drawCard();
                awaitingGuess = true;

                await choice.update(renderPlaying());
                message = await interaction.fetchReply();

            }

        }

    }

};
