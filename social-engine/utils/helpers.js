// Picks one random element from an array.
function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}


// Picks `count` distinct random elements from an array (no repeats,
// order not preserved). Used for things like emoji sets where we want a
// handful of different symbols rather than the same one repeated.
function pickRandomMany(array, count) {

    const pool = [...array];
    const picked = [];

    while (picked.length < count && pool.length > 0) {
        const index = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(index, 1)[0]);
    }

    return picked;

}


// Replaces {user} and {target} placeholders in a template string with
// the given display strings (usually Discord mentions or usernames).
function fillTemplate(template, { user, target }) {

    return template
        .replaceAll("{user}", user)
        .replaceAll("{target}", target || "");

}


// Rolls true/false against a percent chance, e.g. rollChance(5) is true
// ~5% of the time.
function rollChance(percent) {
    return Math.random() * 100 < percent;
}


module.exports = {

    pickRandom,
    pickRandomMany,
    fillTemplate,
    rollChance

};
