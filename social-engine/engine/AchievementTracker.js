const achievements = require("../data/achievements.json");
const SocialStats = require("../models/SocialStats");


// Each achievement type knows how to read the one number it cares about
// off a stats object (as returned by SocialStats.getStats/recordInteraction).
const EXTRACTORS = {

    command_count: (stats, config) => stats.commandUsage[config.command] || 0,
    total_interactions: (stats) => stats.totalInteractions,
    combos_triggered: (stats) => stats.combosTriggered,
    highest_combo: (stats) => stats.highestCombo,
    rarity_count: (stats, config) => stats.rarityCounts[config.rarity] || 0,
    npc_interactions: (stats) => stats.npcInteractions,
    plot_twists: (stats) => stats.plotTwistsWitnessed

};


// Checks every achievement definition against the given (already
// up-to-date, post-interaction) stats object, unlocking any newly-met
// ones. Returns an array of { id, name, description, title } for
// whatever was unlocked THIS call — empty array if nothing new.
function checkAchievements(userId, stats) {

    const newlyUnlocked = [];

    for (const [id, config] of Object.entries(achievements)) {

        if (stats.achievementsUnlocked.includes(id)) continue;

        const extractor = EXTRACTORS[config.type];

        if (!extractor) continue;

        const value = extractor(stats, config);

        if (value >= config.threshold) {

            const didUnlock = SocialStats.unlockAchievement(userId, id, config.title);

            if (didUnlock) {

                newlyUnlocked.push({
                    id,
                    name: config.name,
                    description: config.description,
                    title: config.title
                });

            }

        }

    }

    return newlyUnlocked;

}


module.exports = { checkAchievements };
