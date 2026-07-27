const { buildTargetCommand } = require("../../social-engine/engine/SocialCommandRunner");

module.exports = buildTargetCommand({
    name: "boop",
    description: "👉 Boop another user's nose!"
});
