// Picks NPC dealer dialogue for casino result embeds. Purely
// presentational — never touches bet/payout logic, so it can be dropped
// into an existing embed builder as an optional extra line without
// changing how any game resolves.
const npcs = require("../data/casinoNpcs");

// `game` matches the keys used in casinoStatsService.recordBet ("dice",
// "blackjack", "highlow", "horse", "slots", "roulette", "poker").
function getNpcForGame(game) {

    return Object.values(npcs).find(npc => npc.games.includes(game)) || null;

}

// `type` is "win", "lose", or "catchphrase" (catchphrase = shown regardless
// of outcome, e.g. on a push, or when a caller doesn't care about outcome).
function randomLine(npc, type) {

    if (!npc) return null;

    const pool =
        type === "win" ? npc.winPhrases :
        type === "lose" ? npc.losePhrases :
        npc.catchphrases;

    if (!pool || !pool.length) return null;

    return pool[Math.floor(Math.random() * pool.length)];

}

// Convenience one-shot: game key + outcome -> a formatted dialogue line
// ready to drop into an embed field/description, or null if that game has
// no assigned NPC.
function npcLineForGame(game, type = "catchphrase") {

    const npc = getNpcForGame(game);
    if (!npc) return null;

    const line = randomLine(npc, type);
    if (!line) return null;

    return `${npc.emoji} **${npc.name}:** *"${line}"*`;

}

// Rank-aware greeting line for a game's NPC — shown when a session
// starts. `rankId` matches CASINO_RANKS ids in config/gameConfig.js
// (visitor/regular/vip/high_roller/legend). Falls back to a catchphrase
// if the NPC has no line for that rank yet.
function npcGreetingForGame(game, rankId) {

    const npc = getNpcForGame(game);
    if (!npc) return null;

    const line = npc.rankLines && npc.rankLines[rankId];
    if (line) return `${npc.emoji} **${npc.name}:** *"${line}"*`;

    return npcLineForGame(game, "catchphrase");

}


// Progressive 3-Card Poker stage dialogue — stage is one of
// ante/firstCard/secondCard/thirdCard/fold/win/loss/push/bigWin
// (data/casinoNpcs.js -> frank.pokerLines). Returns a formatted line
// ready to drop into an embed, or null if Frank has no lines for that
// stage.
function frankPokerLine(stage) {

    const npc = npcs.frank;
    if (!npc || !npc.pokerLines || !npc.pokerLines[stage]) return null;

    const pool = npc.pokerLines[stage];
    const line = pool[Math.floor(Math.random() * pool.length)];

    return `${npc.emoji} **${npc.name}:** *"${line}"*`;

}


// Memory Vault stage dialogue — stage is one of
// match/matchStreak/noMatch/noMatchStreak/win/loss/perfect
// (data/casinoNpcs.js -> lucy.memoryLines).
function lucyMemoryLine(stage) {

    const npc = npcs.lucy;
    if (!npc || !npc.memoryLines || !npc.memoryLines[stage]) return null;

    const pool = npc.memoryLines[stage];
    const line = pool[Math.floor(Math.random() * pool.length)];

    return `${npc.emoji} **${npc.name}:** *"${line}"*`;

}


module.exports = {
    getNpcForGame,
    randomLine,
    npcLineForGame,
    npcGreetingForGame,
    frankPokerLine,
    lucyMemoryLine
};
