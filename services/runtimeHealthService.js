const fs = require("fs");
const os = require("os");
const path = require("path");

const healthPath = process.env.WHISPERBOT_HEALTH_PATH ||
    path.join(os.tmpdir(), "whisperbot-health.json");
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
const DEFAULT_GATEWAY_FAILURE_GRACE_MS = 180000;

let heartbeatTimer = null;
let discordClient = null;
let disconnectedAt = null;
let gatewayFailureHandled = false;
let gatewayFailureGraceMs = DEFAULT_GATEWAY_FAILURE_GRACE_MS;
let onGatewayFailure = null;
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
    writeState({ status: "starting", discordReady: false });
}

function isDiscordReady(client = discordClient) {
    try {
        return Boolean(client && client.isReady());
    } catch (error) {
        return false;
    }
}

function refreshState() {
    const discordReady = isDiscordReady();
    const now = Date.now();

    if (discordReady) {
        disconnectedAt = null;
        gatewayFailureHandled = false;
    } else if (disconnectedAt === null) {
        disconnectedAt = now;
    }

    const disconnectedForMs = disconnectedAt === null
        ? 0
        : now - disconnectedAt;

    writeState({
        status: discordReady ? "ready" : "disconnected",
        discordReady,
        gatewayStatus: discordClient?.ws?.status ?? null,
        guildCount: discordReady ? discordClient.guilds.cache.size : 0,
        disconnectedAt: disconnectedAt === null
            ? null
            : new Date(disconnectedAt).toISOString(),
        disconnectedForMs
    });

    if (
        !discordReady &&
        disconnectedForMs >= gatewayFailureGraceMs &&
        !gatewayFailureHandled &&
        onGatewayFailure
    ) {
        gatewayFailureHandled = true;
        onGatewayFailure({ disconnectedForMs });
    }
}

function markReady({
    client,
    botTag,
    guildCount,
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
    gatewayFailureGraceMs: failureGraceMs = DEFAULT_GATEWAY_FAILURE_GRACE_MS,
    onGatewayFailure: failureHandler = null
}) {
    discordClient = client;
    disconnectedAt = null;
    gatewayFailureHandled = false;
    gatewayFailureGraceMs = failureGraceMs;
    onGatewayFailure = failureHandler;
    writeState({
        status: isDiscordReady() ? "ready" : "disconnected",
        discordReady: isDiscordReady(),
        gatewayStatus: discordClient?.ws?.status ?? null,
        botTag,
        guildCount
    });

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(refreshState, heartbeatIntervalMs);
    heartbeatTimer.unref();
}

function markStopping() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    discordClient = null;
    disconnectedAt = null;
    gatewayFailureHandled = false;
    onGatewayFailure = null;
    writeState({ status: "stopping", discordReady: false });
}

module.exports = {
    healthPath,
    isDiscordReady,
    markStarting,
    markReady,
    markStopping
};
