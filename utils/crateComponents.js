const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

function buildCrateOpenRow(userId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crate_open:${userId}`)
            .setLabel("Open Whisper Crate")
            .setEmoji("🗝️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
}

module.exports = {
    buildCrateOpenRow
};
