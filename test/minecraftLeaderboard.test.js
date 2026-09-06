const test = require("node:test");
const assert = require("node:assert/strict");

process.env.WHISPERBOT_DB_PATH = ":memory:";

const {
    combineMinecraftData,
    dateInTimeZone,
    deltaText,
    timeInTimeZone
} = require("../services/minecraftLeaderboardService");

test("wealth combines Wego wallet cents with eBank dollars and sorts descending", () => {
    const data = combineMinecraftData({
        accounts: [
            { player_uuid: "a-b", balance_cents: 10_000 },
            { player_uuid: "c-d", balance_cents: 20_000 }
        ],
        profiles: [
            { player_uuid: "ab", username: "Alex", mobs_killed: 7 },
            { player_uuid: "cd", username: "Casey", mobs_killed: 20 }
        ],
        sellers: [
            { player_uuid: "ab", proceeds_cents: 50_000 },
            { player_uuid: "cd", proceeds_cents: 25_000 }
        ],
        bankRows: [
            { player_uuid: "ab", username: "OldAlex", balance: 500 },
            { player_uuid: "cd", username: "Casey", balance: 1 }
        ]
    });

    assert.deepEqual(data.wealth.map(row => [row.username, row.value]), [
        ["Alex", 60_000],
        ["Casey", 20_100]
    ]);
    assert.deepEqual(data.mobs.map(row => row.username), ["Casey", "Alex"]);
    assert.deepEqual(data.sell.map(row => row.username), ["Alex", "Casey"]);
});

test("Eastern date and time honor daylight saving time", () => {
    const instant = new Date("2026-08-28T01:05:00.000Z");
    assert.equal(dateInTimeZone(instant), "2026-08-27");
    assert.deepEqual(timeInTimeZone(instant), { hour: 21, minute: 5 });
});

test("daily movement formatting distinguishes gains, losses, zero, and baseline", () => {
    assert.equal(deltaText(125_50, true), "  •  ▲ $125.50 today");
    assert.equal(deltaText(-4, false), "  •  ▼ 4 today");
    assert.equal(deltaText(0, false), "  •  — today");
    assert.equal(deltaText(null, false), "");
});
