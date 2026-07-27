const db = require("../database/database");

const { addCoins, getCoins } = require("./coinService");

const { RACEBET } = require("../config/gameConfig");


function today() {
    return new Date().toDateString();
}


// Number of daily missions a user has active (assigned today)
function hasActiveDailyMission(userId) {

    const row = db.prepare(`
        SELECT COUNT(*) AS count
        FROM user_daily_missions
        WHERE user_id = ?
        AND assigned_date = ?
    `).get(userId, today());

    return row.count > 0;

}


// Completed daily mission count for a user, for a given date string
function completedMissionCount(userId, dateStr) {

    const row = db.prepare(`
        SELECT COUNT(*) AS count
        FROM user_daily_missions
        WHERE user_id = ?
        AND assigned_date = ?
        AND completed = 1
    `).get(userId, dateStr);

    return row.count;

}


// Cancels + refunds any pending challenge older than ACCEPT_TIMEOUT
function expireOldChallenges() {

    const cutoff = Date.now() - (RACEBET.ACCEPT_TIMEOUT * 1000);

    const stale = db.prepare(`
        SELECT * FROM daily_races
        WHERE status = 'pending'
    `).all();

    for (const race of stale) {

        if (new Date(race.created_at).getTime() > cutoff) continue;

        db.prepare(`
            UPDATE daily_races SET status = 'expired'
            WHERE id = ?
        `).run(race.id);

        // Refund the challenger's stake taken at creation time
        addCoins(race.player1_id, "unknown", race.bet_amount);

    }

}


function getPendingChallengeFor(userId) {

    expireOldChallenges();

    return db.prepare(`
        SELECT * FROM daily_races
        WHERE player2_id = ?
        AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
    `).get(userId);

}


function getPendingChallengeFrom(userId) {

    expireOldChallenges();

    return db.prepare(`
        SELECT * FROM daily_races
        WHERE player1_id = ?
        AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
    `).get(userId);

}


// Creates a race challenge, deducting the challenger's stake immediately.
function createRace(player1Id, player2Id, betAmount) {

    db.prepare(`
        INSERT INTO daily_races
        (player1_id, player2_id, bet_amount, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)
    `).run(player1Id, player2Id, betAmount, new Date().toISOString());

    addCoins(player1Id, "unknown", -betAmount);

    return db.prepare(`
        SELECT * FROM daily_races WHERE id = last_insert_rowid()
    `).get();

}


// Accepts a pending challenge, deducting the opponent's stake.
function acceptRace(raceId, username) {

    const race = db.prepare(
        "SELECT * FROM daily_races WHERE id = ?"
    ).get(raceId);

    if (!race || race.status !== "pending") return null;

    addCoins(race.player2_id, username, -race.bet_amount);

    db.prepare(`
        UPDATE daily_races
        SET status = 'active', accepted_at = ?
        WHERE id = ?
    `).run(new Date().toISOString(), raceId);

    return db.prepare(
        "SELECT * FROM daily_races WHERE id = ?"
    ).get(raceId);

}


// Declines a pending challenge, refunding the challenger's stake.
function declineRace(raceId) {

    const race = db.prepare(
        "SELECT * FROM daily_races WHERE id = ?"
    ).get(raceId);

    if (!race || race.status !== "pending") return null;

    db.prepare(`
        UPDATE daily_races SET status = 'declined'
        WHERE id = ?
    `).run(raceId);

    addCoins(race.player1_id, "unknown", race.bet_amount);

    return race;

}


function listActiveRaces() {

    expireOldChallenges();

    return db.prepare(`
        SELECT * FROM daily_races
        WHERE status IN ('pending', 'active')
        ORDER BY created_at DESC
    `).all();

}


// Called at the daily reset, BEFORE user_daily_missions is wiped.
// Resolves every active race based on today's completed mission counts.
function resolveDailyRaces() {

    const dateStr = today();

    const activeRaces = db.prepare(`
        SELECT * FROM daily_races WHERE status = 'active'
    `).all();

    const results = [];

    for (const race of activeRaces) {

        const p1Completed = completedMissionCount(race.player1_id, dateStr);
        const p2Completed = completedMissionCount(race.player2_id, dateStr);

        const pot = race.bet_amount * 2;
        let winnerId = null;

        if (p1Completed > p2Completed) {
            winnerId = race.player1_id;
            addCoins(race.player1_id, "unknown", pot);
        } else if (p2Completed > p1Completed) {
            winnerId = race.player2_id;
            addCoins(race.player2_id, "unknown", pot);
        } else {
            // Tie — refund both
            addCoins(race.player1_id, "unknown", race.bet_amount);
            addCoins(race.player2_id, "unknown", race.bet_amount);
        }

        db.prepare(`
            UPDATE daily_races
            SET status = 'completed', completed_at = ?, winner_id = ?
            WHERE id = ?
        `).run(new Date().toISOString(), winnerId, race.id);

        results.push({
            race,
            p1Completed,
            p2Completed,
            winnerId,
            pot
        });

    }

    return results;

}


module.exports = {

    hasActiveDailyMission,
    expireOldChallenges,
    getPendingChallengeFor,
    getPendingChallengeFrom,
    createRace,
    acceptRace,
    declineRace,
    listActiveRaces,
    resolveDailyRaces

};
