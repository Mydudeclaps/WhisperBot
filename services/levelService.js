const { XP } = require("../config/gameConfig");

function getTitle(level) {

    if (level >= 500) return "🌌 Mythic";
    if (level >= 250) return "👑 Legend";
    if (level >= 100) return "⚔️ Warrior";
    if (level >= 50) return "🛡️ Knight";
    if (level >= 15) return "🗡️ Adventurer";

    return "🌱 Newcomer";

}

function xpNeeded(level) {

    return level * XP.PER_LEVEL;

}

module.exports = {

    getTitle,
    xpNeeded

};