const { buildSimpleResponseCommand } = require("../../social-engine/engine/SimpleResponseRunner");
const { pickRandom } = require("../../social-engine/utils/helpers");

module.exports = buildSimpleResponseCommand({

    name: "coinflip",
    description: "🪙 Flip a coin!",

    stage1Text: emoji => `${emoji} *Flipping the coin...*`,

    resolve: (commandData, rarity, ctx) => {

        // The actual result is a genuine, independent 50/50 — rarity
        // only decides how dramatic the flavor text around it is, so
        // the flip itself always stays fair.
        const result = Math.random() < 0.5 ? "Heads" : "Tails";

        const pool = commandData.flavor[rarity] && commandData.flavor[rarity].length
            ? commandData.flavor[rarity]
            : commandData.flavor.common;

        const line = pickRandom(pool).replaceAll("{result}", result);

        return {
            title: `${ctx.tier.emoji} Coin Flip!`,
            description: line
        };

    }

});
