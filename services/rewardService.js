const db = require("../database/database");


// Base coin reward for reaching a level — grows steadily so level 1000
// still feels meaningful compared to level 1.
function baseReward(level) {

    return 50 + (level * 15);

}


// Every 5th level gets a milestone bonus on top of the base reward.
function milestoneBonus(level) {

    if (level % 5 !== 0) return 0;

    let bonus = level * 35;

    // Extra flourish on the big round numbers
    if (level % 100 === 0) {
        bonus += level * 100;
    } else if (level % 25 === 0) {
        bonus += level * 50;
    }

    return bonus;

}


function levelReward(level) {

    const coins = baseReward(level) + milestoneBonus(level);

    return Math.round(coins);

}


function giveLevelReward(userId, level) {


    const reward = levelReward(level);


    db.prepare(`
        UPDATE users
        SET coins = coins + ?
        WHERE id = ?
    `)
    .run(
        reward,
        userId
    );


    return reward;

}



module.exports = {

    levelReward,

    giveLevelReward

};
