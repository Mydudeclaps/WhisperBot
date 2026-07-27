const {
    incrementStat
} = require("../statsService");


const {
    updateMissionProgress
} = require("../dailyProgressService");

const {
    updateQuestProgress
} = require("../questProgressService");

const {
    handleEmojiTriggers
} = require("./emojiReactionService");

const {
    isChannelExcluded
} = require("../../config/questChannelConfig");



async function processMessage(message) {


    const userId =
    message.author.id;


    // Blacklisted channels (bot-commands, mod-logs, etc.) never count
    // toward quest progress, but stats/XP/missions are untouched — this
    // only gates the quest system per the exclusion list in bot settings.
    const questEligible = !isChannelExcluded(message.channel);


    incrementStat(
        userId,
        "messages_sent"
    );


    await updateMissionProgress(
        userId,
        "messages",
        1,
        message.channel
    );

    if (questEligible) {

        // Server-wide: this listener already runs for every channel via
        // the global messageCreate event, so MESSAGES quests count
        // regardless of which channel the quest embed itself lives in.
        updateQuestProgress(
            userId,
            "MESSAGES",
            1
        );

        // CHANNELS-type quests (e.g. "send messages in 5 different
        // channels") track distinct channel IDs rather than raw message
        // count — pass the channel id through so questProgressService can
        // dedupe.
        updateQuestProgress(
            userId,
            "CHANNELS",
            1,
            message.channel.id
        );

    }

    // Fire-and-forget: reacting has its own randomized delay
    // (250-1500ms) and shouldn't block XP/mission/quest processing above.
    handleEmojiTriggers(message).catch(err =>
        console.error("Emoji reaction error:", err)
    );


}


module.exports = {

    processMessage

};
