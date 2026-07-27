// Reaction pools by rarity tier — services/numerologyRewards.js rolls a
// tier (weighted, see config/numerologyConfig.js REACTION_RARITY) and
// picks 1-3 emoji from that tier's pool at random.
module.exports = {

    common: ["🔥", "🎯", "👏", "💯", "⭐", "😂"],
    rare: ["👑", "💎", "🏆", "⚡"],
    legendary: ["🐉", "🌌", "🪐"],
    divine: ["☀️", "🌙", "🌟"],

    // Occasionally used instead of a tier pool, purely to keep players
    // guessing ("keep players guessing" chaos rule) — rolled at a low
    // flat chance independent of rarity tier.
    wildcard: ["🥔", "🦆", "🎃", "🧦", "🌮", "🛸", "🐢"]

};
