const fs = require("fs");
const path = require("path");
const db = require("../../database/database");
const StockManager = require("./StockManager");

const { getUser } = require("../../services/userService");
const { getCoins, addCoins } = require("../../services/coinService");
const { addItem } = require("../../services/inventoryService");

const ITEMS_PATH = path.join(__dirname, "..", "data", "items.json");

// Self-healing migration, same pattern used throughout database/database.js.
db.prepare(`
    CREATE TABLE IF NOT EXISTS shop_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT,
        price INTEGER,
        quantity INTEGER,
        total_price INTEGER,
        purchased_at TEXT
    )
`).run();

const logPurchaseStmt = db.prepare(`
    INSERT INTO shop_purchases (user_id, item_id, item_name, price, quantity, total_price, purchased_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

let itemsCache = null;
function loadItems() {
    if (!itemsCache) {
        itemsCache = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
    }
    return itemsCache;
}

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
    async purchase(userId, username, itemId, quantity = 1, scope = "global") {
        const items = loadItems();
        const item = items[itemId];
        if (!item || item.active === false) {
            return { success: false, reason: "not_found" };
        }
        if (quantity < 1) {
            return { success: false, reason: "invalid_quantity" };
        }

        // Ensures a users row exists (and username is up to date) before we
        // touch coins — mirrors how every other command in the bot works.
        getUser(userId, username);

        const totalPrice = item.price * quantity;

        // 1. Check funds first (no side effects yet).
        const balance = getCoins(userId);
        if (balance < totalPrice) {
            return { success: false, reason: "insufficient_funds", balance, totalPrice };
        }

        // 2. Reserve stock. Nothing has been charged yet if this fails.
        const stockOk = StockManager.decrement(itemId, quantity, scope);
        if (!stockOk) {
            return { success: false, reason: "out_of_stock" };
        }

        // 3. Charge the player. Roll back the stock reservation on failure.
        let newBalance;
        try {
            newBalance = addCoins(userId, username, -totalPrice);
        } catch (err) {
            StockManager.decrement(itemId, -quantity, scope); // refund stock
            return { success: false, reason: "payment_failed", error: err.message };
        }

        // 4. Grant the item. Roll back coins and stock on failure.
        try {
            addItem(userId, item.id, quantity);
        } catch (err) {
            addCoins(userId, username, totalPrice); // refund coins
            StockManager.decrement(itemId, -quantity, scope); // refund stock
            return { success: false, reason: "inventory_failed", error: err.message };
        }

        logPurchaseStmt.run(
            userId,
            itemId,
            item.name,
            item.price,
            quantity,
            totalPrice,
            new Date().toISOString()
        );

        return { success: true, item, quantity, price: item.price, totalPrice, newBalance };
    }
}

module.exports = new PurchaseManager();
