const db = require("../database/database");
const missions = require("../data/dailyMissions");

function assignDailyMissionsIfNeeded(userId) {
    const today = new Date().toDateString();

    // Check if user already has missions today
    const existing = db.prepare(`
        SELECT COUNT(*) as count
        FROM user_daily_missions
        WHERE user_id = ?
        AND assigned_date = ?
    `).get(userId, today);

    if (existing.count > 0) {
        return false;
    }

    // ============================================
    // CATEGORY-BASED ASSIGNMENT
    // ============================================
    
    // Separate missions by category/type
    const communicationMissions = [];
    const activityMissions = [];
    const communityMissions = [];

    for (const [id, mission] of Object.entries(missions)) {
        if (mission.type === "messages") {
            communicationMissions.push(id);
        } else if (mission.type === "voice_minutes") {
            activityMissions.push(id);
        } else if (mission.type === "reactions_given" || mission.type === "reactions_received") {
            communityMissions.push(id);
        }
    }

    // Pick one from each category
    const selected = [];

    // Pick a communication mission
    if (communicationMissions.length > 0) {
        const random = communicationMissions[Math.floor(Math.random() * communicationMissions.length)];
        selected.push(random);
    }

    // Pick an activity mission
    if (activityMissions.length > 0) {
        const random = activityMissions[Math.floor(Math.random() * activityMissions.length)];
        selected.push(random);
    }

    // Pick a community mission (this will be EITHER reactions_given OR reactions_received)
    if (communityMissions.length > 0) {
        const random = communityMissions[Math.floor(Math.random() * communityMissions.length)];
        selected.push(random);
    }

    // If we don't have 3, fill with random
    while (selected.length < 3) {
        const all = Object.keys(missions);
        const random = all[Math.floor(Math.random() * all.length)];
        if (!selected.includes(random)) {
            selected.push(random);
        }
    }

    // Assign the selected missions
    for (const missionId of selected) {
        db.prepare(`
            DELETE FROM user_daily_missions
            WHERE user_id = ?
            AND mission_id = ?
        `).run(userId, missionId);

        db.prepare(`
            INSERT INTO user_daily_missions (
                user_id,
                mission_id,
                progress,
                completed,
                assigned_date
            )
            VALUES (?, ?, 0, 0, ?)
        `).run(userId, missionId, today);
    }

    console.log(`📜 Assigned daily missions to ${userId}:`, selected);
    return true;
}

module.exports = {
    assignDailyMissionsIfNeeded
};