module.exports = {

    // How many reactions to add per triggered message
    REACTION_COUNT: 5,

    // Random delay before reacting, so it feels organic rather than instant
    MIN_DELAY_MS: 250,
    MAX_DELAY_MS: 1500,

    // Each trigger is a literal sequence that must be the FINAL characters
    // of the message. Add new triggers here — the service logic below
    // never needs to change.
    TRIGGERS: [

        {
            sequence: "!!!!",
            pool: ["🎉", "🎊", "🔥", "⚡", "⭐", "🌟", "💥", "🚀", "👏", "💯", "🎯", "😎"]
        },

        {
            sequence: "????",
            pool: ["🤔", "❓", "🧐", "😵", "🤨", "😅", "👀", "💭", "😶", "🤯"]
        },

        {
            sequence: "!?!?",
            pool: ["😱", "🤯", "💥", "😂", "🔥", "😵", "🤣", "👀", "🎭", "⚡"]
        },

        {
            sequence: "$$$$",
            pool: ["💰", "🪙", "💎", "💸", "🤑", "👑", "💵", "📈", "✨", "🏆"]
        }

        // Future triggers can be added here without touching
        // emojiReactionService.js, e.g.:
        // { sequence: "^^^^", pool: [...] },
        // { sequence: "%%%%", pool: [...] },
        // { sequence: "&&&&", pool: [...] },
        // { sequence: "~~~~", pool: [...] }

    ]

};
