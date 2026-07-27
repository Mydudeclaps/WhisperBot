const { buildTargetCommand } = require("../../social-engine/engine/SocialCommandRunner");

module.exports = buildTargetCommand({
    name: "highfive",
    description: "🙌 High-five another user!"
});
