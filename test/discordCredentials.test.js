const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { afterEach, test } = require("node:test");

const { loadDiscordToken } = require("../config/discordCredentials");

const originalToken = process.env.DISCORD_TOKEN;
const originalTokenFile = process.env.DISCORD_TOKEN_FILE;
const temporaryDirectories = [];

afterEach(() => {
    if (originalToken === undefined) delete process.env.DISCORD_TOKEN;
    else process.env.DISCORD_TOKEN = originalToken;

    if (originalTokenFile === undefined) delete process.env.DISCORD_TOKEN_FILE;
    else process.env.DISCORD_TOKEN_FILE = originalTokenFile;

    while (temporaryDirectories.length > 0) {
        fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
    }
});

test("a direct token takes precedence", () => {
    process.env.DISCORD_TOKEN = "direct-test-token";
    process.env.DISCORD_TOKEN_FILE = "/does/not/exist";
    assert.equal(loadDiscordToken(), "direct-test-token");
});

test("a one-line Docker secret token is loaded without changing the environment", () => {
    delete process.env.DISCORD_TOKEN;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whisperbot-secret-test-"));
    temporaryDirectories.push(directory);
    const tokenFile = path.join(directory, "discord_token");
    fs.writeFileSync(tokenFile, "file-test-token\n", { mode: 0o600 });
    process.env.DISCORD_TOKEN_FILE = tokenFile;

    assert.equal(loadDiscordToken(), "file-test-token");
    assert.equal(process.env.DISCORD_TOKEN, undefined);
});

test("a token file with multiple values is rejected", () => {
    delete process.env.DISCORD_TOKEN;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whisperbot-secret-test-"));
    temporaryDirectories.push(directory);
    const tokenFile = path.join(directory, "discord_token");
    fs.writeFileSync(tokenFile, "first\nsecond\n", { mode: 0o600 });
    process.env.DISCORD_TOKEN_FILE = tokenFile;

    assert.throws(() => loadDiscordToken(), /exactly one non-empty line/);
});
