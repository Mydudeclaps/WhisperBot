module.exports = {
    // ============================================
    // 💬 COMMUNICATION MISSIONS
    // ============================================
    
    messages_20: {
        id: "messages_20",
        name: "💬 Talkative",
        description: "Send 20 messages.",
        type: "messages",
        goal: 20,
        rewardXP: 250,
        rewardCoins: 500,
        rewardRep: 5
    },

    messages_50: {
        id: "messages_50",
        name: "🗣️ Chatterbox",
        description: "Send 50 messages.",
        type: "messages",
        goal: 50,
        rewardXP: 500,
        rewardCoins: 1000,
        rewardRep: 10
    },

    // ============================================
    // 🎙️ ACTIVITY MISSIONS
    // ============================================

    voice_30: {
        id: "voice_30",
        name: "🎙️ Voice Time",
        description: "Spend 30 minutes in voice.",
        type: "voice_minutes",
        goal: 30,
        rewardXP: 300,
        rewardCoins: 600,
        rewardRep: 5
    },

    voice_60: {
        id: "voice_60",
        name: "🎧 Voice Master",
        description: "Spend 60 minutes in voice.",
        type: "voice_minutes",
        goal: 60,
        rewardXP: 600,
        rewardCoins: 1200,
        rewardRep: 10
    },

    // ============================================
    // ⭐ COMMUNITY MISSIONS (GIVE Reactions)
    // ============================================

    reactions_given_25: {
        id: "reactions_given_25",
        name: "👍 Community Support",
        description: "React to 25 messages from other members",
        type: "reactions_given",
        goal: 25,
        rewardXP: 250,
        rewardCoins: 500,
        rewardRep: 5
    },

    reactions_given_50: {
        id: "reactions_given_50",
        name: "🤝 Community Hero",
        description: "React to 50 messages from other members",
        type: "reactions_given",
        goal: 50,
        rewardXP: 500,
        rewardCoins: 1000,
        rewardRep: 10
    },

    // ============================================
    // ⭐ COMMUNITY MISSIONS (RECEIVE Reactions)
    // ============================================

    reactions_received_10: {
        id: "reactions_received_10",
        name: "⭐ Community Favorite",
        description: "Receive 10 reactions on your messages",
        type: "reactions_received",
        goal: 10,
        rewardXP: 500,
        rewardCoins: 1000,
        rewardRep: 10
    },

    reactions_received_25: {
        id: "reactions_received_25",
        name: "🌟 Community Star",
        description: "Receive 25 reactions on your messages",
        type: "reactions_received",
        goal: 25,
        rewardXP: 1000,
        rewardCoins: 2000,
        rewardRep: 20
    },
};