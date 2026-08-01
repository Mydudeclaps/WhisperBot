// Centralized routing for WhisperBot's automated, server-wide
// announcements. Each announce* function fetches its destination from
// config/notificationConfig.js and sends there — callers never need to
// know a channel ID, and adding a new announcement type just means adding
// one more function here plus one more constant in the config file.
//
// Every function fails silently (logs and returns false) rather than
// throwing, matching utils/adminLogger.js's pattern — a missing/misconfigured
// notification channel should never break the game system that triggered
// the announcement.
const {
    LORE_ARCHIVE_CHANNEL_ID,
    PLAYER_UPDATES_CHANNEL_ID
} = require("../config/notificationConfig");


async function sendToConfiguredChannel(client, channelId, payload, label) {

    if (!channelId) return false;

    try {

        const channel = await client.channels
            .fetch(channelId)
            .catch(() => null);

        if (!channel) {
            console.error(`notificationRouter: ${label} channel (${channelId}) could not be fetched — check the ID and that the bot can see it.`);
            return false;
        }

        await channel.send(payload);
        return true;

    } catch (error) {

        console.error(`notificationRouter: failed to send ${label} announcement:`, error);
        return false;

    }

}


// Posts a scheduled/manual Lore Archive entry to the Lore Archive channel.
function announceLoreEntry(client, embed) {
    return sendToConfiguredChannel(client, LORE_ARCHIVE_CHANNEL_ID, { embeds: [embed] }, "Lore Archive");
}


// Posts a level-up or achievement/milestone unlock to the Player Updates
// channel.
function announcePlayerProgression(client, embed) {
    return sendToConfiguredChannel(client, PLAYER_UPDATES_CHANNEL_ID, { embeds: [embed] }, "Player Updates");
}


module.exports = {

    announceLoreEntry,

    announcePlayerProgression

};
