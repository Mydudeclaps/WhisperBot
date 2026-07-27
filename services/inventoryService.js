const db = require("../database/database");



function addItem(userId, item, amount = 1) {


    const existing = db.prepare(`

        SELECT *
        FROM inventory
        WHERE user_id = ?
        AND item = ?

    `).get(
        userId,
        item
    );



    if (existing) {


        db.prepare(`

            UPDATE inventory
            SET amount = amount + ?
            WHERE user_id = ?
            AND item = ?

        `).run(

            amount,

            userId,

            item

        );


    } else {


        db.prepare(`

            INSERT INTO inventory

            (user_id, item, amount)

            VALUES (?, ?, ?)

        `).run(

            userId,

            item,

            amount

        );


    }


}



function removeItem(userId, item, amount = 1) {


    db.prepare(`

        UPDATE inventory

        SET amount = amount - ?

        WHERE user_id = ?

        AND item = ?

    `).run(

        amount,

        userId,

        item

    );


}



function clearInventory(userId) {


    return db.prepare(`

        DELETE FROM inventory

        WHERE user_id = ?

    `).run(userId);


}



function getInventory(userId) {


    return db.prepare(`

        SELECT *

        FROM inventory

        WHERE user_id = ?

    `).all(userId);


}



function hasItem(userId, item) {


    return db.prepare(`

        SELECT *

        FROM inventory

        WHERE user_id = ?

        AND item = ?

        AND amount > 0

    `).get(

        userId,

        item

    );


}



module.exports = {

    addItem,

    removeItem,

    clearInventory,

    getInventory,

    hasItem

};