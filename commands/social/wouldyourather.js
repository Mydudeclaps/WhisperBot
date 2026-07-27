const { buildSimpleResponseCommand } = require("../../social-engine/engine/SimpleResponseRunner");
const { pickRandom } = require("../../social-engine/utils/helpers");

module.exports = buildSimpleResponseCommand({

    name: "wouldyourather",
    description: "🤔 Get a random 'would you rather' scenario!",

    stage1Text: emoji => `${emoji} *Consulting the multiverse of possibilities...*`,

    resolve: (commandData, rarity, ctx) => {

        const pool = commandData.scenarios[rarity] && commandData.scenarios[rarity].length
            ? commandData.scenarios[rarity]
            : commandData.scenarios.common;

        return {
            title: `${ctx.tier.emoji} Would You Rather...`,
            description: pickRandom(pool)
        };

    }

});
