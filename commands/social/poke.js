const { buildTargetCommand } = require("../../social-engine/engine/SocialCommandRunner");

module.exports = buildTargetCommand({
    name: "poke",
    description: "👉 Poke another user!"
});
