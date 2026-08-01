const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
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

const { rollDice, resolveDiceBet, getRandomCooldown, getSessionStats, awardGameXP, logGameResult, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { addCoins, getCoins } = require("../../services/coinService");
const { recordBet } = require("../../services/casinoStatsService");
const { getUser } = require("../../services/userService");
const { npcLineForGame } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot } = require("../../services/jackpotService");
const { CASINO_SESSION } = require("../../config/gameConfig");

const GAME_TITLE = "🎲 DICE ARENA — Dealer Old Tom";
const GAME_LABEL = "Dice";

const GUESS_OPTIONS = [
    { label: "Over 7 (2x)", value: "over" },
    { label: "Under 7 (2x)", value: "under" },
    { label: "Exactly 7 (5x)", value: "exact" }
];
const GUESS_LABELS = { over: "Over 7", under: "Under 7", exact: "Exactly 7" };

function guessSelectRow(selected = null) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("dice_guess_select")
        .setPlaceholder("Select Guess")
        .addOptions(GUESS_OPTIONS.map(o => ({ ...o, default: o.value === selected })));
    return new ActionRowBuilder().addComponents(menu);
}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("dice")
        .setDescription("🎲 Sit down at the Dice Arena — bet on the total of two dice"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const cooldown = checkCooldown(userId, "dice");

        if (cooldown.onCooldown) {

            const { embed, files } = casinoCooldownBlockedEmbed("Dice", cooldown.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });

        }

        await interaction.deferReply();

        // ---------------- Setup: guess + bet amount ----------------

        let guess = null;
        let betAmount = null;

        const renderSetup = () => {
            const { embed, files } = casinoSetupEmbed(GAME_TITLE, [
                { label: "Guess", value: guess ? GUESS_LABELS[guess] : null },
                { label: "Bet Amount", value: betAmount ? `${betAmount.toLocaleString()} coins` : null }
            ]);
            return {
                embeds: [embed], files,
                components: [
                    guessSelectRow(guess),
                    betSelectRow("dice_bet_select", betAmount),
                    startButtonRow("dice_start", Boolean(guess && betAmount))
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

            if (choice.customId === "dice_guess_select") {

                guess = choice.values[0];
                await choice.update(renderSetup());

            } else if (choice.customId === "dice_bet_select") {

                const check = validateBet(userId, parseInt(choice.values[0], 10), getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                } else {
                    betAmount = check.amount;
                    await choice.update(renderSetup());
                }

            } else if (choice.customId === "dice_start") {

                if (!guess || !betAmount) { await choice.deferUpdate(); continue; }

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
        let rollsLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
        let rollNumber = 0;
        let cooldownUntil = null;
        let cooldownLabel = null;

        const renderPlaying = (extra = {}) => {

            const cooldown = cooldownUntil
                ? { seconds: 0, label: cooldownLabel, untilUnix: Math.ceil(cooldownUntil / 1000) }
                : null;

            const bodyLines = extra.roll
                ? [`[ 🎲 ${extra.roll.die1} ] [ 🎲 ${extra.roll.die2} ] = ${extra.roll.total}`]
                : ["[ 🎲 ] [ 🎲 ]"];

            const { embed, files } = casinoSessionEmbed({
                title: GAME_TITLE,
                roundLabel: `Roll #${rollNumber}`,
                betLine: `${betAmount.toLocaleString()} coins (${GUESS_LABELS[guess]})`,
                balance: getCoins(userId),
                playsLeft: rollsLeft,
                maxPlays: CASINO_SESSION.MAX_PLAYS_PER_SESSION,
                playsLabel: "Rolls Left",
                bodyLines,
                resultLine: extra.resultLine || null,
                color: extra.color || 0x3498DB,
                cooldown,
                npcLine: extra.npcLine || null
            });

            const components = cooldown
                ? [cooldownRow("dice_leave")]
                : [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("dice_roll").setLabel("🎯 ROLL").setStyle(ButtonStyle.Success).setDisabled(rollsLeft <= 0),
                    new ButtonBuilder().setCustomId("dice_change_guess").setLabel("🎲 Change Guess").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("dice_change_bet").setLabel("💰 Change Bet").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("dice_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                  )];

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
                    rollsLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
                    cooldownUntil = null;
                    cooldownLabel = null;
                    clearCooldown(userId, "dice");
                    await interaction.editReply(renderPlaying());
                    message = await interaction.fetchReply();
                    continue;
                }

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "dice_leave") {

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "dice_change_guess") {

                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Guess", value: GUESS_LABELS[guess] }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [guessSelectRow(guess)] });
                message = await interaction.fetchReply();

                let chosen = false;
                while (!chosen) {

                    let guessChoice;
                    try {
                        guessChoice = await message.awaitMessageComponent({ time: CASINO_SESSION.SETUP_TIMEOUT_MS, filter: i => i.user.id === userId });
                    } catch (err) {
                        const stats = getSessionStats(plays);
                        const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                        await interaction.editReply({ embeds: [embed], files, components: [] });
                        return;
                    }

                    guess = guessChoice.values[0];
                    await guessChoice.update(renderPlaying());
                    message = await interaction.fetchReply();
                    chosen = true;

                }

                continue;

            }

            if (choice.customId === "dice_change_bet") {

                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Bet Amount", value: `${betAmount.toLocaleString()} coins` }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [betSelectRow("dice_bet_select", betAmount)] });
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

            if (choice.customId === "dice_roll") {

                if (rollsLeft <= 0 || cooldownUntil) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, betAmount, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                rollNumber += 1;

                const roll = rollDice();
                const { won, multiplier } = resolveDiceBet(guess, roll.total);

                let netChange;
                if (won) {
                    const payout = betAmount * multiplier;
                    netChange = payout - betAmount;
                    addCoins(userId, username, netChange);
                } else {
                    netChange = -betAmount;
                    addCoins(userId, username, netChange);
                }

                plays.push({ wagered: betAmount, won: won ? betAmount * multiplier : 0 });
                rollsLeft -= 1;

                recordBet(userId, "dice", betAmount, netChange, won);
                awardGameXP(userId, won, netChange);
                logGameResult(userId, "dice", betAmount, won ? "win" : "loss", plays[plays.length - 1].won);
                contributeJackpot(betAmount);

                const npcLine = npcLineForGame("dice", won ? "win" : "lose");

                const resultLine = won
                    ? `You win! +${(betAmount * multiplier).toLocaleString()} coins! (${multiplier}x)`
                    : `You lost ${betAmount.toLocaleString()} coins.`;

                let newCooldown = null;
                if (rollsLeft <= 0) {
                    const c = getRandomCooldown();
                    cooldownUntil = startCooldown(userId, "dice", c.seconds);
                    cooldownLabel = c.label;
                }

                await choice.update(renderPlaying({
                    roll,
                    resultLine,
                    color: won ? 0x57F287 : 0xED4245,
                    npcLine
                }));

                message = await interaction.fetchReply();

            }

        }

    }

};
