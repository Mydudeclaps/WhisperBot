const {
    dailyMissionCompleteEmbed
} = require("../utils/embedFactory");


const {
    rewardDailyMission
} = require("./dailyRewardService");


const db = require("../database/database");


const missions = require("../data/dailyMissions");


async function updateMissionProgress(
    userId,
    statType,
    amount = 1,
    channel = null
) {


    const activeMissions = db.prepare(`

        SELECT *

        FROM user_daily_missions

        WHERE user_id = ?

        AND completed = 0

        AND assigned_date = ?

    `).all(

        userId,

        new Date().toDateString()

    );



    for (const mission of activeMissions) {


        const missionData =
        missions[mission.mission_id];



        if (!missionData)
            continue;



        if (missionData.type !== statType)
            continue;



        let newProgress =
        mission.progress + amount;



        if (newProgress >= missionData.goal) {

            newProgress = missionData.goal;


            db.prepare(`

                UPDATE user_daily_missions

                SET progress = ?,
                    completed = 1,
                    completed_at = ?

                WHERE user_id = ?
                AND mission_id = ?

            `)
            
                .run(

                    newProgress,

                    new Date().toISOString(),

                    userId,

                    mission.mission_id

                );



            const reward =
            rewardDailyMission(
                userId,
                mission.mission_id
            );



            console.log(
                "MISSION COMPLETE MESSAGE:",
                missionData.name,
                channel ? "CHANNEL FOUND" : "NO CHANNEL"
            );



            if (channel && reward) {

                await channel.send({

                    embeds: [

                        dailyMissionCompleteEmbed(
                            missionData,
                            reward
                        )

                    ]

                });

            }    


            db.prepare(`

                UPDATE user_daily_missions

                SET progress = ?,
                    completed = 1

                WHERE user_id = ?
                AND mission_id = ?

            `).run(

                newProgress,

                userId,

                mission.mission_id

            );


        } else {


            db.prepare(`

                UPDATE user_daily_missions

                SET progress = ?

                WHERE user_id = ?
                AND mission_id = ?

            `).run(

                newProgress,

                userId,

                mission.mission_id

            );

        }

    }

}



module.exports = {

    updateMissionProgress

};