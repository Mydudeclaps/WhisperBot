const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

const {
    ticHouseEmbed,
    ticChallengeEmbed,
    casinoSetupEmbed,
    casinoSessionSummaryEmbed,
    casinoCooldownBlockedEmbed
} = require("../../utils/embedFactory");

const {
    betSelectRow,
    startButtonRow,
    cooldownRow
} = require("../../utils/casinoSessionUI");

const {
    emptyBoard,
    checkWinner,
    isBoardFull,
    isValidMove,
    getAIMove,
    getRandomMove,
    shouldHouseGoFirst,
    createChallenge,
    setChallengeMessage
} = require("../../services/ticService");

const { addCoins, getCoins, hasEnoughCoins } = require("../../services/coinService");
const { recordBet } = require("../../services/casinoStatsService");
const { getUser } = require("../../services/userService");
const { npcLineForGame } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot } = require("../../services/jackpotService");
const { getRandomCooldown, getSessionStats, awardGameXP, logGameResult, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { TIC_TAC_TOE, CASINO_SESSION } = require("../../config/gameConfig");

const GAME_LABEL = "Tic Tac Toe";
const COLORS_DEFAULT = 0x3498DB;

const HOUSE_BET_OPTIONS = TIC_TAC_TOE.HOUSE_BET_OPTIONS.map(amount => ({
    label: `💰 ${amount.toLocaleString()} coins`,
    value: String(amount)
}));

function houseBetSelectRow(selectedValue = null) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("tic_bet_select")
        .setPlaceholder("Select Bet Amount")
        .addOptions(HOUSE_BET_OPTIONS.map(o => ({ ...o, default: o.value === String(selectedValue) })));
    return new ActionRowBuilder().addComponents(menu);
}

function boardButtonRows(board, disabled) {

    const rows = [];

    for (let r = 0; r < 3; r++) {

        const row = new ActionRowBuilder();

        for (let c = 0; c < 3; c++) {

            const i = r * 3 + c;
            const cell = board[i];

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tic_move_${i}`)
                    .setLabel(cell === "X" ? "❌" : cell === "O" ? "⭕" : "\u200b")
                    .setStyle(cell === "X" ? ButtonStyle.Danger : cell === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(disabled || cell !== "")
            );

        }

        rows.push(row);

    }

    return rows;

}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("tic")
        .setDescription("❌⭕ Play Gambling Tic Tac Toe — the house, or challenge a player")
        .addUserOption(option =>
            option.setName("opponent").setDescription("Challenge this player instead of the house").setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription(`Challenge bet amount (${TIC_TAC_TOE.CHALLENGE_MIN_BET.toLocaleString()}-${TIC_TAC_TOE.CHALLENGE_MAX_BET.toLocaleString()} coins)`)
                .setRequired(false)
                .setMinValue(TIC_TAC_TOE.CHALLENGE_MIN_BET)
                .setMaxValue(TIC_TAC_TOE.CHALLENGE_MAX_BET)
        ),

    async execute(interaction) {

        const opponent = interaction.options.getUser("opponent");
        const amount = interaction.options.getInteger("amount");

        if (opponent) {
            return this.handleChallenge(interaction, opponent, amount);
        }

        return this.handleHouseSession(interaction);

    },

    async handleChallenge(interaction, opponent, amount) {

        const challengerId = interaction.user.id;
        const challengerName = interaction.user.username;

        getUser(challengerId, challengerName);

        if (!amount) {
            return interaction.reply({
                content: `❌ Please include a bet amount: \`/tic opponent:@user amount:<${TIC_TAC_TOE.CHALLENGE_MIN_BET}-${TIC_TAC_TOE.CHALLENGE_MAX_BET}>\``,
                flags: MessageFlags.Ephemeral
            });
        }

        if (opponent.id === challengerId) {
            return interaction.reply({ content: "❌ You can't challenge yourself!", flags: MessageFlags.Ephemeral });
        }

        if (opponent.bot) {
            return interaction.reply({ content: "❌ You can't challenge a bot!", flags: MessageFlags.Ephemeral });
        }

        if (!hasEnoughCoins(challengerId, amount)) {
            return interaction.reply({
                content: `❌ You don't have enough coins for that bet. Your balance: ${getCoins(challengerId).toLocaleString()} coins.`,
                flags: MessageFlags.Ephemeral
            });
        }

        getUser(opponent.id, opponent.username);

        const challengeId = createChallenge(challengerId, opponent.id, amount);

        const { embed, files } = ticChallengeEmbed(challengerName, amount);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tic_accept_${challengeId}`).setLabel("✅ Accept").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`tic_decline_${challengeId}`).setLabel("❌ Decline").setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ content: `<@${opponent.id}>`, embeds: [embed], files, components: [row] });

        const message = await interaction.fetchReply();
        setChallengeMessage(challengeId, message.id, message.channelId);

    },

    async handleHouseSession(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const cooldownCheck = checkCooldown(userId, "tic");

        if (cooldownCheck.onCooldown) {
            const { embed, files } = casinoCooldownBlockedEmbed("Tic Tac Toe", cooldownCheck.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();

        // ---------------- Setup: bet amount ----------------

        let bet = null;

        const renderSetup = () => {
            const { embed, files } = casinoSetupEmbed("❌⭕ TIC TAC TOE — Dealer Frank", [
                { label: "Bet Amount", value: bet ? `${bet.toLocaleString()} coins` : null }
            ]);
            return {
                embeds: [embed], files,
                components: [houseBetSelectRow(bet), startButtonRow("tic_start", Boolean(bet))]
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

            if (choice.customId === "tic_bet_select") {

                const requested = parseInt(choice.values[0], 10);
                if (requested > getCoins(userId)) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: "❌ Insufficient balance for that bet.", flags: MessageFlags.Ephemeral });
                } else {
                    bet = requested;
                    await choice.update(renderSetup());
                }

            } else if (choice.customId === "tic_start") {

                if (!bet) { await choice.deferUpdate(); continue; }

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
        let gamesLeft = TIC_TAC_TOE.MAX_GAMES_PER_SESSION;
        let roundNumber = 0;
        let cooldownUntil = null;
        let cooldownLabel = null;
        let board, gameOver;

        const renderRound = (extra = {}) => {

            const cooldown = cooldownUntil
                ? { seconds: 0, label: cooldownLabel, untilUnix: Math.ceil(cooldownUntil / 1000) }
                : null;

            const { embed, files } = ticHouseEmbed({
                stage: gameOver ? "result" : "playing",
                roundNumber,
                bet,
                balance: getCoins(userId),
                gamesLeft,
                maxGames: TIC_TAC_TOE.MAX_GAMES_PER_SESSION,
                board,
                resultLine: extra.resultLine || null,
                npcLine: extra.npcLine || null,
                color: extra.color || COLORS_DEFAULT,
                cooldown
            });

            let components;

            if (cooldown) {

                components = [cooldownRow("tic_leave")];

            } else if (gameOver) {

                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("tic_next_game").setLabel("🔄 Next Game").setStyle(ButtonStyle.Success).setDisabled(gamesLeft <= 0),
                    new ButtonBuilder().setCustomId("tic_change_bet").setLabel("💰 Change Bet").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("tic_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                )];

            } else {

                components = [
                    ...boardButtonRows(board, false),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("tic_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                    )
                ];

            }

            return { embeds: [embed], files, components };

        };

        const settleGame = (outcome) => {

            // outcome: "win" | "lose" | "draw"
            let netChange, won = false, resultLine, npcLine;

            if (outcome === "win") {
                netChange = bet * (TIC_TAC_TOE.HOUSE_PAYOUT_MULTIPLIER - 1);
                addCoins(userId, username, netChange);
                won = true;
                resultLine = `🎉 YOU WIN! +${netChange.toLocaleString()} coins!`;
                npcLine = npcLineForGame("tic", "win");
            } else if (outcome === "lose") {
                netChange = -bet;
                addCoins(userId, username, netChange);
                resultLine = `❌ The house wins. You lost ${bet.toLocaleString()} coins.`;
                npcLine = npcLineForGame("tic", "lose");
            } else {
                netChange = 0;
                resultLine = `🤝 Draw — your ${bet.toLocaleString()} coin bet was returned.`;
                npcLine = npcLineForGame("tic", "catchphrase");
            }

            const wonAmount = outcome === "win" ? bet * TIC_TAC_TOE.HOUSE_PAYOUT_MULTIPLIER : (outcome === "draw" ? bet : 0);
            plays.push({ wagered: bet, won: wonAmount });
            gamesLeft -= 1;

            recordBet(userId, "tic", bet, netChange, won);
            awardGameXP(userId, won, netChange);
            logGameResult(userId, "tic", bet, outcome === "draw" ? "push" : (won ? "win" : "loss"), wonAmount);
            contributeJackpot(bet);

            gameOver = true;

            if (gamesLeft <= 0) {
                const c = getRandomCooldown();
                cooldownUntil = startCooldown(userId, "tic", c.seconds);
                cooldownLabel = c.label;
            }

            return {
                resultLine,
                npcLine,
                color: won ? 0x57F287 : (outcome === "draw" ? 0xFEE75C : 0xED4245)
            };

        };

        const dealNewGame = () => {
            roundNumber += 1;
            board = emptyBoard();
            gameOver = false;

            // Anti-predictability fix: the house sometimes opens instead
            // of always waiting on the player. A random (not "optimal")
            // move, since an empty board has no win/block to make
            // anyway — getAIMove() would just land on center every time,
            // which is exactly the predictability this is fixing.
            if (shouldHouseGoFirst()) {
                const openingMove = getRandomMove(board);
                if (openingMove !== null) board[openingMove] = "O";
            }
        };

        dealNewGame();

        await interaction.editReply(renderRound());
        message = await interaction.fetchReply();

        let leftSession = false;

        while (!leftSession) {

            const waitTime = cooldownUntil ? Math.max(1000, cooldownUntil - Date.now()) : CASINO_SESSION.SESSION_IDLE_TIMEOUT_MS;

            let choice;
            try {
                choice = await message.awaitMessageComponent({ time: waitTime, filter: i => i.user.id === userId });
            } catch (err) {

                if (cooldownUntil && Date.now() >= cooldownUntil) {
                    gamesLeft = TIC_TAC_TOE.MAX_GAMES_PER_SESSION;
                    cooldownUntil = null;
                    cooldownLabel = null;
                    clearCooldown(userId, "tic");
                    dealNewGame();
                    await interaction.editReply(renderRound());
                    message = await interaction.fetchReply();
                    continue;
                }

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "tic_leave") {

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "tic_change_bet") {

                const setupView = casinoSetupEmbed("❌⭕ TIC TAC TOE — Dealer Frank", [{ label: "Bet Amount", value: `${bet.toLocaleString()} coins` }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [houseBetSelectRow(bet)] });
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

                    const requested = parseInt(betChoice.values[0], 10);
                    if (requested > getCoins(userId)) {
                        await betChoice.deferUpdate();
                        await interaction.followUp({ content: "❌ Insufficient balance for that bet.", flags: MessageFlags.Ephemeral });
                    } else {
                        bet = requested;
                        await betChoice.update(renderRound());
                        message = await interaction.fetchReply();
                        betChosen = true;
                    }

                }

                continue;

            }

            if (choice.customId === "tic_next_game") {

                if (gamesLeft <= 0 || cooldownUntil) { await choice.deferUpdate(); continue; }

                if (!hasEnoughCoins(userId, bet)) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: "❌ Insufficient balance for that bet.", flags: MessageFlags.Ephemeral });
                    continue;
                }

                dealNewGame();
                await choice.update(renderRound());
                message = await interaction.fetchReply();
                continue;

            }

            if (choice.customId.startsWith("tic_move_") && !gameOver) {

                const position = parseInt(choice.customId.replace("tic_move_", ""), 10);

                if (!isValidMove(board, position)) { await choice.deferUpdate(); continue; }

                board[position] = "X";

                let winner = checkWinner(board);

                if (winner === "X") {

                    await choice.update(renderRound(settleGame("win")));
                    message = await interaction.fetchReply();
                    continue;

                }

                if (isBoardFull(board)) {

                    await choice.update(renderRound(settleGame("draw")));
                    message = await interaction.fetchReply();
                    continue;

                }

                const aiMove = getAIMove(board, "O", "X");
                if (aiMove !== null) board[aiMove] = "O";

                winner = checkWinner(board);

                if (winner === "O") {

                    await choice.update(renderRound(settleGame("lose")));

                } else if (isBoardFull(board)) {

                    await choice.update(renderRound(settleGame("draw")));

                } else {

                    await choice.update(renderRound());

                }

                message = await interaction.fetchReply();

            }

        }

    }

};
