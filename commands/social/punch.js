const { buildTargetCommand } = require("../../social-engine/engine/SocialCommandRunner");

module.exports = buildTargetCommand({
    name: "punch",
    description: "👊 Punch another user!"
});
