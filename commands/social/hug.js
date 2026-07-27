const { buildTargetCommand } = require("../../social-engine/engine/SocialCommandRunner");

module.exports = buildTargetCommand({
    name: "hug",
    description: "🤗 Hug another user!"
});
