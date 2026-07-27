const { buildSimpleResponseContextCommand } = require("../../social-engine/engine/SimpleResponseRunner");
const { config } = require("../social/rizz");

// Reuses rizz.js's exact stage1Text/resolve config — no redefinition.
module.exports = buildSimpleResponseContextCommand({
    name: config.name,
    displayName: "Rate Rizz",
    resolve: config.resolve,
    stage1Text: config.stage1Text
});
