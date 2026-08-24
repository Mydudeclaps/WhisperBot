const fs = require("fs");
const { createHmac, randomUUID } = require("crypto");

const db = require("../database/database");
const { getKeyBalance } = require("./crateService");

const getPendingStmt = db.prepare(`
    SELECT * FROM minecraft_crate_deliveries
    WHERE user_id = ? AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
`);
const getByInteractionStmt = db.prepare(`
    SELECT * FROM minecraft_crate_deliveries WHERE interaction_id = ?
`);
const consumeKeyStmt = db.prepare(`
    UPDATE crate_key_balances
    SET quantity = quantity - 1, updated_at = ?
    WHERE user_id = ? AND key_type = 'whisper' AND quantity > 0
`);
const restoreKeyStmt = db.prepare(`
    INSERT INTO crate_key_balances (user_id, key_type, quantity, updated_at)
    VALUES (?, 'whisper', 1, ?)
    ON CONFLICT(user_id, key_type) DO UPDATE SET
        quantity = quantity + 1,
        updated_at = excluded.updated_at
`);
const insertDeliveryStmt = db.prepare(`
    INSERT INTO minecraft_crate_deliveries (
        order_id, interaction_id, guild_id, user_id, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
`);
const completeDeliveryStmt = db.prepare(`
    UPDATE minecraft_crate_deliveries
    SET status = 'delivered', receipt_json = ?, last_error = NULL, updated_at = ?
    WHERE order_id = ? AND status = 'pending'
`);
const failDeliveryStmt = db.prepare(`
    UPDATE minecraft_crate_deliveries
    SET status = 'failed', last_error = ?, updated_at = ?
    WHERE order_id = ? AND status = 'pending'
`);

function readSecret() {
    const direct = process.env.WEGO_DISCORD_CRATE_SECRET?.trim();
    if (direct) return direct;
    const file = process.env.WEGO_DISCORD_CRATE_SECRET_FILE?.trim();
    if (!file) return "";
    try {
        return fs.readFileSync(file, "utf8").trim();
    } catch {
        return "";
    }
}

function bridgeConfig() {
    const url = process.env.WEGO_DISCORD_CRATE_URL?.trim() || "";
    const secret = readSecret();
    if (!url || !/^https:\/\//.test(url) || secret.length < 32) return null;
    return { url, secret };
}

const reserveDelivery = db.transaction(({ userId, guildId, interactionId }) => {
    const byInteraction = getByInteractionStmt.get(interactionId);
    if (byInteraction) return { delivery: byInteraction, reused: true };

    const pending = getPendingStmt.get(userId);
    if (pending) return { delivery: pending, reused: true };

    const now = new Date().toISOString();
    if (consumeKeyStmt.run(now, userId).changes !== 1) {
        return { delivery: null, reason: "no_key" };
    }

    const orderId = randomUUID();
    insertDeliveryStmt.run(orderId, interactionId, guildId || null, userId, now, now);
    return { delivery: getByInteractionStmt.get(interactionId), reused: false };
});

const refundDelivery = db.transaction((delivery, error) => {
    const now = new Date().toISOString();
    if (failDeliveryStmt.run(error.slice(0, 500), now, delivery.order_id).changes === 1) {
        restoreKeyStmt.run(delivery.user_id, now);
    }
});

async function requestDelivery(config, delivery) {
    const rawBody = JSON.stringify({
        orderId: delivery.order_id,
        discordUserId: delivery.user_id
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", config.secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");
    return fetch(config.url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-whisperbot-timestamp": timestamp,
            "x-whisperbot-signature": signature
        },
        body: rawBody,
        signal: AbortSignal.timeout(100000)
    });
}

async function deliverMinecraftCrateKey({ userId, guildId = null, interactionId }) {
    const config = bridgeConfig();
    if (!config) {
        return { success: false, reason: "bridge_unavailable", keyBalance: getKeyBalance(userId) };
    }

    const reserved = reserveDelivery({ userId, guildId, interactionId });
    if (!reserved.delivery) {
        return { success: false, reason: reserved.reason, keyBalance: getKeyBalance(userId) };
    }
    if (reserved.delivery.status === "delivered") {
        return {
            success: true,
            replayed: true,
            receipt: JSON.parse(reserved.delivery.receipt_json),
            keyBalance: getKeyBalance(userId)
        };
    }

    try {
        const response = await requestDelivery(config, reserved.delivery);
        const body = await response.json().catch(() => ({}));
        if (response.ok && body.ok && body.result?.receipt) {
            completeDeliveryStmt.run(
                JSON.stringify(body.result.receipt),
                new Date().toISOString(),
                reserved.delivery.order_id
            );
            return {
                success: true,
                replayed: Boolean(body.result.replayed),
                receipt: body.result.receipt,
                keyBalance: getKeyBalance(userId)
            };
        }

        if (response.status === 409 && body.code === "minecraft_link_required") {
            refundDelivery(reserved.delivery, "minecraft_link_required");
            return { success: false, reason: "minecraft_link_required", keyBalance: getKeyBalance(userId) };
        }
        if ([400, 401, 403, 404].includes(response.status)) {
            refundDelivery(reserved.delivery, `bridge_rejected_${response.status}`);
            return { success: false, reason: "bridge_unavailable", keyBalance: getKeyBalance(userId) };
        }
        return { success: false, reason: "delivery_pending", keyBalance: getKeyBalance(userId) };
    } catch (error) {
        console.error("[minecraft-crate] delivery pending:", error.message);
        return { success: false, reason: "delivery_pending", keyBalance: getKeyBalance(userId) };
    }
}

module.exports = {
    bridgeConfig,
    deliverMinecraftCrateKey
};
