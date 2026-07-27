const db = require("../database/database");

function getUser(userId, username) {

    let user = db.prepare(
        "SELECT * FROM users WHERE id = ?"
    ).get(userId);

    if (!user) {

        db.prepare(`
            INSERT INTO users
            (id, username, joined)
            VALUES (?, ?, ?)
        `).run(
            userId,
            username,
            new Date().toLocaleDateString()
        );

        user = db.prepare(
            "SELECT * FROM users WHERE id = ?"
        ).get(userId);

    }

    if (user.username !== username) {

        db.prepare(
            "UPDATE users SET username = ? WHERE id = ?"
        ).run(username, userId);

        user.username = username;

    }

    return user;

}

module.exports = {

    getUser

};