const db = require("../../database/database");
const crypto = require("crypto");


function generateEventId() {
    return crypto.randomBytes(8).toString("hex");
}


// `story` is an array of { stage, text } objects — stored as JSON, read
// back parsed by getEvent()/getRecentForUser().
function recordEvent({
    command,
    userId,
    targetId,
    targetMentioned,
    rarity,
    combo,
    comboWasActive,
    npcInterrupted,
    npcName,
    plotTwistOccurred,
    achievementUnlocked,
    story
}) {

    const eventId = generateEventId();

    db.prepare(`
        INSERT INTO social_history (
            event_id, command, user_id, target_id, target_mentioned,
            rarity, combo, combo_was_active, npc_interrupted, npc_name,
            plot_twist_occurred, achievement_unlocked, story, ended_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        eventId,
        command,
        userId,
        targetId || null,
        targetMentioned ? 1 : 0,
        rarity,
        combo,
        comboWasActive ? 1 : 0,
        npcInterrupted ? 1 : 0,
        npcName || null,
        plotTwistOccurred ? 1 : 0,
        achievementUnlocked || null,
        JSON.stringify(story),
        new Date().toISOString()
    );

    return eventId;

}


function parseRow(row) {

    if (!row) return null;

    return {
        ...row,
        story: JSON.parse(row.story),
        target_mentioned: !!row.target_mentioned,
        combo_was_active: !!row.combo_was_active,
        npc_interrupted: !!row.npc_interrupted,
        plot_twist_occurred: !!row.plot_twist_occurred
    };

}


function getEvent(eventId) {

    return parseRow(
        db.prepare("SELECT * FROM social_history WHERE event_id = ?").get(eventId)
    );

}


function getRecentForUser(userId, limit = 10) {

    const rows = db.prepare(`
        SELECT * FROM social_history
        WHERE user_id = ?
        ORDER BY ended_at DESC
        LIMIT ?
    `).all(userId, limit);

    return rows.map(parseRow);

}


// The permanent record — every Legendary/Divine moment, most recent
// first. This is the "hall of fame" proper: nothing ever ages out of it.
function getHallOfFame(limit = 10) {

    const rows = db.prepare(`
        SELECT * FROM social_history
        WHERE rarity IN ('legendary', 'divine')
        ORDER BY ended_at DESC
        LIMIT ?
    `).all(limit);

    return rows.map(parseRow);

}


// A looser, randomized sample across Epic and up — meant to feel
// different each time you run /topmoments, rather than being a strict
// "most recent" list like the Hall of Fame.
function getTopMoments(limit = 5) {

    const rows = db.prepare(`
        SELECT * FROM social_history
        WHERE rarity IN ('epic', 'legendary', 'divine')
        ORDER BY RANDOM()
        LIMIT ?
    `).all(limit);

    return rows.map(parseRow);

}


module.exports = {

    recordEvent,
    getEvent,
    getRecentForUser,
    getHallOfFame,
    getTopMoments

};
