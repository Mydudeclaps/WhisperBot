const db = require("../database/database");

const missions =
require("../data/dailyMissions");


function today() {

    return new Date().toDateString();

}



function assignDailyMissions(userId) {


    const existing =
    db.prepare(`

        SELECT *

        FROM user_daily_missions

        WHERE user_id = ?

        AND assigned_date = ?

    `).all(

        userId,

        today()

    );



    if (existing.length) {

        return existing;

    }



    for (const mission of Object.values(missions)) {


        db.prepare(`

            INSERT INTO user_daily_missions

            (

                user_id,

                mission_id,

                assigned_date

            )

            VALUES (?, ?, ?)

        `).run(

            userId,

            mission.id,

            today()

        );


    }



    return db.prepare(`

        SELECT *

        FROM user_daily_missions

        WHERE user_id = ?

        AND assigned_date = ?

    `).all(

        userId,

        today()

    );


}



module.exports = {

    assignDailyMissions

};