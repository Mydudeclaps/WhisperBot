const db = require("../database/database");

const missions =
require("../data/dailyMissions");


const {
    addXP
} = require("./xpService");



function rewardDailyMission(
    userId,
    missionId
) {


    const mission =
    missions[missionId];


    if (!mission)
        return null;



    // Give XP

    addXP(
        userId,
        mission.rewardXP
    );



    // Give coins

    db.prepare(`

        UPDATE users

        SET coins = coins + ?

        WHERE id = ?

    `).run(

        mission.rewardCoins,

        userId

    );



    // Give reputation

    db.prepare(`

        UPDATE users

        SET kingdom_rep = kingdom_rep + ?

        WHERE id = ?

    `).run(

        mission.rewardRep,

        userId

    );



    return mission;

}



module.exports = {

    rewardDailyMission

};