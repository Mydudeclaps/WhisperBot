const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { after, test } = require("node:test");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whisperbot-crate-test-"));
process.env.WHISPERBOT_DB_PATH = path.join(tempDirectory, "test.db");
process.env.WEGO_DISCORD_CRATE_URL = "https://wego.test/api/internal/whisperbot/crate-key";
process.env.WEGO_DISCORD_CRATE_SECRET = "test-secret-that-is-at-least-32-bytes-long";

const db = require("../database/database");
const PurchaseManager = require("../shop-engine/engine/PurchaseManager");
const { setCoins, getCoins } = require("../services/coinService");
const {
    getKeyBalance,
    grantKeys
} = require("../services/crateService");
const { deliverMinecraftCrateKey } = require("../services/minecraftCrateDeliveryService");
const handleCrateButton = require("../utils/crateInteractionHandler");

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

test("delivery consumes one Discord key only after reserving an idempotent Minecraft order", async () => {
    grantKeys("opener-1", "whisper", 2);
    let requestBody;
    global.fetch = async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
            ok: true,
            result: {
                replayed: false,
                receipt: {
                    orderId: requestBody.orderId,
                    discordUserId: "opener-1",
                    minecraftUsername: "OpenerOne",
                    resultingBalance: 1
                }
            }
        }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const delivery = await deliverMinecraftCrateKey({
        userId: "opener-1",
        guildId: "guild-1",
        interactionId: "open-1"
    });
    assert.equal(delivery.success, true);
    assert.equal(getKeyBalance("opener-1"), 1);
    assert.match(requestBody.orderId, /^[0-9a-f-]{36}$/);
    assert.equal(
        db.prepare("SELECT status FROM minecraft_crate_deliveries WHERE order_id = ?")
            .get(requestBody.orderId).status,
        "delivered"
    );
});

test("an ambiguous bridge failure keeps one reserved order and retries its same UUID", async () => {
    grantKeys("opener-2", "whisper", 1);
    global.fetch = async () => { throw new Error("network timeout"); };
    const pending = await deliverMinecraftCrateKey({
        userId: "opener-2",
        guildId: "guild-1",
        interactionId: "pending-1"
    });
    assert.equal(pending.reason, "delivery_pending");
    assert.equal(getKeyBalance("opener-2"), 0);
    const orderId = db.prepare("SELECT order_id FROM minecraft_crate_deliveries WHERE user_id = ?")
        .get("opener-2").order_id;

    global.fetch = async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(body.orderId, orderId);
        return new Response(JSON.stringify({
            ok: true,
            result: {
                replayed: false,
                receipt: {
                    orderId,
                    discordUserId: "opener-2",
                    minecraftUsername: "OpenerTwo",
                    resultingBalance: 1
                }
            }
        }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const completed = await deliverMinecraftCrateKey({
        userId: "opener-2",
        guildId: "guild-1",
        interactionId: "pending-2"
    });
    assert.equal(completed.success, true);
});

test("an unlinked Minecraft account receives its Discord key back", async () => {
    grantKeys("opener-3", "whisper", 1);
    global.fetch = async () => new Response(JSON.stringify({
        code: "minecraft_link_required"
    }), { status: 409, headers: { "content-type": "application/json" } });
    const result = await deliverMinecraftCrateKey({
        userId: "opener-3",
        guildId: "guild-1",
        interactionId: "unlinked-1"
    });
    assert.equal(result.success, false);
    assert.equal(result.reason, "minecraft_link_required");
    assert.equal(getKeyBalance("opener-3"), 1);
    assert.equal(
        db.prepare("SELECT status FROM minecraft_crate_deliveries WHERE interaction_id = ?")
            .get("unlinked-1").status,
        "failed"
    );
});

test("the crate button sends its key to Minecraft instead of opening a legacy local reward", async () => {
    grantKeys("button-opener", "whisper", 1);
    let requestBody;
    global.fetch = async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
            ok: true,
            result: {
                replayed: false,
                receipt: {
                    orderId: requestBody.orderId,
                    discordUserId: "button-opener",
                    minecraftUsername: "ButtonOpener",
                    crateId: "discord",
                    keyAmount: 1,
                    resultingBalance: 4
                }
            }
        }), { status: 200, headers: { "content-type": "application/json" } });
    };

    let editedReply;
    const interaction = {
        customId: "crate_open:button-opener",
        user: { id: "button-opener", username: "ButtonOpener" },
        guildId: "guild-1",
        id: "button-open-1",
        deferUpdate: async () => {},
        editReply: async payload => { editedReply = payload; }
    };

    await handleCrateButton(interaction);

    assert.equal(getKeyBalance("button-opener"), 0);
    assert.equal(requestBody.discordUserId, "button-opener");
    assert.equal(
        db.prepare("SELECT status FROM minecraft_crate_deliveries WHERE interaction_id = ?")
            .get("button-open-1").status,
        "delivered"
    );
    assert.equal(editedReply.embeds[0].data.title, "✅ Minecraft Crate Key Delivered!");
});

test("the published Minecraft crate has exactly 20 rewards totaling 100 percent", () => {
    const crate = require("../config/crateConfig").getCrate("whisper");
    assert.equal(crate.rewards.length, 20);
    assert.equal(crate.rewards.reduce((sum, reward) => sum + reward.weight, 0), 10000);
});
