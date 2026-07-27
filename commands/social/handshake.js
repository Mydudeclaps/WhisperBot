const { buildTargetCommand } = require("../../social-engine/engine/SocialCommandRunner");

module.exports = buildTargetCommand({
    name: "handshake",
    description: "🤝 Shake hands with another user!"
});
