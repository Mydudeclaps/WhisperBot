const cron = require("node-cron");
const config = require("../config/minecraftLeaderboardConfig");
const {
    dateInTimeZone,
    hasPosted,
    postLeaderboards,
    timeInTimeZone
} = require("../services/minecraftLeaderboardService");

class MinecraftLeaderboardBroadcast {
    constructor(client) {
        this.client = client;
        this.retryTimer = null;
        this.start();
    }

    start() {
        cron.schedule(config.CRON_SCHEDULE, () => this.publish("scheduled"), {
            timezone: config.TIME_ZONE
        });
        console.log(`[MinecraftLeaderboards] Armed for 9:00 PM ${config.TIME_ZONE}.`);

        // If Whisperbot starts after 9 PM, post the missed edition once instead
        // of waiting until the following night. The post receipt prevents dupes.
        setTimeout(() => this.catchUp(), 15_000).unref();
    }

    async catchUp(now = new Date()) {
        const localTime = timeInTimeZone(now);
        const postDate = dateInTimeZone(now);
        if (localTime.hour < 21 || hasPosted(postDate)) return;
        await this.publish("startup catch-up", now);
    }

    async publish(reason, now = new Date()) {
        try {
            const result = await postLeaderboards(this.client, { now });
            if (result.skipped) {
                console.log(`[MinecraftLeaderboards] ${result.postDate} already posted; skipping ${reason}.`);
                return;
            }
            console.log(`[MinecraftLeaderboards] Posted ${result.postDate} (${reason}), message ${result.messageId}.`);
        } catch (error) {
            console.error(`[MinecraftLeaderboards] ${reason} failed:`, error);
            if (!this.retryTimer) {
                this.retryTimer = setTimeout(async () => {
                    this.retryTimer = null;
                    await this.publish("five-minute retry");
                }, 5 * 60 * 1000);
                this.retryTimer.unref();
            }
        }
    }
}

module.exports = MinecraftLeaderboardBroadcast;
