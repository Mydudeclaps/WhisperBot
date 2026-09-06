const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
    isDiscordReady,
    markReady,
    markStopping
} = require("../services/runtimeHealthService");

test("health reports Discord ready only when the client is ready", () => {
    assert.equal(isDiscordReady({ isReady: () => true }), true);
    assert.equal(isDiscordReady({ isReady: () => false }), false);
    assert.equal(isDiscordReady(null), false);
});

test("health treats client readiness errors as disconnected", () => {
    assert.equal(isDiscordReady({
        isReady() {
            throw new Error("gateway unavailable");
        }
    }), false);
});

test("container health check rejects a stale Discord gateway", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whisperbot-health-"));
    const healthPath = path.join(directory, "health.json");
    const scriptPath = path.resolve(__dirname, "../scripts/healthcheck.js");

    fs.writeFileSync(healthPath, JSON.stringify({
        status: "disconnected",
        discordReady: false,
        heartbeatAt: new Date().toISOString()
    }));

    const disconnected = spawnSync(process.execPath, [scriptPath], {
        env: { ...process.env, WHISPERBOT_HEALTH_PATH: healthPath }
    });
    assert.equal(disconnected.status, 1);

    fs.writeFileSync(healthPath, JSON.stringify({
        status: "ready",
        discordReady: true,
        heartbeatAt: new Date().toISOString()
    }));

    const ready = spawnSync(process.execPath, [scriptPath], {
        env: { ...process.env, WHISPERBOT_HEALTH_PATH: healthPath }
    });
    assert.equal(ready.status, 0);

    fs.rmSync(directory, { recursive: true, force: true });
});

test("gateway watchdog invokes recovery after a sustained disconnect", async () => {
    let recoveryCalls = 0;
    const fakeClient = {
        isReady: () => false,
        ws: { status: 5 },
        guilds: { cache: new Map() }
    };

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("gateway watchdog did not invoke recovery"));
        }, 250);

        markReady({
            client: fakeClient,
            botTag: "WhisperBot#test",
            guildCount: 0,
            heartbeatIntervalMs: 5,
            gatewayFailureGraceMs: 10,
            onGatewayFailure: () => {
                recoveryCalls += 1;
                clearTimeout(timeout);
                resolve();
            }
        });
    });

    markStopping();
    assert.equal(recoveryCalls, 1);
});
