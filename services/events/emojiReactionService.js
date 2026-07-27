const {
    TRIGGERS,
    REACTION_COUNT,
    MIN_DELAY_MS,
    MAX_DELAY_MS
} = require("../../data/emojiTriggers");


// Finds the trigger (if any) whose sequence is the literal final
// characters of the message content.
function findTrigger(content) {

    for (const trigger of TRIGGERS) {

        if (content.endsWith(trigger.sequence)) {
            return trigger;
        }

    }

    return null;

}


// Picks `count` unique random emojis from a pool — never the same emoji
// twice on the same message.
function pickRandomEmojis(pool, count) {

    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    return shuffled.slice(0, Math.min(count, shuffled.length));

}


function wait(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));

}


function randomDelay() {

    return Math.floor(
        Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)
    ) + MIN_DELAY_MS;

}


// Reacts to a message that intentionally ends with a trigger sequence
// (e.g. "That was insane!?!?"). Safe to call on every message in the
// pipeline — it silently no-ops when nothing matches. Never throws.
async function handleEmojiTriggers(message) {

    try {

        if (!message || message.author?.bot) return;

        if (!message.guild) return; // ignore DMs

        const content = message.content;

        if (!content) return;

        const trigger = findTrigger(content);

        if (!trigger) return;

        // Don't double-react if the bot already reacted to this message
        const alreadyReacted = message.reactions.cache.some(r => r.me);
        if (alreadyReacted) return;

        await wait(randomDelay());

        const emojis = pickRandomEmojis(trigger.pool, REACTION_COUNT);

        for (const emoji of emojis) {

            try {

                await message.react(emoji);

            } catch (err) {

                // Gracefully skip emojis the bot can't use (e.g. a custom
                // emoji from a server it isn't in) without crashing.
                console.error(
                    `⚠️ Emoji reaction failed (${emoji}) on message ${message.id}: ${err.message}`
                );

            }

        }

    } catch (err) {

        console.error("Emoji reaction service error:", err);

    }

}


module.exports = {

    handleEmojiTriggers

};
