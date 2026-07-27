// Derives a player's VIP rank from casino_stats.total_wagered — no
// separate table needed, that column already accumulates across every
// casino game via casinoStatsService.recordBet.
const { VIP } = require("../config/gameConfig");

// Returns the highest rank the player qualifies for, or null if they
// haven't reached Bronze yet.
function getVipRank(totalWagered) {

    let rank = null;

    for (const candidate of VIP.RANKS) {
        if (totalWagered >= candidate.threshold) {
            rank = candidate;
        }
    }

    return rank;

}

// Returns the next rank up (with a `remaining` field for how much more
// needs to be wagered), or null if the player is already at the top rank.
function getNextVipRank(totalWagered) {

    const next = VIP.RANKS.find(r => totalWagered < r.threshold);

    if (!next) return null;

    return {
        ...next,
        remaining: next.threshold - totalWagered
    };

}

module.exports = {
    getVipRank,
    getNextVipRank
};
