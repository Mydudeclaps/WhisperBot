const { buildSimpleResponseCommand } = require("../../social-engine/engine/SimpleResponseRunner");
const { pickRandom } = require("../../social-engine/utils/helpers");

// Pulled out to a named config so commands/context/raterizz.js can reuse
// the exact same stage1Text/resolve logic for the context menu version
// instead of redefining it.
const config = {

    name: "rizz",
    description: "😎 Check someone's rizz level! (or your own)",
    targetMode: "optional",

    stage1Text: (emoji, ctx) => `${emoji} *Calculating ${ctx.target.id === ctx.user.id ? "your " : ""}rizz level...*`,

    resolve: (commandData, rarity, ctx) => {

        const pool = commandData.responses[rarity] && commandData.responses[rarity].length
            ? commandData.responses[rarity]
            : commandData.responses.common;

        const line = pickRandom(pool).replaceAll("{target}", `**${ctx.target.username}**`);

        return {
            title: `${ctx.tier.emoji} Rizz Check`,
            description: line
        };

    }

};

module.exports = buildSimpleResponseCommand(config);
module.exports.config = config;
