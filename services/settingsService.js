const db = require("../database/database");

function getSetting(name) {

    const row = db.prepare(`
        SELECT value
        FROM bot_settings
        WHERE setting = ?
    `).get(name);

    return row ? row.value : null;

}

function setSetting(name, value) {

    db.prepare(`
        INSERT INTO bot_settings(setting, value)
        VALUES(?, ?)

        ON CONFLICT(setting)

        DO UPDATE SET

        value = excluded.value
    `).run(name, value);

}

module.exports = {

    getSetting,
    setSetting

};