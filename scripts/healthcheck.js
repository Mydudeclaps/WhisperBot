const fs = require("fs");
const os = require("os");
const path = require("path");

const healthPath = process.env.WHISPERBOT_HEALTH_PATH ||
    path.join(os.tmpdir(), "whisperbot-health.json");

try {
    const health = JSON.parse(fs.readFileSync(healthPath, "utf8"));
    const heartbeatAge = Date.now() - Date.parse(health.heartbeatAt);

    if (health.status !== "ready" || !Number.isFinite(heartbeatAge) || heartbeatAge > 90000) {
        process.exit(1);
    }

    process.exit(0);
} catch (error) {
    process.exit(1);
}
