// Milestones, XP/coin rewards, and achievement checks. Reuses the
// existing coinService/xpService/achievementService rather than
// inventing a parallel economy — the whole point of extending, not
// duplicating.
const { addCoins } = require("./coinService");
const { addXP } = require("./xpService");
const { unlockAchievement, giveAchievementRewards } = require("./achievementService");
const { MILESTONES, DIVINE_NUMBERS, REWARD_PER_CORRECT_XP, REWARD_PER_CORRECT_COINS, MILESTONE_BONUS_XP, CURSE_MULTIPLIER, DIVINE_XP_MULTIPLIER } = require("../config/numerologyConfig");

// Base reward for any correct count, scaled by curse (2x) and/or an
// active divine window (3x) — both can theoretically stack (a curse
// landing during a divine window), which is intentional chaos, not a
// bug to guard against.
function awardForCorrectCount(userId, username, { cursed = false, divine = false } = {}) {

    let multiplier = 1;
    if (cursed) multiplier *= CURSE_MULTIPLIER;
    if (divine) multiplier *= DIVINE_XP_MULTIPLIER;

    const coins = REWARD_PER_CORRECT_COINS * multiplier;
    const xp = REWARD_PER_CORRECT_XP * multiplier;

    addCoins(userId, username, coins);
    const xpResult = addXP(userId, xp);

    return { coins, xp, multiplier, leveledUp: !!(xpResult && xpResult.leveledUp), newLevel: xpResult ? xpResult.newLevel : null };

}

// Returns the milestone value just crossed, or null. `previousNumber`
// and `newNumber` bracket the check so a chaos-event jump (e.g. Count
// Shifts skipping several numbers) can't skip PAST a milestone without
// it being noticed.
function checkMilestone(previousNumber, newNumber) {

    for (const milestone of MILESTONES) {
        if (previousNumber < milestone && newNumber >= milestone) return milestone;
    }

    return null;

}

function checkDivineNumber(previousNumber, newNumber) {

    for (const divineNum of DIVINE_NUMBERS) {
        if (previousNumber < divineNum && newNumber >= divineNum) return divineNum;
    }

    return null;

}

function awardMilestoneBonus(userId, username) {

    addXP(userId, MILESTONE_BONUS_XP);

}

// Checks and unlocks any newly-earned Numerology achievements. Returns
// an array of { id, name, description, rewardCoins, rewardXP } for
// whatever just unlocked (empty array if nothing new).
function checkAchievements(userId, username, stats, context = {}) {

    const unlocked = [];

    const checks = [
        { id: "NUMEROLOGY_FIRST_BLOOD", condition: context.isFirstEver },
        { id: "NUMEROLOGY_ROOKIE", condition: stats.highest_count_achieved >= 100 },
        { id: "NUMEROLOGY_SCHOLAR", condition: stats.highest_count_achieved >= 500 },
        { id: "NUMEROLOGY_MASTER", condition: stats.highest_count_achieved >= 1000 },
        { id: "NUMEROLOGY_LEGEND", condition: stats.highest_count_achieved >= 5000 },
        { id: "NUMEROLOGY_WHISPER_COUNT", condition: stats.highest_count_achieved >= 10000 },
        { id: "NUMEROLOGY_PERFECT_STREAK", condition: stats.longest_streak >= 50 },
        { id: "NUMEROLOGY_CHAOS_SURVIVOR", condition: stats.chaos_events_witnessed >= 10 },
        { id: "NUMEROLOGY_DIVINE_ONE", condition: !!context.witnessedDivine }
    ];

    for (const check of checks) {

        if (!check.condition) continue;

        if (unlockAchievement(userId, check.id)) {

            const achievement = giveAchievementRewards(userId, check.id);
            if (achievement) unlocked.push(achievement);

        }

    }

    return unlocked;

}

module.exports = {
    awardForCorrectCount,
    checkMilestone,
    checkDivineNumber,
    awardMilestoneBonus,
    checkAchievements
};
