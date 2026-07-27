const { buildSimpleResponseCommand } = require("../../social-engine/engine/SimpleResponseRunner");
const { pickRandom } = require("../../social-engine/utils/helpers");

module.exports = buildSimpleResponseCommand({

    name: "8ball",
    description: "🎱 Ask the magic 8-ball a question!",
    hasQuestion: true,

    stage1Text: emoji => `${emoji} *Shaking the magic 8-ball...*`,

    resolve: (commandData, rarity, ctx) => {

        const pool = commandData.responses[rarity] && commandData.responses[rarity].length
            ? commandData.responses[rarity]
            : commandData.responses.common;

        const answer = pickRandom(pool);

        return {
            title: `${ctx.tier.emoji} The 8-Ball Reveals...`,
            description: `🎱 **${answer}**`
        };

    }

});
