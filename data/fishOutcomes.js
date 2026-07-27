module.exports = {

    // Normal successful catches — one is picked at random when a catch happens
    catches: [
        { text: "🎣 You caught a Bass!", min: 100, max: 500 },
        { text: "🎣 You caught a Trout!", min: 150, max: 600 },
        { text: "🎣 You caught a Salmon!", min: 200, max: 800 },
        { text: "🎣 You caught a Catfish!", min: 250, max: 900 },
        { text: "🎣 You caught a Pike!", min: 300, max: 1200 },
        { text: "🎣 You caught a Muskie!", min: 500, max: 1800 },
        { text: "🎣 You caught a Sturgeon!", min: 800, max: 3000 }
    ],

    // Rare catches — only rolled when RARE_CHANCE hits
    rareCatches: [
        { text: "🌟 You caught a Legendary Fish!", min: 5000, max: 10000 },
        { text: "✨ You caught a Golden Trout!", min: 5000, max: 8000 }
    ],

    // Nothing to show for it — $0 payout
    fails: [
        { text: "🐟 That fish got away!" },
        { text: "🌿 You snagged some seaweed!" },
        { text: "👢 You caught an old boot!" },
        { text: "🗑️ You pulled up some junk!" },
        { text: "🦀 A crab stole your bait!" },
        { text: "🪵 You hooked a log!" },
        { text: "👟 You caught a soggy shoe!" },
        { text: "💨 The big one got away!" },
        { text: "🌊 Your line snapped!" },
        { text: "🐚 You caught an empty shell!" }
    ],

    // The jackpot outcome — TREASURE_CHANCE
    treasure: { text: "💎 You found a treasure chest!", min: 5000, max: 20000 }

};
