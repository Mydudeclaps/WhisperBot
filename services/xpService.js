const db = require("../database/database");
const { XP } = require("../config/gameConfig");


function addXP(userId, amount) {


    let user = db.prepare(
        "SELECT * FROM users WHERE id = ?"
    ).get(userId);



    if (!user) {

        return null;

    }



    const oldLevel = user.level;


    const newXP = user.xp + amount;



    let newLevel = oldLevel;


    while (
        newXP >= newLevel * XP.PER_LEVEL &&
        newLevel < XP.MAX_LEVEL
    ) {

        newLevel++;

    }



    db.prepare(`
        UPDATE users
        SET xp = ?,
            level = ?
        WHERE id = ?
    `)
    .run(
        newXP,
        newLevel,
        userId
    );



    return {

        xpGained: amount,

        oldLevel,

        newLevel,

        leveledUp:
            newLevel > oldLevel

    };

}



function getXP(userId) {


    return db.prepare(
        "SELECT xp, level FROM users WHERE id = ?"
    ).get(userId);


}



module.exports = {

    addXP,

    getXP

};