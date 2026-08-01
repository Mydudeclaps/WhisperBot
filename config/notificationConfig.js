// Centralized destinations for WhisperBot's automated, server-wide
// announcements. Anything that proactively posts to a channel on its own
// (not as a direct reply to a command the player just ran) should pull its
// channel ID from here rather than hardcoding one inline or guessing at
// runtime — that guessing pattern is exactly what caused Lore Archive
// broadcasts to land in the Welcome channel (see docs/updates/ for the
// 2026-07-29 notification routing audit).
module.exports = {

    // Scheduled Lore Archive broadcasts (schedulers/loreBroadcast.js).
    LORE_ARCHIVE_CHANNEL_ID: "1520925678038683829",

    // Ambient player-progression announcements: chat-XP level-ups and the
    // level-based achievements tied to them (events/messageCreate.js).
    PLAYER_UPDATES_CHANNEL_ID: "1526546226890276905",

    // WhisperSMP's actual Welcome channel. WhisperBot has no feature that
    // should ever post to this — it's recorded here only as a reference
    // point for the channel that Lore Archive posts were mistakenly
    // landing in before this file existed (guild.systemChannel happened
    // to be set to this channel).
    WELCOME_CHANNEL_ID: "1491498853998788800"

};
