const { buildTargetCommand } = require("../../social-engine/engine/SocialCommandRunner");

module.exports = buildTargetCommand({
    name: "cheer",
    description: "📣 Cheer for another user!"
});
