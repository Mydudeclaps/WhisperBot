const { buildSimpleResponseContextCommand } = require("../../social-engine/engine/SimpleResponseRunner");
const { config } = require("../social/aura");

// Reuses aura.js's exact stage1Text/resolve config — no redefinition.
module.exports = buildSimpleResponseContextCommand({
    name: config.name,
    displayName: "Check Aura",
    resolve: config.resolve,
    stage1Text: config.stage1Text
});
