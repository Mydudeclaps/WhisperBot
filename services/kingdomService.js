const db = require("../database/database");

const kingdoms = require("../data/kingdoms");


function getKingdom(userId) {

    return db.prepare(`
        SELECT kingdom, kingdom_rep, kingdom_joined, coins, xp, level
        FROM users
        WHERE id = ?
    `).get(userId);

}


function joinKingdom(userId, kingdom) {

    if (!kingdoms[kingdom]) {

        return {
            success: false,
            message: "That kingdom does not exist."
        };

    }

    db.prepare(`
        UPDATE users
        SET kingdom = ?,
            kingdom_rep = 0,
            kingdom_joined = ?
        WHERE id = ?
    `)
    .run(
        kingdom,
        new Date().toISOString(),
        userId
    );

    return {

        success: true,

        kingdom: kingdoms[kingdom]

    };

}


function leaveKingdom(userId) {

    db.prepare(`
        UPDATE users
        SET kingdom = 'None',
            kingdom_rep = 0,
            kingdom_joined = NULL
        WHERE id = ?
    `)
    .run(userId);

    return true;

}


function addReputation(userId, amount) {

    db.prepare(`
        UPDATE users
        SET kingdom_rep = kingdom_rep + ?
        WHERE id = ?
    `)
    .run(
        amount,
        userId
    );

}


// A player's rank within their own kingdom, ranked by kingdom_rep.
function getKingdomRank(userId, kingdom) {

    const user = db.prepare(`
        SELECT kingdom_rep
        FROM users
        WHERE id = ?
    `).get(userId);

    if (!user) return null;

    const { position } = db.prepare(`
        SELECT COUNT(*) as position
        FROM users
        WHERE kingdom = ?
        AND kingdom_rep > ?
    `).get(kingdom, user.kingdom_rep);

    return position + 1;

}


function getKingdomList() {

    return kingdoms;

}


// ---------------------------------------------------------------------
// Kingdom Atlas stats
// ---------------------------------------------------------------------

// Server-wide stats for the /kingdom info overview page.
function getServerStats() {

    const totals = db.prepare(`
        SELECT
            COUNT(*) AS totalPlayers,
            COUNT(CASE WHEN kingdom != 'None' THEN 1 END) AS totalMembers,
            COALESCE(SUM(kingdom_rep), 0) AS totalRep,
            COALESCE(AVG(level), 0) AS avgLevel
        FROM users
    `).get();

    const highestLevel = db.prepare(`
        SELECT username, level
        FROM users
        ORDER BY level DESC, xp DESC
        LIMIT 1
    `).get();

    const richest = db.prepare(`
        SELECT username, coins
        FROM users
        ORDER BY coins DESC
        LIMIT 1
    `).get();

    return {

        totalPlayers: totals.totalPlayers,
        totalKingdoms: Object.keys(kingdoms).length,
        totalMembers: totals.totalMembers,
        totalRep: totals.totalRep,
        avgLevel: totals.avgLevel,
        highestLevelPlayer: highestLevel || null,
        richestPlayer: richest || null

    };

}


// Full stats bundle for a single kingdom's detail page.
function getKingdomStats(key) {

    const totals = db.prepare(`
        SELECT
            COUNT(*) AS memberCount,
            COALESCE(AVG(level), 0) AS avgLevel,
            COALESCE(SUM(kingdom_rep), 0) AS totalRep
        FROM users
        WHERE kingdom = ?
    `).get(key);

    const richest = db.prepare(`
        SELECT username, coins
        FROM users
        WHERE kingdom = ?
        ORDER BY coins DESC
        LIMIT 1
    `).get(key);

    const highestLevel = db.prepare(`
        SELECT username, level
        FROM users
        WHERE kingdom = ?
        ORDER BY level DESC, xp DESC
        LIMIT 1
    `).get(key);

    const newest = db.prepare(`
        SELECT username, kingdom_joined
        FROM users
        WHERE kingdom = ?
        AND kingdom_joined IS NOT NULL
        ORDER BY kingdom_joined DESC
        LIMIT 1
    `).get(key);

    const topByXP = db.prepare(`
        SELECT username, xp
        FROM users
        WHERE kingdom = ?
        ORDER BY xp DESC
        LIMIT 10
    `).all(key);

    const topByCoins = db.prepare(`
        SELECT username, coins
        FROM users
        WHERE kingdom = ?
        ORDER BY coins DESC
        LIMIT 10
    `).all(key);

    const topByRep = db.prepare(`
        SELECT username, kingdom_rep
        FROM users
        WHERE kingdom = ?
        ORDER BY kingdom_rep DESC
        LIMIT 10
    `).all(key);

    return {

        memberCount: totals.memberCount,
        avgLevel: totals.avgLevel,
        totalRep: totals.totalRep,
        richestMember: richest || null,
        highestLevelMember: highestLevel || null,
        newestMember: newest || null,
        topByXP,
        topByCoins,
        topByRep

    };

}


// Total reputation for every kingdom at once — used to build the
// "how do we compare" progress bars on a kingdom's detail page.
function getAllKingdomRepTotals() {

    const rows = db.prepare(`
        SELECT kingdom, COALESCE(SUM(kingdom_rep), 0) AS totalRep
        FROM users
        WHERE kingdom != 'None'
        GROUP BY kingdom
    `).all();

    const totals = {};

    for (const key of Object.keys(kingdoms)) {
        totals[key] = 0;
    }

    for (const row of rows) {
        totals[row.kingdom] = row.totalRep;
    }

    return totals;

}


module.exports = {

    getKingdom,

    joinKingdom,

    leaveKingdom,

    addReputation,

    getKingdomRank,

    getKingdomList,

    getServerStats,

    getKingdomStats,

    getAllKingdomRepTotals

};
