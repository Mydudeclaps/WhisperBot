const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { after, test } = require("node:test");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whisperbot-crate-test-"));
process.env.WHISPERBOT_DB_PATH = path.join(tempDirectory, "test.db");

const db = require("../database/database");
const PurchaseManager = require("../shop-engine/engine/PurchaseManager");
const { setCoins, getCoins } = require("../services/coinService");
const { getInventory } = require("../services/inventoryService");
const {
    getKeyBalance,
    grantKeys,
    openCrate
} = require("../services/crateService");

after(() => {
    db.close();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test("key purchase atomically debits coins, grants a key, and records an audit row", async () => {
    setCoins("buyer-1", "BuyerOne", 10000);

    const result = await PurchaseManager.purchase(
        "buyer-1",
        "BuyerOne",
        "discord_crate_key",
        1,
        "global",
        { interactionId: "purchase-1", guildId: "guild-1" }
    );

    assert.equal(result.success, true);
    assert.equal(result.newBalance, 5000);
    assert.equal(getKeyBalance("buyer-1"), 1);

    const audit = db.prepare(
        "SELECT * FROM shop_purchases WHERE interaction_id = ?"
    ).get("purchase-1");
    assert.equal(audit.item_id, "discord_crate_key");
    assert.equal(audit.total_price, 5000);
});

test("a repeated purchase interaction cannot charge or grant twice", async () => {
    setCoins("buyer-2", "BuyerTwo", 15000);

    const options = { interactionId: "purchase-repeat", guildId: "guild-1" };
    const first = await PurchaseManager.purchase(
        "buyer-2", "BuyerTwo", "discord_crate_key", 1, "global", options
    );
    const repeated = await PurchaseManager.purchase(
        "buyer-2", "BuyerTwo", "discord_crate_key", 1, "global", options
    );

    assert.equal(first.success, true);
    assert.equal(repeated.success, false);
    assert.equal(repeated.reason, "already_processed");
    assert.equal(getCoins("buyer-2"), 10000);
    assert.equal(getKeyBalance("buyer-2"), 1);
});

test("insufficient funds leave coins, keys, stock, and audit history unchanged", async () => {
    setCoins("buyer-poor", "BuyerPoor", 4999);

    const result = await PurchaseManager.purchase(
        "buyer-poor",
        "BuyerPoor",
        "discord_crate_key",
        1,
        "global",
        { interactionId: "purchase-poor", guildId: "guild-1" }
    );

    assert.equal(result.success, false);
    assert.equal(result.reason, "insufficient_funds");
    assert.equal(getCoins("buyer-poor"), 4999);
    assert.equal(getKeyBalance("buyer-poor"), 0);
    assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM shop_purchases WHERE interaction_id = ?")
            .get("purchase-poor").count,
        0
    );
});

test("the per-player daily key limit stops a fourth purchase without charging", async () => {
    setCoins("buyer-3", "BuyerThree", 30000);

    for (let index = 1; index <= 3; index += 1) {
        const result = await PurchaseManager.purchase(
            "buyer-3",
            "BuyerThree",
            "discord_crate_key",
            1,
            "global",
            { interactionId: `daily-${index}`, guildId: "guild-1" }
        );
        assert.equal(result.success, true);
    }

    const fourth = await PurchaseManager.purchase(
        "buyer-3",
        "BuyerThree",
        "discord_crate_key",
        1,
        "global",
        { interactionId: "daily-4", guildId: "guild-1" }
    );

    assert.equal(fourth.success, false);
    assert.equal(fourth.reason, "daily_limit");
    assert.equal(getCoins("buyer-3"), 15000);
    assert.equal(getKeyBalance("buyer-3"), 3);
});

test("an out-of-stock purchase rolls back its coin debit", async () => {
    setCoins("buyer-4", "BuyerFour", 30000);

    for (let index = 1; index <= 3; index += 1) {
        const result = await PurchaseManager.purchase(
            "buyer-4",
            "BuyerFour",
            "mystery_box",
            1,
            "isolated-stock",
            { interactionId: `stock-${index}`, guildId: "guild-1" }
        );
        assert.equal(result.success, true);
    }

    const balanceBeforeFailure = getCoins("buyer-4");
    const failed = await PurchaseManager.purchase(
        "buyer-4",
        "BuyerFour",
        "mystery_box",
        1,
        "isolated-stock",
        { interactionId: "stock-4", guildId: "guild-1" }
    );

    assert.equal(failed.success, false);
    assert.equal(failed.reason, "out_of_stock");
    assert.equal(getCoins("buyer-4"), balanceBeforeFailure);
});

test("opening consumes exactly one key and grants the selected coin reward once", () => {
    setCoins("opener-1", "OpenerOne", 0);
    grantKeys("opener-1", "whisper", 2);

    const opening = openCrate({
        userId: "opener-1",
        username: "OpenerOne",
        guildId: "guild-1",
        interactionId: "open-1",
        rng: () => 0
    });

    assert.equal(opening.success, true);
    assert.equal(opening.reward.id, "coins_1000");
    assert.equal(opening.keyBalance, 1);
    assert.equal(getCoins("opener-1"), 1000);

    const repeated = openCrate({
        userId: "opener-1",
        username: "OpenerOne",
        guildId: "guild-1",
        interactionId: "open-1",
        rng: () => 0
    });

    assert.equal(repeated.success, false);
    assert.equal(repeated.reason, "already_processed");
    assert.equal(getKeyBalance("opener-1"), 1);
    assert.equal(getCoins("opener-1"), 1000);
});

test("opening can grant an existing collectible through the shared inventory service", () => {
    grantKeys("opener-2", "whisper", 1);

    const opening = openCrate({
        userId: "opener-2",
        username: "OpenerTwo",
        guildId: "guild-1",
        interactionId: "open-item",
        rng: () => 6000
    });

    assert.equal(opening.success, true);
    assert.equal(opening.reward.id, "ancient_book");

    const item = getInventory("opener-2").find(entry => entry.item === "ancient_book");
    assert.equal(item.amount, 1);
});

test("opening without a key changes neither balance nor audit history", () => {
    setCoins("opener-3", "OpenerThree", 1234);

    const result = openCrate({
        userId: "opener-3",
        username: "OpenerThree",
        guildId: "guild-1",
        interactionId: "open-empty",
        rng: () => 0
    });

    assert.equal(result.success, false);
    assert.equal(result.reason, "no_key");
    assert.equal(getCoins("opener-3"), 1234);
    assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM crate_openings WHERE interaction_id = ?")
            .get("open-empty").count,
        0
    );
});
