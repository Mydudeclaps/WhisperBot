const db = require("../database/database");
const HORSES = require("../data/horses");
const { HORSE } = require("../config/gameConfig");


// Draws HORSE.RACE_SIZE random horses from the full roster for one race.
function pickRaceField() {

    const shuffled = [...HORSES].sort(() => Math.random() - 0.5);

    return shuffled.slice(0, HORSE.RACE_SIZE);

}


function ownsHorse(userId, horseId) {

    return !!db.prepare(`
        SELECT 1 FROM casino_horses
        WHERE user_id = ? AND horse_id = ?
    `).get(userId, horseId);

}


// Weighted-random winner. Weight is the inverse of a horse's odds (lower
// odds = stronger favorite = more likely to win), with a small bump if the
// bettor owns that horse.
function runRace(field, userId) {

    const weights = field.map(horse => {

        let weight = 1 / horse.odds;

        if (userId && ownsHorse(userId, horse.id)) {
            weight *= (1 + HORSE.OWNER_WIN_BONUS);
        }

        return weight;

    });

    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;

    for (let i = 0; i < field.length; i++) {

        roll -= weights[i];

        if (roll <= 0) return field[i];

    }

    return field[field.length - 1];

}


function buyHorse(userId, horseId) {

    db.prepare(`
        INSERT OR IGNORE INTO casino_horses (user_id, horse_id, purchased_at, races, wins)
        VALUES (?, ?, ?, 0, 0)
    `).run(userId, horseId, new Date().toISOString());

    return ownsHorse(userId, horseId);

}


function getOwnedHorses(userId) {

    return db.prepare(`
        SELECT * FROM casino_horses WHERE user_id = ?
    `).all(userId);

}


function recordRace(userId, horseId, won) {

    if (!ownsHorse(userId, horseId)) return;

    db.prepare(`
        UPDATE casino_horses
        SET races = races + 1, wins = wins + ?
        WHERE user_id = ? AND horse_id = ?
    `).run(won ? 1 : 0, userId, horseId);

}


function getHorseById(horseId) {

    return HORSES.find(h => h.id === horseId) || null;

}


module.exports = {
    HORSES,
    pickRaceField,
    runRace,
    ownsHorse,
    buyHorse,
    getOwnedHorses,
    recordRace,
    getHorseById
};
