const fs = require("fs");
const path = require("path");
const db = require("../../database/database");
const StockManager = require("./StockManager");

const { getUser } = require("../../services/userService");
const { getCoins } = require("../../services/coinService");
const { addItem } = require("../../services/inventoryService");
const { grantKeys } = require("../../services/crateService");

const ITEMS_PATH = path.join(__dirname, "..", "data", "items.json");

const logPurchaseStmt = db.prepare(`
    INSERT INTO shop_purchases (
        interaction_id, guild_id, user_id, item_id, item_name,
        price, quantity, total_price, purchased_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getPurchaseByInteractionStmt = db.prepare(`
    SELECT id
    FROM shop_purchases
    WHERE interaction_id = ?
`);

const getDailyPurchaseCountStmt = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS quantity
    FROM shop_purchases
    WHERE user_id = ? AND item_id = ? AND purchased_at >= ? AND purchased_at < ?
`);

const chargeCoinsStmt = db.prepare(`
    UPDATE users
    SET coins = coins - ?
    WHERE id = ? AND coins >= ?
`);

let itemsCache = null;
function loadItems() {
    if (!itemsCache) {
        itemsCache = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
    }
    return itemsCache;
}

class PurchaseFailure extends Error {
    constructor(reason, details = {}) {
        super(reason);
        this.reason = reason;
        this.details = details;
    }
}

function utcDayBounds(now = new Date()) {
    const start = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
    ));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
}

const executePurchase = db.transaction(({
    userId,
    username,
    item,
    quantity,
    totalPrice,
    scope,
    interactionId,
    guildId
}) => {
    if (interactionId && getPurchaseByInteractionStmt.get(interactionId)) {
        throw new PurchaseFailure("already_processed");
    }

    getUser(userId, username);

    const dailyLimit = item.metadata?.daily_limit;
    if (Number.isSafeInteger(dailyLimit) && dailyLimit > 0) {
        const { start, end } = utcDayBounds();
        const purchasedToday = getDailyPurchaseCountStmt.get(
            userId,
            item.id,
            start,
            end
        ).quantity;

        if (purchasedToday + quantity > dailyLimit) {
            throw new PurchaseFailure("daily_limit", {
                dailyLimit,
                purchasedToday
            });
        }
    }

    const charged = chargeCoinsStmt.run(totalPrice, userId, totalPrice);
    if (charged.changes !== 1) {
        const balance = getCoins(userId);
        throw new PurchaseFailure("insufficient_funds", { balance, totalPrice });
    }

    if (!item.unlimited_stock && !StockManager.decrement(item.id, quantity, scope)) {
        throw new PurchaseFailure("out_of_stock");
    }

    if (item.metadata?.grant_type === "crate_key") {
        grantKeys(userId, item.metadata.key_type, quantity);
    } else {
        addItem(userId, item.id, quantity);
    }

    const purchasedAt = new Date().toISOString();
    logPurchaseStmt.run(
        interactionId || null,
        guildId || null,
        userId,
        item.id,
        item.name,
        item.price,
        quantity,
        totalPrice,
        purchasedAt
    );

    return {
        success: true,
        item,
        quantity,
        price: item.price,
        totalPrice,
        newBalance: getCoins(userId)
    };
});

/**
 * PurchaseManager
 * Validates and executes a marketplace purchase against WhisperBot's real
 * coin balance (services/coinService) and inventory (services/inventoryService).
 */
class PurchaseManager {
    /**
     * Attempt to purchase `quantity` of `itemId` for `userId`.
     * Returns { success: true, item, quantity, price, totalPrice, newBalance }
     * or { success: false, reason }. Never throws for expected failure cases
     * (insufficient funds, out of stock, unknown item).
     */
    async purchase(
        userId,
        username,
        itemId,
        quantity = 1,
        scope = "global",
        options = {}
    ) {
        const items = loadItems();
        const item = items[itemId];
        if (!item || item.active === false) {
            return { success: false, reason: "not_found" };
        }
        if (!Number.isSafeInteger(quantity) || quantity < 1) {
            return { success: false, reason: "invalid_quantity" };
        }

        const totalPrice = item.price * quantity;
        if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
            return { success: false, reason: "invalid_price" };
        }

        try {
            return executePurchase({
                userId,
                username,
                item,
                quantity,
                totalPrice,
                scope,
                interactionId: options.interactionId || null,
                guildId: options.guildId || null
            });
        } catch (error) {
            if (error instanceof PurchaseFailure) {
                return { success: false, reason: error.reason, ...error.details };
            }

            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return { success: false, reason: "already_processed" };
            }

            return { success: false, reason: "transaction_failed", error: error.message };
        }
    }
}

module.exports = new PurchaseManager();
