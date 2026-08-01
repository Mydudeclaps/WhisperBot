// Handles the PvP side of /tic — Accept/Decline on a challenge, and the
// alternating moves once accepted. Routed through interactionCreate.js
// the same way lore_/casino_ buttons are, since (unlike house mode,
// which lives entirely in one command's local session loop) both
// players click the same message across separate interaction events.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");

const {
    getChallenge,
    acceptChallenge,
    declineChallenge,
    applyChallengeMove,
    isValidMove
} = require("../services/ticService");

const { addCoins, hasEnoughCoins } = require("../services/coinService");
const { recordBet } = require("../services/casinoStatsService");
const { getUser } = require("../services/userService");
const { awardGameXP, logGameResult } = require("../services/casinoService");
const { ticMatchEmbed } = require("../utils/embedFactory");


function boardButtonRows(board, disabled) {

    const rows = [];

    for (let r = 0; r < 3; r++) {

        const row = new ActionRowBuilder();

        for (let c = 0; c < 3; c++) {

            const i = r * 3 + c;
            const cell = board[i];

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tic_pvp_move_${i}`)
                    .setLabel(cell === "X" ? "❌" : cell === "O" ? "⭕" : "\u200b")
                    .setStyle(cell === "X" ? ButtonStyle.Danger : cell === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(disabled || cell !== "")
            );

        }

        rows.push(row);

    }

    return rows;

}


async function settleAndRender(interaction, challenge, player1, player2) {

    const won1 = challenge.winner_id === challenge.player1_id;
    const won2 = challenge.winner_id === challenge.player2_id;
    const isDraw = challenge.status === "completed" && !challenge.winner_id;

    let resultLine;
    let color = 0x3498DB;

    if (isDraw) {

        resultLine = "🤝 **Draw!** Both players' bets were refunded.";
        addCoins(challenge.player1_id, player1.username, 0); // no-op, kept for symmetry/clarity
        color = 0xFEE75C;

    } else if (won1) {

        resultLine = `🎉 **${player1.username} wins!** +${challenge.bet_amount.toLocaleString()} coins`;
        addCoins(challenge.player1_id, player1.username, challenge.bet_amount);
        addCoins(challenge.player2_id, player2.username, -challenge.bet_amount);
        color = 0x57F287;

    } else {

        resultLine = `🎉 **${player2.username} wins!** +${challenge.bet_amount.toLocaleString()} coins`;
        addCoins(challenge.player2_id, player2.username, challenge.bet_amount);
        addCoins(challenge.player1_id, player1.username, -challenge.bet_amount);
        color = 0x57F287;

    }

    // Stats/XP/history for both players, from each one's own perspective.
    recordBet(challenge.player1_id, "tic", challenge.bet_amount, isDraw ? 0 : (won1 ? challenge.bet_amount : -challenge.bet_amount), won1);
    recordBet(challenge.player2_id, "tic", challenge.bet_amount, isDraw ? 0 : (won2 ? challenge.bet_amount : -challenge.bet_amount), won2);
    awardGameXP(challenge.player1_id, won1, isDraw ? 0 : (won1 ? challenge.bet_amount : -challenge.bet_amount));
    awardGameXP(challenge.player2_id, won2, isDraw ? 0 : (won2 ? challenge.bet_amount : -challenge.bet_amount));
    logGameResult(challenge.player1_id, "tic", challenge.bet_amount, isDraw ? "push" : (won1 ? "win" : "loss"), won1 ? challenge.bet_amount * 2 : (isDraw ? challenge.bet_amount : 0));
    logGameResult(challenge.player2_id, "tic", challenge.bet_amount, isDraw ? "push" : (won2 ? "win" : "loss"), won2 ? challenge.bet_amount * 2 : (isDraw ? challenge.bet_amount : 0));

    const { embed, files } = ticMatchEmbed({
        player1Name: player1.username,
        player2Name: player2.username,
        board: challenge.board,
        turnName: "",
        betAmount: challenge.bet_amount,
        resultLine,
        color
    });

    await interaction.update({ embeds: [embed], files, components: [] });

}


module.exports = async function handleTicPvpButton(interaction) {

    const parts = interaction.customId.split("_");

    if (interaction.customId.startsWith("tic_accept_") || interaction.customId.startsWith("tic_decline_")) {

        const action = parts[1]; // accept | decline
        const challengeId = parseInt(parts[2], 10);
        const challenge = getChallenge(challengeId);

        if (!challenge || challenge.status !== "pending") {
            return interaction.reply({ content: "❌ This challenge is no longer available.", flags: MessageFlags.Ephemeral });
        }

        if (interaction.user.id !== challenge.player2_id) {
            return interaction.reply({ content: "❌ This challenge isn't for you.", flags: MessageFlags.Ephemeral });
        }

        if (action === "decline") {

            declineChallenge(challengeId);
            return interaction.update({ content: "❌ Challenge declined.", embeds: [], components: [] });

        }

        // Accept — re-check both balances now, since time has passed
        // since the challenge was sent.
        if (!hasEnoughCoins(challenge.player1_id, challenge.bet_amount)) {
            declineChallenge(challengeId);
            return interaction.update({ content: "❌ The challenger no longer has enough coins for this bet. Challenge cancelled.", embeds: [], components: [] });
        }

        if (!hasEnoughCoins(challenge.player2_id, challenge.bet_amount)) {
            declineChallenge(challengeId);
            return interaction.update({ content: "❌ You don't have enough coins for this bet.", embeds: [], components: [] });
        }

        getUser(interaction.user.id, interaction.user.username);

        const activeChallenge = acceptChallenge(challengeId);

        const player1 = await interaction.client.users.fetch(activeChallenge.player1_id);
        const player2 = await interaction.client.users.fetch(activeChallenge.player2_id);

        const { embed, files } = ticMatchEmbed({
            player1Name: player1.username,
            player2Name: player2.username,
            board: activeChallenge.board,
            turnName: player1.username,
            betAmount: activeChallenge.bet_amount
        });

        return interaction.update({
            content: `<@${activeChallenge.player1_id}> <@${activeChallenge.player2_id}>`,
            embeds: [embed],
            files,
            components: boardButtonRows(activeChallenge.board, false)
        });

    }

    if (interaction.customId.startsWith("tic_pvp_move_")) {

        const position = parseInt(interaction.customId.replace("tic_pvp_move_", ""), 10);

        // Find the challenge by message ID rather than trusting a
        // customId-embedded challenge ID for moves — keeps the customId
        // short and avoids trusting stale IDs across re-renders.
        const db = require("../database/database");
        const row = db.prepare(`SELECT * FROM tic_challenges WHERE message_id = ? AND status = 'active'`).get(interaction.message.id);

        if (!row) {
            return interaction.reply({ content: "❌ This match isn't active anymore.", flags: MessageFlags.Ephemeral });
        }

        const challenge = { ...row, board: JSON.parse(row.board) };

        const isPlayer1 = interaction.user.id === challenge.player1_id;
        const isPlayer2 = interaction.user.id === challenge.player2_id;

        if (!isPlayer1 && !isPlayer2) {
            return interaction.reply({ content: "❌ This isn't your match.", flags: MessageFlags.Ephemeral });
        }

        const myKey = isPlayer1 ? "player1" : "player2";

        if (challenge.turn !== myKey) {
            return interaction.reply({ content: "⏳ It's not your turn yet.", flags: MessageFlags.Ephemeral });
        }

        if (!isValidMove(challenge.board, position)) {
            return interaction.deferUpdate();
        }

        const updated = applyChallengeMove(challenge.id, myKey, position);
        if (!updated) {
            return interaction.deferUpdate();
        }

        const player1 = await interaction.client.users.fetch(updated.player1_id);
        const player2 = await interaction.client.users.fetch(updated.player2_id);

        if (updated.status === "completed") {

            return settleAndRender(interaction, updated, player1, player2);

        }

        const turnName = updated.turn === "player1" ? player1.username : player2.username;

        const { embed, files } = ticMatchEmbed({
            player1Name: player1.username,
            player2Name: player2.username,
            board: updated.board,
            turnName,
            betAmount: updated.bet_amount
        });

        return interaction.update({ embeds: [embed], files, components: boardButtonRows(updated.board, false) });

    }

};
