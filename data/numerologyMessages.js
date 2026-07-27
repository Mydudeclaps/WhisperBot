// Failure DM flavor text + NPC dialogue for Numerology events. Content
// only — services/numerologyEmbeds.js (in utils/, see note there) does
// the actual formatting.

// 18 randomized failure jokes. {correct} and {given} are replaced with
// the real/attempted numbers by whoever renders these.
const FAILURE_MESSAGES = [
    "🧠 Brain missing. Possible locations: under your keyboard, on the floor, somewhere in another universe.",
    "Your mathematics degree has been revoked. You have been banned from counting for 5 seconds.",
    "The numbers saw that coming from a mile away. They are disappointed, but not surprised.",
    "Somewhere, a calculator just sighed.",
    "That's not a number, that's a cry for help.",
    "The count has filed a restraining order against your fingers.",
    "Legend says there's a version of you in another timeline who got this right. This isn't that timeline.",
    "You have been officially downgraded from 'counts things' to 'counts on it not mattering.'",
    "The Whisper Archives will remember this. Forever. Sorry.",
    "Somewhere, Old Tom just shook his head slowly.",
    "That number has never met the number you were supposed to say. They are not friends.",
    "Breaking news: local counter attempts math, math wins again.",
    "The universe briefly considered ending here. It decided against it, but only barely.",
    "Your keyboard would like to file a formal complaint about being blamed for this.",
    "That's an interesting interpretation of 'the next number.' Bold. Wrong. But bold.",
    "The count did not see this coming, and yet somehow also completely saw this coming.",
    "You have unlocked a new achievement: Creative Mathematics. It is not a good achievement.",
    "Somewhere, a number that WASN'T the answer is feeling very smug right now."
];

// NPC dialogue for numerology-specific moments — kept separate from
// data/casinoNpcs.js (casino-only) since these four personas show up in
// a completely different context here. Tree of Life is new — doesn't
// exist as an NPC anywhere else in the codebase yet, invented fresh for
// this feature per WhisperSMP's established lore (referenced in the
// server's broader mythology, never previously given actual dialogue).
const NPC_DIALOGUE = {

    old_tom: {
        name: "Old Tom",
        emoji: "🎲",
        milestone: [
            "I remember when this channel was empty...",
            "Numbers like these don't come easy. Well done.",
            "I've counted a lot of things in my time. This ranks up there."
        ],
        chaos: [
            "The numbers are restless today...",
            "I felt that one coming. The count always tells you, if you listen.",
            "Something's different about the air in here now."
        ],
        guide: [
            "Careful now — the count doesn't forgive twice.",
            "Slow and steady. The numbers reward patience."
        ]
    },

    lucy: {
        name: "Lucy",
        emoji: "👩‍🍳",
        cheer: [
            "You're on fire! The numbers love you!",
            "Look at you go! Don't stop now!",
            "That's the spirit! Keep the streak alive!"
        ],
        milestone: [
            "What a milestone! I'm so proud of this channel.",
            "This calls for a celebration. Well earned!"
        ],
        daily: [
            "Good to see you counting again today!",
            "Back for more? I love the dedication."
        ]
    },

    frank: {
        name: "Frank \"The Banker\" Moretti",
        emoji: "🕴️",
        streak: [
            "I've seen counting, but this is something else.",
            "That's a streak worth respecting. The house is watching.",
            "Impressive run. Don't get comfortable — the count always evens out eventually."
        ],
        chaos: [
            "Now THAT'S a twist I didn't see coming.",
            "The house respects chaos. Chaos is where the real stories happen."
        ]
    },

    tree_of_life: {
        name: "Tree of Life",
        emoji: "🌳",
        rare: [
            "The roots of numbers run deep... deeper than any of you know.",
            "Every count is a season. Every mistake, a fallen leaf that feeds what grows next.",
            "I have stood since before the first number was spoken here. I will stand after the last."
        ]
    }

};

module.exports = { FAILURE_MESSAGES, NPC_DIALOGUE };
