module.exports = {

    // ============================================
    // 💬 MESSAGE QUESTS
    // ============================================

    CHATTY_STARTER: {
        id: "CHATTY_STARTER",
        name: "💬 Getting Chatty",
        description: "Send 100 messages",
        type: "MESSAGES",
        goal: 100,
        rewardXP: 200,
        rewardCoins: 400,
        rewardRep: 5,
        category: "social",      // NEW
        difficulty: "easy",  // NEW
        emoji: "💬"             // NEW
    },

    CHATTY_REGULAR: {
        id: "CHATTY_REGULAR",
        name: "🗣️ Server Regular",
        description: "Send 500 messages",
        type: "MESSAGES",
        goal: 500,
        rewardXP: 750,
        rewardCoins: 1500,
        rewardRep: 15,
        category: "social",      // NEW
        difficulty: "medium",  // NEW
        emoji: "🗣️"             // NEW
    },

    CHATTY_VETERAN: {
        id: "CHATTY_VETERAN",
        name: "📣 Community Voice",
        description: "Send 1,000 messages",
        type: "MESSAGES",
        goal: 1000,
        rewardXP: 1500,
        rewardCoins: 3000,
        rewardRep: 30,
        category: "social",      // NEW
        difficulty: "hard",  // NEW
        emoji: "📣"             // NEW
    },

    CHATTY_LEGEND: {
        id: "CHATTY_LEGEND",
        name: "🏛️ Town Crier",
        description: "Send 5,000 messages",
        type: "MESSAGES",
        goal: 5000,
        rewardXP: 5000,
        rewardCoins: 10000,
        rewardRep: 75,
        category: "social",      // NEW
        difficulty: "legend",  // NEW
        emoji: "🏛️"             // NEW
    },

    // ============================================
    // 🎙️ VOICE QUESTS
    // ============================================

    VOICE_NEWCOMER: {
        id: "VOICE_NEWCOMER",
        name: "🎙️ First Call",
        description: "Spend 60 minutes in voice channels",
        type: "VOICE_MINUTES",
        goal: 60,
        rewardXP: 200,
        rewardCoins: 400,
        rewardRep: 5,
        category: "voice",      // NEW
        difficulty: "easy",  // NEW
        emoji: "🎙️"             // NEW
    },

    VOICE_REGULAR: {
        id: "VOICE_REGULAR",
        name: "🎧 Hangout Regular",
        description: "Spend 300 minutes in voice channels",
        type: "VOICE_MINUTES",
        goal: 300,
        rewardXP: 750,
        rewardCoins: 1500,
        rewardRep: 15,
        category: "voice",      // NEW
        difficulty: "medium",  // NEW
        emoji: "🎧"             // NEW
    },

    VOICE_VETERAN: {
        id: "VOICE_VETERAN",
        name: "📡 Always Online",
        description: "Spend 1,000 minutes in voice channels",
        type: "VOICE_MINUTES",
        goal: 1000,
        rewardXP: 1500,
        rewardCoins: 3000,
        rewardRep: 30,
        category: "voice",      // NEW
        difficulty: "hard",  // NEW
        emoji: "📡"             // NEW
    },

    VOICE_LEGEND: {
        id: "VOICE_LEGEND",
        name: "📻 Voice of the Server",
        description: "Spend 5,000 minutes in voice channels",
        type: "VOICE_MINUTES",
        goal: 5000,
        rewardXP: 5000,
        rewardCoins: 10000,
        rewardRep: 75,
        category: "voice",      // NEW
        difficulty: "legend",  // NEW
        emoji: "📻"             // NEW
    },

    // ============================================
    // ⭐ REACTION QUESTS
    // ============================================

    KIND_HEART: {
        id: "KIND_HEART",
        name: "💛 Kind Heart",
        description: "Give 25 reactions to other members' messages",
        type: "REACTIONS_GIVEN",
        goal: 25,
        rewardXP: 200,
        rewardCoins: 400,
        rewardRep: 5,
        category: "community",      // NEW
        difficulty: "easy",  // NEW
        emoji: "💛"             // NEW
    },

    SUPPORTIVE_SOUL: {
        id: "SUPPORTIVE_SOUL",
        name: "🤗 Supportive Soul",
        description: "Give 150 reactions to other members' messages",
        type: "REACTIONS_GIVEN",
        goal: 150,
        rewardXP: 750,
        rewardCoins: 1500,
        rewardRep: 15,
        category: "community",      // NEW
        difficulty: "medium",  // NEW
        emoji: "🤗"             // NEW
    },

    REACTION_MASTER: {
        id: "REACTION_MASTER",
        name: "⭐ Reaction Master",
        description: "Receive 25 reactions from community members",
        type: "REACTIONS_RECEIVED",
        goal: 25,
        rewardXP: 300,
        rewardCoins: 600,
        rewardRep: 10,
        category: "community",      // NEW
        difficulty: "easy",  // NEW
        emoji: "⭐"             // NEW
    },

    CROWD_FAVORITE: {
        id: "CROWD_FAVORITE",
        name: "🌟 Crowd Favorite",
        description: "Receive 150 reactions from community members",
        type: "REACTIONS_RECEIVED",
        goal: 150,
        rewardXP: 1000,
        rewardCoins: 2000,
        rewardRep: 25,
        category: "community",      // NEW
        difficulty: "medium",  // NEW
        emoji: "🌟"             // NEW
    },

    // ============================================
    // 🗺️ WORLD QUESTS
    // CHANNEL_EXPLORER (type: CHANNELS) is auto-tracked server-wide via
    // questProgressService's distinct-channel tracking. COMMUNITY_BUILDER
    // (type: INVITES) is still not auto-tracked — reserved for future
    // invite tracking, kept for flavor.
    // ============================================

    CHANNEL_EXPLORER: {
        id: "CHANNEL_EXPLORER",
        name: "🗺️ Channel Explorer",
        description: "Send messages in 5 different channels",
        type: "CHANNELS",
        goal: 5,
        rewardXP: 300,
        rewardCoins: 750,
        rewardRep: 15,
        category: "exploration",      // NEW
        difficulty: "easy",  // NEW
        emoji: "🗺️"             // NEW
    },

    COMMUNITY_BUILDER: {
        id: "COMMUNITY_BUILDER",
        name: "🤝 Community Builder",
        description: "Invite 3 new members",
        type: "INVITES",
        goal: 3,
        rewardXP: 500,
        rewardCoins: 1000,
        rewardRep: 25,
        category: "community",      // NEW
        difficulty: "medium",  // NEW
        emoji: "🤝"             // NEW
    }

};
