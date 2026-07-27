// Rarity tiers, heaviest-weighted first. Weights sum to 100 and are
// checked as cumulative thresholds in roll() below.
const TIERS = {

    common: { weight: 50, color: 0x808080, emoji: "⭐", label: "Common", stars: "★" },
    uncommon: { weight: 25, color: 0x1E90FF, emoji: "🌟", label: "Uncommon", stars: "★★" },
    rare: { weight: 15, color: 0x9B59B6, emoji: "✨", label: "Rare", stars: "★★★" },
    epic: { weight: 7, color: 0xF1C40F, emoji: "👑", label: "Epic", stars: "★★★★" },
    legendary: { weight: 2.5, color: 0xE74C3C, emoji: "🔮", label: "Legendary", stars: "★★★★★" },
    divine: { weight: 0.5, color: 0xFFD700, emoji: "☀️", label: "Divine", stars: "★★★★★★" }

};

// Roll order, rarest first — matters for the cumulative-threshold check
// in roll() below.
const ROLL_ORDER = ["divine", "legendary", "epic", "rare", "uncommon", "common"];


// Rolls a rarity tier, respecting the weights above. Returns the tier
// key (e.g. "rare"), not the full metadata — use getTierData() for that.
function roll() {

    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const tier of ROLL_ORDER) {

        cumulative += TIERS[tier].weight;

        if (rand < cumulative) {
            return tier;
        }

    }

    // Floating point safety net — should be unreachable since weights
    // sum to exactly 100.
    return "common";

}


function getTierData(tier) {
    return TIERS[tier] || TIERS.common;
}


function getAllTiers() {
    return TIERS;
}


module.exports = {

    roll,
    getTierData,
    getAllTiers

};
