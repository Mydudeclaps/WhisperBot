const fs = require("fs");
const os = require("os");
const path = require("path");

const healthPath = process.env.WHISPERBOT_HEALTH_PATH ||
    path.join(os.tmpdir(), "whisperbot-health.json");

let heartbeatTimer = null;
let state = {
    status: "starting",
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString()
};

function writeState(nextState = {}) {
    state = {
        ...state,
        ...nextState,
        heartbeatAt: new Date().toISOString()
    };

    const tempPath = `${healthPath}.tmp`;
    fs.mkdirSync(path.dirname(healthPath), { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(state));
    fs.renameSync(tempPath, healthPath);
}

function markStarting() {
    writeState({ status: "starting" });
}

function markReady({ botTag, guildCount }) {
    writeState({ status: "ready", botTag, guildCount });

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => writeState(), 30000);
    heartbeatTimer.unref();
}

function markStopping() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    writeState({ status: "stopping" });
}

module.exports = {
    healthPath,
    markStarting,
    markReady,
    markStopping
};
