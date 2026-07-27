const { ContextMenuCommandBuilder, ApplicationCommandType } = require("discord.js");
const { runShipInteraction } = require("../social/ship");

// /ship fundamentally needs TWO targets, but a user context menu command
// only ever supplies one (whoever was right-clicked) — there's no way
// for Discord to collect a second user in that same interaction. The
// natural mapping, consistent with every other context command here
// ("do this between me and them"): ships the clicking user with the
// right-clicked user. Reuses ship.js's exact resolution/embed/rarity/NPC
// logic via the extracted runShipInteraction — no duplication.
module.exports = {

    data: new ContextMenuCommandBuilder()
        .setName("Ship With")
        .setType(ApplicationCommandType.User),

    async execute(interaction) {

        const target1 = interaction.user;
        const target2 = interaction.targetUser;

        return runShipInteraction(interaction, target1, target2);

    }

};
