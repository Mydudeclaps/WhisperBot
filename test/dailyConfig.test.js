const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const configPath = path.resolve(__dirname, "../config/dailyConfig.js");

function loadConfig(value) {
    const previous = process.env.DAILY_STREAK_GRACE_HOURS;

    if (value === undefined) {
        delete process.env.DAILY_STREAK_GRACE_HOURS;
    } else {
        process.env.DAILY_STREAK_GRACE_HOURS = value;
    }

    delete require.cache[configPath];
    const config = require(configPath);

    if (previous === undefined) {
        delete process.env.DAILY_STREAK_GRACE_HOURS;
    } else {
        process.env.DAILY_STREAK_GRACE_HOURS = previous;
    }
    delete require.cache[configPath];

    return config;
}

test("daily streak grace defaults to zero", () => {
    assert.equal(loadConfig(undefined).GRACE_PERIOD_HOURS, 0);
});

test("daily streak grace accepts a non-negative environment value", () => {
    assert.equal(loadConfig("24").GRACE_PERIOD_HOURS, 24);
});

test("daily streak grace rejects invalid environment values", () => {
    assert.equal(loadConfig("-1").GRACE_PERIOD_HOURS, 0);
    assert.equal(loadConfig("not-a-number").GRACE_PERIOD_HOURS, 0);
});
