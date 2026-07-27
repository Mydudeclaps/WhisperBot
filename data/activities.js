// Side activity configuration — one entry per /command (mine, chop, dig,
// farm, build, nether, end). These are NOT quests: no objective, no
// start/complete flow, just "run the command, get a random reward, wait
// out a cooldown." Fishing already has its own dedicated /fish command
// (commands/player/fish.js) with its own flavor and outcome table, so it
// isn't duplicated here — see CASINO_CHANGES... actually see
// QUEST_HUB_CHANGES.md for why.
//
// ─── How to add a new activity ──────────────────────────────────────
// 1. Add an entry below following the same shape.
// 2. Copy commands/activities/mine.js to commands/activities/<id>.js and
//    change the two ACTIVITY_ID / .setName/.setDescription lines.
// 3. That's it — activityService and the quest hub both read this file
//    directly, nothing else needs touching.
//
// ─── Field reference ─────────────────────────────────────────────────
// allowedChannels: [] = usable anywhere. Add channel ID strings to
//   restrict it to specific channels.
// cooldown: { min, max } in milliseconds — a random duration in that
//   range is rolled every time, so players can't predict exactly when
//   they'll be free again.
// outcomes: weighted list, `chance` values across all outcomes for one
//   activity should sum to 1.0 (getWeightedOutcome falls back to the
//   last entry if rounding leaves a tiny gap, so it's not fatal if they
//   sum to e.g. 0.99, but keep them close to 1.0).
module.exports = {

    mine: {
        id: "mine",
        name: "Mining",
        emoji: "⛏️",
        description: "Mine for valuable resources",
        enabled: true,
        allowedChannels: [],
        cooldown: { min: 60000, max: 300000 }, // 1-5 minutes
        outcomes: [
            { chance: 0.05, text: "💎 You found a diamond!", coins: { min: 500, max: 1000 }, xp: { min: 10, max: 20 }, emoji: "💎" },
            { chance: 0.20, text: "⛏️ You struck gold!", coins: { min: 200, max: 500 }, xp: { min: 5, max: 10 }, emoji: "✨" },
            { chance: 0.40, text: "🪨 You found some coal.", coins: { min: 50, max: 150 }, xp: { min: 2, max: 5 }, emoji: "🪨" },
            { chance: 0.30, text: "🌫️ Only rocks today.", coins: { min: 10, max: 50 }, xp: { min: 0, max: 2 }, emoji: "🪨" },
            { chance: 0.05, text: "👑 You found a legendary artifact!", coins: { min: 1000, max: 5000 }, xp: { min: 20, max: 50 }, emoji: "👑" }
        ],
        npcLines: [
            "The mines are rich today!",
            "Watch out for cave-ins...",
            "I once found a diamond this big!",
            "The deep caves hold many secrets."
        ],
        cooldownMessage: "Your pickaxe is recharging...",
        cooldownEmoji: "⏳"
    },

    chop: {
        id: "chop",
        name: "Woodcutting",
        emoji: "🪓",
        description: "Chop trees for lumber",
        enabled: true,
        allowedChannels: [],
        cooldown: { min: 45000, max: 240000 }, // 45s-4 minutes
        outcomes: [
            { chance: 0.05, text: "🌳 You felled an ancient oak!", coins: { min: 400, max: 900 }, xp: { min: 8, max: 18 }, emoji: "🌳" },
            { chance: 0.20, text: "🪵 A sturdy haul of oak logs.", coins: { min: 180, max: 450 }, xp: { min: 4, max: 9 }, emoji: "🪵" },
            { chance: 0.40, text: "🪵 A few logs, nothing special.", coins: { min: 40, max: 130 }, xp: { min: 2, max: 4 }, emoji: "🪵" },
            { chance: 0.30, text: "🍂 Just branches and twigs.", coins: { min: 5, max: 40 }, xp: { min: 0, max: 2 }, emoji: "🍂" },
            { chance: 0.05, text: "🌲 You uncovered a hollow tree full of treasure!", coins: { min: 900, max: 4500 }, xp: { min: 18, max: 45 }, emoji: "🌲" }
        ],
        npcLines: [
            "Mind the splinters!",
            "That axe looks well used.",
            "The old grove always gives the best wood.",
            "Careful — some trees bite back."
        ],
        cooldownMessage: "Your axe needs sharpening...",
        cooldownEmoji: "⏳"
    },

    dig: {
        id: "dig",
        name: "Digging",
        emoji: "🏺",
        description: "Dig for buried treasure",
        enabled: true,
        allowedChannels: [],
        cooldown: { min: 60000, max: 300000 },
        outcomes: [
            { chance: 0.04, text: "🏺 An ancient urn, filled with coins!", coins: { min: 600, max: 1200 }, xp: { min: 12, max: 22 }, emoji: "🏺" },
            { chance: 0.18, text: "🪙 A small buried coin pouch.", coins: { min: 200, max: 480 }, xp: { min: 5, max: 10 }, emoji: "🪙" },
            { chance: 0.38, text: "🦴 Just some old bones.", coins: { min: 40, max: 140 }, xp: { min: 2, max: 5 }, emoji: "🦴" },
            { chance: 0.35, text: "🕳️ Nothing but dirt.", coins: { min: 5, max: 40 }, xp: { min: 0, max: 2 }, emoji: "🕳️" },
            { chance: 0.05, text: "👑 A buried royal treasure chest!", coins: { min: 1000, max: 4800 }, xp: { min: 20, max: 48 }, emoji: "👑" }
        ],
        npcLines: [
            "X marks the spot, or so they say.",
            "I've been digging here for years, found nothing.",
            "Careful of what you wake up down there.",
            "Every hole tells a story."
        ],
        cooldownMessage: "Your shovel needs a rest...",
        cooldownEmoji: "⏳"
    },

    farm: {
        id: "farm",
        name: "Farming",
        emoji: "🌾",
        description: "Farm crops for a harvest",
        enabled: true,
        allowedChannels: [],
        cooldown: { min: 45000, max: 240000 },
        outcomes: [
            { chance: 0.05, text: "🌽 A record-breaking harvest!", coins: { min: 450, max: 950 }, xp: { min: 9, max: 19 }, emoji: "🌽" },
            { chance: 0.22, text: "🥕 A healthy crop of vegetables.", coins: { min: 190, max: 460 }, xp: { min: 4, max: 9 }, emoji: "🥕" },
            { chance: 0.40, text: "🌱 A modest yield.", coins: { min: 40, max: 130 }, xp: { min: 2, max: 4 }, emoji: "🌱" },
            { chance: 0.28, text: "🍂 The crops withered — bad season.", coins: { min: 5, max: 35 }, xp: { min: 0, max: 2 }, emoji: "🍂" },
            { chance: 0.05, text: "🎃 A giant enchanted pumpkin!", coins: { min: 850, max: 4200 }, xp: { min: 17, max: 42 }, emoji: "🎃" }
        ],
        npcLines: [
            "The soil's been good to us this year.",
            "Rain's coming — best to harvest now.",
            "My grandmother taught me this trick with the seeds.",
            "Nothing beats fresh vegetables."
        ],
        cooldownMessage: "Your crops need more time to grow...",
        cooldownEmoji: "⏳"
    },

    build: {
        id: "build",
        name: "Building",
        emoji: "🏗️",
        description: "Build structures for coin and experience",
        enabled: true,
        allowedChannels: [],
        cooldown: { min: 90000, max: 300000 }, // 1.5-5 minutes — building takes longer
        outcomes: [
            { chance: 0.05, text: "🏰 You completed a masterwork build!", coins: { min: 600, max: 1100 }, xp: { min: 12, max: 22 }, emoji: "🏰" },
            { chance: 0.20, text: "🏠 A solid, well-built structure.", coins: { min: 220, max: 500 }, xp: { min: 5, max: 10 }, emoji: "🏠" },
            { chance: 0.40, text: "🧱 A basic structure, nothing fancy.", coins: { min: 50, max: 150 }, xp: { min: 2, max: 5 }, emoji: "🧱" },
            { chance: 0.30, text: "💥 It collapsed halfway through.", coins: { min: 10, max: 45 }, xp: { min: 0, max: 2 }, emoji: "💥" },
            { chance: 0.05, text: "🏯 A legendary architectural wonder!", coins: { min: 1000, max: 5000 }, xp: { min: 20, max: 50 }, emoji: "🏯" }
        ],
        npcLines: [
            "Measure twice, build once.",
            "That's some solid craftsmanship.",
            "I've seen towers taller than this fall over.",
            "The foundation is everything."
        ],
        cooldownMessage: "Your materials are still being gathered...",
        cooldownEmoji: "⏳"
    },

    nether: {
        id: "nether",
        name: "Nether Exploration",
        emoji: "🔥",
        description: "Explore the dangerous Nether",
        enabled: true,
        allowedChannels: [],
        cooldown: { min: 120000, max: 300000 }, // 2-5 minutes — riskier, longer cooldown
        outcomes: [
            { chance: 0.04, text: "🔥 You found a Nether fortress vault!", coins: { min: 700, max: 1500 }, xp: { min: 15, max: 28 }, emoji: "🔥" },
            { chance: 0.18, text: "🟡 A vein of glowstone and gold.", coins: { min: 250, max: 550 }, xp: { min: 6, max: 12 }, emoji: "🟡" },
            { chance: 0.38, text: "🪨 Some netherrack, nothing special.", coins: { min: 50, max: 150 }, xp: { min: 2, max: 5 }, emoji: "🪨" },
            { chance: 0.35, text: "😨 A ghast scared you off empty-handed.", coins: { min: 5, max: 40 }, xp: { min: 0, max: 2 }, emoji: "😨" },
            { chance: 0.05, text: "👑 You looted a bastion's treasure room!", coins: { min: 1200, max: 5500 }, xp: { min: 24, max: 55 }, emoji: "👑" }
        ],
        npcLines: [
            "Watch for the lava — always watch for the lava.",
            "The Nether doesn't forgive mistakes.",
            "I lost a whole inventory to a ghast once.",
            "Bring golden armor if you value your life."
        ],
        cooldownMessage: "The portal is still cooling down...",
        cooldownEmoji: "⏳"
    },

    end: {
        id: "end",
        name: "The End",
        emoji: "🌌",
        description: "Explore the mysterious End dimension",
        enabled: true,
        allowedChannels: [],
        cooldown: { min: 150000, max: 300000 }, // 2.5-5 minutes — the riskiest activity
        outcomes: [
            { chance: 0.03, text: "🌌 You claimed a dragon egg!", coins: { min: 1500, max: 3000 }, xp: { min: 30, max: 60 }, emoji: "🌌" },
            { chance: 0.15, text: "🟣 A haul of chorus fruit and shulker shells.", coins: { min: 300, max: 650 }, xp: { min: 7, max: 14 }, emoji: "🟣" },
            { chance: 0.37, text: "⬛ Some endstone, nothing special.", coins: { min: 50, max: 160 }, xp: { min: 2, max: 5 }, emoji: "⬛" },
            { chance: 0.40, text: "🕶️ An Enderman caught you looking — you fled empty-handed.", coins: { min: 5, max: 40 }, xp: { min: 0, max: 2 }, emoji: "🕶️" },
            { chance: 0.05, text: "👑 You raided an End city ship!", coins: { min: 1400, max: 6000 }, xp: { min: 28, max: 60 }, emoji: "👑" }
        ],
        npcLines: [
            "Don't make eye contact with the Endermen.",
            "The void doesn't care how brave you are.",
            "I've heard the cities out there are unguarded now.",
            "Bring pearls — you'll want a way back."
        ],
        cooldownMessage: "The void still unsettles you...",
        cooldownEmoji: "⏳"
    }

};
