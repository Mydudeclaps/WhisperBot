const CRATES = {
    whisper: {
        keyType: "whisper",
        keyItemId: "discord_crate_key",
        name: "Discord & Vote Rewards Crate",
        keyName: "Discord Crate Key",
        keyEmoji: "🗝️",
        price: 5000,
        dailyPurchaseLimit: 3,
        deliveryMode: "minecraft",
        rewards: [
            { id: "money_500", name: "$500 Community Cash", emoji: "💵", weight: 1200 },
            { id: "money_1000", name: "$1,000 Community Cash", emoji: "💰", weight: 800 },
            { id: "xp_250", name: "250 XP Points", emoji: "✨", weight: 800 },
            { id: "xp_500", name: "500 XP Points", emoji: "🌟", weight: 500 },
            { id: "shards_25", name: "25 Shards", emoji: "🔹", weight: 700 },
            { id: "shards_50", name: "50 Shards", emoji: "💠", weight: 400 },
            { id: "iron_16", name: "16 Iron Ingots", emoji: "⚙️", weight: 600 },
            { id: "gold_8", name: "8 Gold Ingots", emoji: "🟨", weight: 500 },
            { id: "diamonds_4", name: "4 Diamonds", emoji: "💎", weight: 400 },
            { id: "keepsake", name: "Community Keepsake", emoji: "🔮", weight: 600 },
            { id: "rockets_32", name: "32 Firework Rockets", emoji: "🚀", weight: 500 },
            { id: "golden_carrots_32", name: "32 Golden Carrots", emoji: "🥕", weight: 500 },
            { id: "ender_pearls_16", name: "16 Ender Pearls", emoji: "🟢", weight: 500 },
            { id: "builder_box", name: "Builder Box Shulker", emoji: "🟧", weight: 300 },
            { id: "miner_box", name: "Miner Box Shulker", emoji: "⬛", weight: 300 },
            { id: "farmer_box", name: "Farmer Box Shulker", emoji: "🟩", weight: 300 },
            { id: "explorer_box", name: "Explorer Box Shulker", emoji: "🟦", weight: 300 },
            { id: "enchanter_box", name: "Enchanter Box Shulker", emoji: "🟪", weight: 300 },
            { id: "common_keys_2", name: "2 Common Crate Keys", emoji: "🗝️", weight: 400 },
            { id: "gold_key_1", name: "1 Gold Crate Key", emoji: "🔑", weight: 100 }
        ]
    }
};

function getCrate(keyType = "whisper") {
    return CRATES[keyType] || null;
}

module.exports = {
    CRATES,
    getCrate
};
