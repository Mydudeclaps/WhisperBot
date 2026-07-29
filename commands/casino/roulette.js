const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
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

const { spin, colorOf, resolveBet } = require("../../services/rouletteService");
const { addCoins, getCoins } = require("../../services/coinService");
const { recordBet } = require("../../services/casinoStatsService");
const { getUser } = require("../../services/userService");
const { npcLineForGame } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot } = require("../../services/jackpotService");
const { getRandomCooldown, getSessionStats, awardGameXP, logGameResult, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { CASINO_SESSION } = require("../../config/gameConfig");

const GAME_TITLE = "🔴 ROULETTE — Dealer Lucy";
const GAME_LABEL = "Roulette";

const BET_TYPE_OPTIONS = [
    { label: "🔴 Red (2x)", value: "color:red" },
    { label: "⚫ Black (2x)", value: "color:black" },
    { label: "Odd (2x)", value: "parity:odd" },
    { label: "Even (2x)", value: "parity:even" },
    { label: "1-12 (3x)", value: "dozen:1-12" },
    { label: "13-24 (3x)", value: "dozen:13-24" },
    { label: "25-36 (3x)", value: "dozen:25-36" },
    { label: "🎯 Specific Number... (36x)", value: "number:prompt" }
];

function betTypeLabel(betType, betValue) {
    if (betType === "color") return betValue === "red" ? "🔴 Red" : "⚫ Black";
    if (betType === "parity") return betValue === "even" ? "Even" : "Odd";
    if (betType === "dozen") return betValue;
    if (betType === "number") return `Number ${betValue}`;
    return "—";
}

function betTypeSelectRow() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("roulette_bettype_select")
        .setPlaceholder("Select Bet Type")
        .addOptions(BET_TYPE_OPTIONS);
    return new ActionRowBuilder().addComponents(menu);
}

function numberModal() {
    const modal = new ModalBuilder().setCustomId("roulette_number_modal").setTitle("Bet on a Specific Number");
    const input = new TextInputBuilder()
        .setCustomId("roulette_number_input")
        .setLabel("Number (0-36)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("roulette")
        .setDescription("🔴 Sit down at the Whispers Roulette table"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const cooldown = checkCooldown(userId, "roulette");

        if (cooldown.onCooldown) {

            const { embed, files } = casinoCooldownBlockedEmbed("Roulette", cooldown.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });

        }

        await interaction.deferReply();

        // ---------------- Setup: bet type + bet amount ----------------

        let betType = null;
        let betValue = null;
        let betAmount = null;

        const renderSetup = () => {
            const { embed, files } = casinoSetupEmbed(GAME_TITLE, [
                { label: "Bet Type", value: betType ? betTypeLabel(betType, betValue) : null },
                { label: "Bet Amount", value: betAmount ? `${betAmount.toLocaleString()} coins` : null }
            ]);
            return {
                embeds: [embed], files,
                components: [
                    betTypeSelectRow(),
                    betSelectRow("roulette_bet_select", betAmount),
                    startButtonRow("roulette_start", Boolean(betType && betAmount))
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

            if (choice.customId === "roulette_bettype_select") {

                const [type, value] = choice.values[0].split(":");

                if (type === "number") {

                    await choice.showModal(numberModal());

                    try {

                        const modalSubmit = await choice.awaitModalSubmit({
                            time: 60000,
                            filter: i => i.user.id === userId && i.customId === "roulette_number_modal"
                        });

                        const num = parseInt(modalSubmit.fields.getTextInputValue("roulette_number_input"), 10);

                        if (Number.isNaN(num) || num < 0 || num > 36) {

                            await modalSubmit.reply({ content: "⚠️ Please enter a number between 0 and 36.", flags: MessageFlags.Ephemeral });

                        } else {

                            betType = "number";
                            betValue = String(num);
                            await modalSubmit.update(renderSetup());

                        }

                    } catch (err) {
                        // Modal timed out or was dismissed — leave selection unset.
                    }

                } else {

                    betType = type;
                    betValue = value;
                    await choice.update(renderSetup());

                }

            } else if (choice.customId === "roulette_bet_select") {

                const check = validateBet(userId, parseInt(choice.values[0], 10), getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                } else {
                    betAmount = check.amount;
                    await choice.update(renderSetup());
                }

            } else if (choice.customId === "roulette_start") {

                if (!betType || !betAmount) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, betAmount, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                await choice.deferUpdate();
                setupDone = true;

            }

            message = await interaction.fetchReply();

        }

        // ---------------- Playing ----------------

        const plays = [];
        let spinsLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
        let spinNumber = 0;
        let cooldownUntil = null;
        let cooldownLabel = null;

        const renderPlaying = (extra = {}) => {

            const cooldown = cooldownUntil
                ? { seconds: 0, label: cooldownLabel, untilUnix: Math.ceil(cooldownUntil / 1000) }
                : null;

            const bodyLines = extra.number !== undefined
                ? [`🔄 ${extra.colorEmoji} **${extra.number}**`]
                : ["🎰 Ready to spin..."];

            const { embed, files } = casinoSessionEmbed({
                title: GAME_TITLE,
                roundLabel: `Spin #${spinNumber}`,
                betLine: `${betAmount.toLocaleString()} coins (${betTypeLabel(betType, betValue)})`,
                balance: getCoins(userId),
                playsLeft: spinsLeft,
                maxPlays: CASINO_SESSION.MAX_PLAYS_PER_SESSION,
                playsLabel: "Spins Left",
                bodyLines,
                resultLine: extra.resultLine || null,
                color: extra.color || 0xE74C3C,
                cooldown,
                npcLine: extra.npcLine || null
            });

            const components = cooldown
                ? [cooldownRow("roulette_leave")]
                : [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("roulette_spin").setLabel("🎰 SPIN").setStyle(ButtonStyle.Success).setDisabled(spinsLeft <= 0),
                    new ButtonBuilder().setCustomId("roulette_change_bettype").setLabel("🎯 Change Bet Type").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("roulette_change_bet").setLabel("💰 Change Bet").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("roulette_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
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
                    spinsLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
                    cooldownUntil = null;
                    cooldownLabel = null;
                    clearCooldown(userId, "roulette");
                    await interaction.editReply(renderPlaying());
                    message = await interaction.fetchReply();
                    continue;
                }

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "roulette_leave") {

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "roulette_change_bettype") {

                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Bet Type", value: betTypeLabel(betType, betValue) }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [betTypeSelectRow()] });
                message = await interaction.fetchReply();

                let chosen = false;
                while (!chosen) {

                    let typeChoice;
                    try {
                        typeChoice = await message.awaitMessageComponent({ time: CASINO_SESSION.SETUP_TIMEOUT_MS, filter: i => i.user.id === userId });
                    } catch (err) {
                        const stats = getSessionStats(plays);
                        const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                        await interaction.editReply({ embeds: [embed], files, components: [] });
                        return;
                    }

                    const [type, value] = typeChoice.values[0].split(":");

                    if (type === "number") {

                        await typeChoice.showModal(numberModal());

                        try {

                            const modalSubmit = await typeChoice.awaitModalSubmit({
                                time: 60000,
                                filter: i => i.user.id === userId && i.customId === "roulette_number_modal"
                            });

                            const num = parseInt(modalSubmit.fields.getTextInputValue("roulette_number_input"), 10);

                            if (Number.isNaN(num) || num < 0 || num > 36) {
                                await modalSubmit.reply({ content: "⚠️ Please enter a number between 0 and 36.", flags: MessageFlags.Ephemeral });
                            } else {
                                betType = "number";
                                betValue = String(num);
                                await modalSubmit.update(renderPlaying());
                                message = await interaction.fetchReply();
                                chosen = true;
                            }

                        } catch (err) {
                            // timed out / dismissed — stay on the bet-type prompt
                        }

                    } else {

                        betType = type;
                        betValue = value;
                        await typeChoice.update(renderPlaying());
                        message = await interaction.fetchReply();
                        chosen = true;

                    }

                }

                continue;

            }

            if (choice.customId === "roulette_change_bet") {

                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Bet Amount", value: `${betAmount.toLocaleString()} coins` }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [betSelectRow("roulette_bet_select", betAmount)] });
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

            if (choice.customId === "roulette_spin") {

                if (spinsLeft <= 0 || cooldownUntil) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, betAmount, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                spinNumber += 1;

                const number = spin();
                const color = colorOf(number);
                const result = resolveBet(betType, betValue, number);

                let netChange;
                if (result.won) {
                    const payout = betAmount * result.multiplier;
                    netChange = payout - betAmount;
                    addCoins(userId, username, netChange);
                } else {
                    netChange = -betAmount;
                    addCoins(userId, username, netChange);
                }

                plays.push({ wagered: betAmount, won: result.won ? betAmount * result.multiplier : 0 });
                spinsLeft -= 1;

                recordBet(userId, "roulette", betAmount, netChange, result.won);
                awardGameXP(userId, result.won, netChange);
                logGameResult(userId, "roulette", betAmount, result.won ? "win" : "loss", plays[plays.length - 1].won);
                contributeJackpot(betAmount);

                const npcLine = npcLineForGame("roulette", result.won ? "win" : "lose");
                const colorEmoji = { red: "🔴", black: "⚫", green: "🟢" }[color];

                const resultLine = result.won
                    ? `You win! +${(betAmount * result.multiplier).toLocaleString()} coins! (${result.multiplier}x)`
                    : `You lost ${betAmount.toLocaleString()} coins.`;

                if (spinsLeft <= 0) {
                    const c = getRandomCooldown();
                    cooldownUntil = startCooldown(userId, "roulette", c.seconds);
                    cooldownLabel = c.label;
                }

                await choice.update(renderPlaying({
                    number, colorEmoji,
                    resultLine,
                    color: result.won ? 0x57F287 : 0xED4245,
                    npcLine
                }));

                message = await interaction.fetchReply();

            }

        }

    }

};
