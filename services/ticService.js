// Gambling Tic Tac Toe (/tic) — house mode (single player vs AI, uses
// the same local-session pattern as every other casino game) and PvP
// challenge mode (DB-backed, see database/database.js for why).
const db = require("../database/database");

const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
];


// === Pure board logic — shared by house mode and PvP ===

function emptyBoard() {
    return ["", "", "", "", "", "", "", "", ""];
}

// Returns "X", "O", or null.
function checkWinner(board) {

    for (const [a, b, c] of WIN_LINES) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return board[a];
        }
    }

    return null;

}

function isBoardFull(board) {
    return board.every(cell => cell !== "");
}

function isValidMove(board, position) {
    return position >= 0 && position < 9 && board[position] === "";
}


// === Medium-difficulty AI: win if possible, block if necessary,
// otherwise prefer center, then a corner, then any open edge. ===

// === Medium-difficulty AI: win if possible, block if necessary. Beyond
// that, per the anti-predictability fix, there's a 40% chance it ignores
// "optimal" placement (center > corner > edge) entirely and just picks
// any legal move — this only kicks in AFTER the win/block checks, so it
// never costs the house a win or lets the player sneak one through. The
// remaining 60% of the time it plays center > random corner > random
// edge, same as before. ===

function getAvailableMoves(board) {
    const moves = [];
    for (let i = 0; i < board.length; i++) {
        if (board[i] === "") moves.push(i);
    }
    return moves;
}

// Uniform-random legal move — used both for the AI's 40% "just guess"
// branch and for the house's opening move when it goes first.
function getRandomMove(board) {
    const available = getAvailableMoves(board);
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)];
}

const AI_RANDOM_MOVE_CHANCE = 0.40;
const HOUSE_FIRST_CHANCE = 0.50;

// 50/50 whether the house opens the round instead of the player — the
// other half of the anti-predictability fix. When true, the caller
// should place the house's symbol via getRandomMove() BEFORE showing the
// board to the player (a random opening move, not optimal play — an
// empty board has no win/block to make anyway, so getAIMove() would
// always land on center/corner here regardless; a real random move is
// what actually varies the opening).
function shouldHouseGoFirst() {
    return Math.random() < HOUSE_FIRST_CHANCE;
}

function findWinningMove(board, symbol) {

    for (const [a, b, c] of WIN_LINES) {

        const line = [board[a], board[b], board[c]];
        const emptyIndex = [a, b, c][line.indexOf("")];

        const filled = line.filter(v => v === symbol).length;
        const empties = line.filter(v => v === "").length;

        if (filled === 2 && empties === 1) {
            return emptyIndex;
        }

    }

    return null;

}

function getAIMove(board, aiSymbol, playerSymbol) {

    const winMove = findWinningMove(board, aiSymbol);
    if (winMove !== null) return winMove;

    const blockMove = findWinningMove(board, playerSymbol);
    if (blockMove !== null) return blockMove;

    // Anti-predictability: 40% of the time, once a win/block isn't on
    // the table, just play anywhere legal instead of "optimally." Keeps
    // the house from being a solved, exploitable script.
    if (Math.random() < AI_RANDOM_MOVE_CHANCE) {
        return getRandomMove(board);
    }

    if (board[4] === "") return 4;

    const corners = [0, 2, 6, 8].filter(i => board[i] === "");
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];

    const edges = [1, 3, 5, 7].filter(i => board[i] === "");
    if (edges.length) return edges[Math.floor(Math.random() * edges.length)];

    return null; // board is full

}


// === PvP challenges (DB-backed) ===

function createChallenge(player1Id, player2Id, betAmount) {

    const result = db.prepare(`
        INSERT INTO tic_challenges (player1_id, player2_id, bet_amount, status, board, turn, created_at)
        VALUES (?, ?, ?, 'pending', ?, 'player1', ?)
    `).run(player1Id, player2Id, betAmount, JSON.stringify(emptyBoard()), new Date().toISOString());

    return result.lastInsertRowid;

}

function getChallenge(challengeId) {

    const row = db.prepare(`SELECT * FROM tic_challenges WHERE id = ?`).get(challengeId);
    if (!row) return null;

    return { ...row, board: JSON.parse(row.board) };

}

function getPendingChallengeFor(userId) {

    const row = db.prepare(`
        SELECT * FROM tic_challenges
        WHERE player2_id = ? AND status = 'pending'
        ORDER BY id DESC LIMIT 1
    `).get(userId);

    return row ? { ...row, board: JSON.parse(row.board) } : null;

}

function setChallengeMessage(challengeId, messageId, channelId) {

    db.prepare(`
        UPDATE tic_challenges SET message_id = ?, channel_id = ? WHERE id = ?
    `).run(messageId, channelId, challengeId);

}

function acceptChallenge(challengeId) {

    db.prepare(`
        UPDATE tic_challenges SET status = 'active', accepted_at = ? WHERE id = ? AND status = 'pending'
    `).run(new Date().toISOString(), challengeId);

    return getChallenge(challengeId);

}

function declineChallenge(challengeId) {

    db.prepare(`
        UPDATE tic_challenges SET status = 'declined', completed_at = ? WHERE id = ? AND status = 'pending'
    `).run(new Date().toISOString(), challengeId);

}

function expireChallenge(challengeId) {

    db.prepare(`
        UPDATE tic_challenges SET status = 'expired', completed_at = ? WHERE id = ? AND status = 'pending'
    `).run(new Date().toISOString(), challengeId);

}

// Applies a move to a PvP challenge's board and advances the turn.
// Returns the updated challenge, or null if the move/turn was invalid.
function applyChallengeMove(challengeId, byPlayerKey, position) {

    const challenge = getChallenge(challengeId);
    if (!challenge) return null;
    if (challenge.status !== "active") return null;
    if (challenge.turn !== byPlayerKey) return null;
    if (!isValidMove(challenge.board, position)) return null;

    const symbol = byPlayerKey === "player1" ? "X" : "O";
    challenge.board[position] = symbol;

    const winnerSymbol = checkWinner(challenge.board);
    const full = isBoardFull(challenge.board);

    let status = "active";
    let winnerId = null;
    let completedAt = null;

    if (winnerSymbol) {
        status = "completed";
        winnerId = byPlayerKey === "player1" ? challenge.player1_id : challenge.player2_id;
        completedAt = new Date().toISOString();
    } else if (full) {
        status = "completed"; // draw — winnerId stays null
        completedAt = new Date().toISOString();
    }

    const nextTurn = byPlayerKey === "player1" ? "player2" : "player1";

    db.prepare(`
        UPDATE tic_challenges
        SET board = ?, turn = ?, status = ?, winner_id = ?, completed_at = ?
        WHERE id = ?
    `).run(JSON.stringify(challenge.board), nextTurn, status, winnerId, completedAt, challengeId);

    return getChallenge(challengeId);

}

// Sweeps challenges that were never accepted/declined in time. Mirrors
// casinoService.cleanupExpiredCooldowns()'s "harmless either way, just
// keeps the table tidy" reasoning.
function cleanupExpiredChallenges(maxAgeMs) {

    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

    const result = db.prepare(`
        UPDATE tic_challenges
        SET status = 'expired', completed_at = ?
        WHERE status = 'pending' AND created_at <= ?
    `).run(new Date().toISOString(), cutoff);

    return result.changes;

}


module.exports = {
    emptyBoard,
    checkWinner,
    isBoardFull,
    isValidMove,
    getAIMove,
    getRandomMove,
    shouldHouseGoFirst,
    createChallenge,
    getChallenge,
    getPendingChallengeFor,
    setChallengeMessage,
    acceptChallenge,
    declineChallenge,
    expireChallenge,
    applyChallengeMove,
    cleanupExpiredChallenges
};
