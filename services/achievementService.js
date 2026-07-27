const achievementData = require("../data/achievements");
const { getUser } = require("./userService");
const db = require("../database/database");


function hasAchievement(userId, achievement) {

    return db.prepare(`
        SELECT *
        FROM achievements
        WHERE user_id = ?
        AND achievement = ?
    `).get(userId, achievement);

}



function unlockAchievement(userId, achievement) {

    if (hasAchievement(userId, achievement))
        return false;


    db.prepare(`
        INSERT INTO achievements
        (user_id, achievement, unlocked_at)
        VALUES (?, ?, ?)
    `).run(

        userId,

        achievement,

        new Date().toLocaleString()

    );


    return true;

}



function getAchievements(userId) {

    return db.prepare(`
        SELECT *
        FROM achievements
        WHERE user_id = ?
    `).all(userId);

}

function getAchievement(id) {

    return achievements[id];

}

function giveAchievementRewards(userId, achievementId) {

    const achievement = achievementData[achievementId];

    if (!achievement)
        return null;

    db.prepare(`
        UPDATE users
        SET
            coins = coins + ?,
            xp = xp + ?
        WHERE id = ?
    `).run(

        achievement.rewardCoins,

        achievement.rewardXP,

        userId

    );

    return achievement;

}

function checkLevelAchievements(user) {

    const unlocked = [];

    if (user.level >= 2)
        unlocked.push("FIRST_STEPS");

    if (user.level >= 5)
        unlocked.push("ADVENTURER");

    if (user.level >= 10)
        unlocked.push("WARRIOR");

    return unlocked;

}

module.exports = {

    unlockAchievement,

    getAchievements,

    hasAchievement,

    getAchievement,

    giveAchievementRewards,

    checkLevelAchievements

};