const CRATES = {
    whisper: {
        keyType: "whisper",
        keyItemId: "discord_crate_key",
        name: "Whisper Crate",
        keyName: "Whisper Crate Key",
        keyEmoji: "🗝️",
        price: 5000,
        dailyPurchaseLimit: 3,
        rewards: [
            {
                id: "coins_1000",
                name: "1,000 Whisper Coins",
                emoji: "💰",
                rarity: "common",
                type: "coins",
                amount: 1000,
                weight: 3500
            },
            {
                id: "coins_2500",
                name: "2,500 Whisper Coins",
                emoji: "💰",
                rarity: "uncommon",
                type: "coins",
                amount: 2500,
                weight: 2500
            },
            {
                id: "ancient_book",
                name: "Ancient Book",
                emoji: "📕",
                rarity: "rare",
                type: "item",
                itemId: "ancient_book",
                amount: 1,
                weight: 1500
            },
            {
                id: "luck_elixir",
                name: "Luck Elixir",
                emoji: "🍀",
                rarity: "rare",
                type: "item",
                itemId: "luck_elixir",
                amount: 1,
                weight: 1000
            },
            {
                id: "crystal_shard",
                name: "Crystal Shard",
                emoji: "💎",
                rarity: "epic",
                type: "item",
                itemId: "crystal_shard",
                amount: 1,
                weight: 800
            },
            {
                id: "mystery_orb",
                name: "Mystery Orb",
                emoji: "🔮",
                rarity: "legendary",
                type: "item",
                itemId: "mystery_orb",
                amount: 1,
                weight: 500
            },
            {
                id: "dragon_scale",
                name: "Dragon Scale",
                emoji: "🐉",
                rarity: "divine",
                type: "item",
                itemId: "dragon_scale",
                amount: 1,
                weight: 200
            }
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
