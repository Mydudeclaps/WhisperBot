const db = require("../database/database");
const { getUser } = require("./userService");


// Adds (or subtracts, if amount is negative) coins for a user.
// Uses getUser so brand-new users get a row created first.
function addCoins(userId, username, amount) {

    getUser(userId, username);

    db.prepare(`
        UPDATE users
        SET coins = coins + ?
        WHERE id = ?
    `).run(amount, userId);

    return getCoins(userId);

}


// Sets a user's coin balance to an exact amount (admin use — normal
// gameplay should go through addCoins so it stays relative).
function setCoins(userId, username, amount) {

    getUser(userId, username);

    db.prepare(`
        UPDATE users
        SET coins = ?
        WHERE id = ?
    `).run(amount, userId);

    return getCoins(userId);

}


function getCoins(userId) {

    const row = db.prepare(
        "SELECT coins FROM users WHERE id = ?"
    ).get(userId);

    return row ? row.coins : 0;

}


function hasEnoughCoins(userId, amount) {

    return getCoins(userId) >= amount;

}


module.exports = {

    addCoins,

    setCoins,

    getCoins,

    hasEnoughCoins

};
