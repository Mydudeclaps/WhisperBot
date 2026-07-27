const db = require("../database/database");

const {
    addXP
} = require("./xpService");



function giveQuestRewards(
    userId,
    quest
) {


    // Give XP

    addXP(
        userId,
        quest.rewardXP
    );



    // Give Coins

    db.prepare(`

        UPDATE users

        SET coins = coins + ?

        WHERE id = ?

    `).run(

        quest.rewardCoins,

        userId

    );



    // Give Kingdom Reputation

    db.prepare(`

        UPDATE users

        SET kingdom_rep = kingdom_rep + ?

        WHERE id = ?

    `).run(

        quest.rewardRep,

        userId

    );



    return {

        xp: quest.rewardXP,

        coins: quest.rewardCoins,

        reputation: quest.rewardRep

    };

}



module.exports = {

    giveQuestRewards

};