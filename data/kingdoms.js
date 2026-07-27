// Canonical kingdom data. Every kingdom command/embed pulls from here so
// colors, emoji, and lore stay consistent everywhere they appear.
//
// circle - the colored circle emoji used on buttons / quick icons
// icon   - the themed emoji shown next to the kingdom name
// color  - embed accent color (hex)
// ansi   - ansi color code used for colored text in embedFactory-style blocks
//          (30 gray, 31 red, 32 green, 33 yellow, 34 blue, 35 pink/purple, 36 cyan)

module.exports = {

    North: {
        name: "North Kingdom",
        circle: "🟢",
        icon: "🌳",
        emoji: "🟢🌳",
        color: 0x2ECC71,
        ansi: "32",
        theme: "Nature • Survival",
        description: "The source of life and natural resources. Sustaining the world.",
        lore: "The heart of nature and survival. Home to farmers, hunters and craftsmen who provide the world with food and natural resources.",
        trades: [
            "Farming & Food",
            "Forestry & Wildlife"
        ],
        npcs: [
            { emoji: "🌾", name: "Farmer" },
            { emoji: "🪓", name: "Lumberjack" },
            { emoji: "🎣", name: "Fisherman" },
            { emoji: "🏹", name: "Hunter" },
            { emoji: "🍯", name: "Beekeeper" }
        ]
    },

    East: {
        name: "East Kingdom",
        circle: "🔵",
        icon: "⚔️",
        emoji: "🔵⚔️",
        color: 0x3498DB,
        ansi: "34",
        theme: "Industry • Strength",
        description: "Forged in strength and industry. We build, we mine, we protect.",
        lore: "Forged in fire and tempered by war. Home to blacksmiths, miners and soldiers who build the tools and walls that protect the realm.",
        trades: [
            "Weapons & Armor",
            "Mining & Resources"
        ],
        npcs: [
            { emoji: "🔨", name: "Blacksmith Hands" },
            { emoji: "⛏️", name: "Miner" },
            { emoji: "🪙", name: "Ore Trader" },
            { emoji: "🧱", name: "Mason" },
            { emoji: "🗡️", name: "Weapons Merchant" }
        ]
    },

    South: {
        name: "South Kingdom",
        circle: "🟣",
        icon: "📖",
        emoji: "🟣📖",
        color: 0x9B59B6,
        ansi: "35",
        theme: "Knowledge • Wisdom",
        description: "Knowledge is power. We study, we explore, we remember.",
        lore: "A sanctuary of scrolls and stargazers. Home to scholars, cartographers and keepers of knowledge who guide the realm's understanding of the world.",
        trades: [
            "Enchanted Books",
            "Knowledge & Exploration"
        ],
        npcs: [
            { emoji: "📖", name: "Librarian Plato" },
            { emoji: "📚", name: "Book Merchant Aristotle" },
            { emoji: "🗺️", name: "Cartographer" },
            { emoji: "🎓", name: "Scholar" },
            { emoji: "🕰️", name: "Historian" }
        ]
    },

    West: {
        name: "West Kingdom",
        circle: "🟠",
        icon: "🐉",
        emoji: "🟠🐉",
        color: 0xE67E22,
        ansi: "33",
        theme: "Mysticism • Secrets",
        description: "Where secrets are kept and power is earned. Only the bold will thrive.",
        lore: "Shrouded in mist and old magic. Home to alchemists, mystics and treasure seekers who chase power hidden just beyond reach.",
        trades: [
            "Magic & Potions",
            "Rare Artifacts & Relics"
        ],
        npcs: [
            { emoji: "⚗️", name: "Alchemist" },
            { emoji: "🧙", name: "Wizard" },
            { emoji: "🗿", name: "Relic Hunter" },
            { emoji: "🐾", name: "Beast Hunter" },
            { emoji: "😎", name: "MyDude" }
        ]
    }

};
