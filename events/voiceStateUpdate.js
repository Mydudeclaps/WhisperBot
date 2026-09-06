const {
    giveVoiceXP
} = require("../services/voiceXPService");

const {
    incrementStat
} = require("../services/statsService");

const {
    updateMissionProgress
} = require("../services/dailyProgressService");

const {
    updateQuestProgress
} = require("../services/questProgressService");

// Store when a user joined voice
const voiceSessions = new Map();
// Store interval timers for XP
const xpTimers = new Map();
// Store interval timers for mission progress
const missionTimers = new Map();

// How often to update (in milliseconds)
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const XP_INTERVAL = 5 * 60 * 1000;     // 5 minutes

async function recordVoiceProgress(userId, minutes, channel) {
    try {
        incrementStat(userId, "voice_minutes", minutes);
    } catch (error) {
        console.error(`Voice stat update failed for ${userId}:`, error);
    }

    try {
        await updateMissionProgress(
            userId,
            "voice_minutes",
            minutes,
            channel
        );
    } catch (error) {
        console.error(`Voice mission update failed for ${userId}:`, error);
    }

    try {
        updateQuestProgress(
            userId,
            "VOICE_MINUTES",
            minutes
        );
    } catch (error) {
        console.error(`Voice quest update failed for ${userId}:`, error);
    }
}

module.exports = {
    name: "voiceStateUpdate",

    execute(oldState, newState) {
        const member = newState.member || oldState.member;
        if (!member) return;
        const userId = member.id;

        // ============================================
        // User JOINED voice
        // ============================================
        if (!oldState.channel && newState.channel) {
            console.log(`🎙️ ${member.user.username} joined voice`);

            // Store join time
            voiceSessions.set(userId, Date.now());

            // Start XP timer (every 5 minutes)
            const xpTimer = setInterval(() => {
                try {
                    const result = giveVoiceXP(member);
                    if (result && result.leveledUp) {
                        console.log(`⭐ ${member.user.username} leveled up from voice!`);
                    }
                } catch (error) {
                    console.error(`Voice XP update failed for ${userId}:`, error);
                }
            }, XP_INTERVAL);
            xpTimers.set(userId, xpTimer);

            // Start mission progress timer (every 5 minutes)
            const missionTimer = setInterval(() => {
                const startTime = voiceSessions.get(userId);
                if (!startTime) return;

                // Calculate total minutes since they joined
                const totalMinutes = Math.floor((Date.now() - startTime) / 60000);
                
                // Get how many minutes we've already counted
                const lastCounted = missionTimers.get(`${userId}_counted`) || 0;
                
                // Count new minutes since last update
                const newMinutes = totalMinutes - lastCounted;
                
                if (newMinutes >= 1) {
                    // Only log if it's a significant update (5 minutes or more)
                    // This will naturally only log every 5 minutes now!
                    console.log(`🎙️ ${member.user.username} voice time: +${newMinutes} minutes`);
                    
                    // Advance the cursor before starting asynchronous work so
                    // a slow Discord send cannot make the next tick award the
                    // same minutes twice.
                    missionTimers.set(`${userId}_counted`, totalMinutes);
                    void recordVoiceProgress(
                        userId,
                        newMinutes,
                        newState.channel
                    );
                }
            }, UPDATE_INTERVAL); // 5 minutes
            
            missionTimers.set(userId, missionTimer);

            // Reset counted minutes for this session
            missionTimers.set(`${userId}_counted`, 0);
        }

        // ============================================
        // User LEFT voice
        // ============================================
        if (oldState.channel && !newState.channel) {
            console.log(`🎙️ ${member.user.username} left voice`);

            // Calculate final minutes
            const startTime = voiceSessions.get(userId);
            if (startTime) {
                const totalMinutes = Math.floor((Date.now() - startTime) / 60000);
                const lastCounted = missionTimers.get(`${userId}_counted`) || 0;
                const finalMinutes = totalMinutes - lastCounted;

                if (finalMinutes > 0) {
                    console.log(`🎙️ ${member.user.username} final voice time: +${finalMinutes} minutes`);
                    
                    void recordVoiceProgress(
                        userId,
                        finalMinutes,
                        oldState.channel
                    );
                }

                voiceSessions.delete(userId);
            }

            // Clear XP timer
            const xpTimer = xpTimers.get(userId);
            if (xpTimer) {
                clearInterval(xpTimer);
                xpTimers.delete(userId);
            }

            // Clear mission timer
            const missionTimer = missionTimers.get(userId);
            if (missionTimer) {
                clearInterval(missionTimer);
                missionTimers.delete(userId);
            }

            // Clean up counted minutes
            missionTimers.delete(`${userId}_counted`);
        }

        // ============================================
        // User MOVED channels
        // ============================================
        if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            console.log(`🎙️ ${member.user.username} moved channels`);
            // Keep the session going - timers stay active
        }
    }
};

module.exports.recordVoiceProgress = recordVoiceProgress;
