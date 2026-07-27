const db = require("../database/database");

const quests = require("../data/quests");


function getQuest(id) {

    return quests[id];

}



function startQuest(userId, questId) {


    const quest = getQuest(questId);


    if (!quest)
        return false;



    const existing = db.prepare(`
        SELECT *
        FROM user_quests
        WHERE user_id = ?
        AND quest_id = ?
    `).get(
        userId,
        questId
    );


    if (existing)
        return false;



    db.prepare(`
        INSERT INTO user_quests

        (
            user_id,
            quest_id,
            started_at
        )

        VALUES (?, ?, ?)

    `).run(

        userId,

        questId,

        new Date().toISOString()

    );


    return true;

}



function getUserQuests(userId) {


    return db.prepare(`

        SELECT *

        FROM user_quests

        WHERE user_id = ?

    `).all(userId);


}



// Returns a single active (not completed) quest for a user, or null.
function getActiveUserQuest(userId, questId) {

    return db.prepare(`

        SELECT *

        FROM user_quests

        WHERE user_id = ?

        AND quest_id = ?

        AND completed = 0

    `).get(userId, questId) || null;

}



// Permanently deletes progress and frees the quest slot so the player can
// start the quest again later. Returns true if a row was removed.
function abandonQuest(userId, questId) {

    const result = db.prepare(`

        DELETE FROM user_quests

        WHERE user_id = ?

        AND quest_id = ?

        AND completed = 0

    `).run(userId, questId);

    return result.changes > 0;

}


// === Additions below are new and purely additive — nothing above this
// line was changed, so /quest start, /quest active, /quest leave, and
// /quest abandon all behave exactly as before. These two power the new
// /quest hub's Quest Board (see commands/quests/quest.js).

// Active (not completed) user_quests rows — same query the existing
// "/quest active" subcommand already ran inline; given a proper home
// here so the hub can reuse it too.
function getActiveQuests(userId) {

    return db.prepare(`
        SELECT *
        FROM user_quests
        WHERE user_id = ?
        AND completed = 0
    `).all(userId);

}


// Quests the player has never touched at all — i.e. no user_quests row
// exists for them yet, active or completed. Quests in this codebase are
// one-time (startQuest's existing-row check doesn't filter by completed),
// so "available" and "never started" are the same thing.
function getAvailableQuests(userId) {

    const touchedIds = new Set(
        db.prepare(`SELECT quest_id FROM user_quests WHERE user_id = ?`)
            .all(userId)
            .map(row => row.quest_id)
    );

    return Object.values(quests).filter(q => !touchedIds.has(q.id));

}


module.exports = {

    getQuest,

    startQuest,

    getUserQuests,

    getActiveUserQuest,

    abandonQuest,

    getActiveQuests,

    getAvailableQuests

};