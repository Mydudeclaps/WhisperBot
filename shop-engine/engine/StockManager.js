const fs = require("fs");
const path = require("path");
const db = require("../../database/database");

const ITEMS_PATH = path.join(__dirname, "..", "data", "items.json");

// Self-healing migration, same pattern used throughout database/database.js:
// safe to run on every boot, only creates the table the first time.
db.prepare(`
    CREATE TABLE IF NOT EXISTS shop_stock (
        item_id TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'global',
        current_stock INTEGER NOT NULL,
        last_restock INTEGER NOT NULL,
        PRIMARY KEY (item_id, scope)
    )
`).run();

const getStmt = db.prepare(
    "SELECT * FROM shop_stock WHERE item_id = ? AND scope = ?"
);
const insertStmt = db.prepare(`
    INSERT INTO shop_stock (item_id, scope, current_stock, last_restock)
    VALUES (?, ?, ?, ?)
`);
const updateStmt = db.prepare(`
    UPDATE shop_stock
    SET current_stock = ?, last_restock = ?
    WHERE item_id = ? AND scope = ?
`);

let itemsCache = null;
function loadItems() {
    if (!itemsCache) {
        itemsCache = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
    }
    return itemsCache;
}

/**
 * StockManager
 * Tracks shared stock levels for every shop item and auto-restocks based
 * on each item's `restock_time` (seconds). Stock is stored in the same
 * SQLite database WhisperBot already uses for everything else, keyed by
 * `scope` (defaults to a single 'global' pool shared across the whole
 * bot — pass a guild ID here instead if you want per-server stock).
 */
class StockManager {
    // Ensures a row exists for item/scope and applies any restock ticks
    // that should have happened since it was last checked. Returns the
    // live row: { item_id, scope, current_stock, last_restock }
    _resolve(itemId, scope = "global") {
        const items = loadItems();
        const item = items[itemId];
        if (!item) throw new Error(`Unknown shop item: ${itemId}`);

        let row = getStmt.get(itemId, scope);
        const now = Date.now();

        if (!row) {
            row = { item_id: itemId, scope, current_stock: item.max_stock, last_restock: now };
            insertStmt.run(itemId, scope, row.current_stock, row.last_restock);
            return row;
        }

        if (row.current_stock < item.max_stock && item.restock_time > 0) {
            const elapsedSec = (now - row.last_restock) / 1000;
            const ticks = Math.floor(elapsedSec / item.restock_time);

            if (ticks > 0) {
                row.current_stock = Math.min(item.max_stock, row.current_stock + ticks);
                row.last_restock = row.last_restock + ticks * item.restock_time * 1000;
                updateStmt.run(row.current_stock, row.last_restock, itemId, scope);
            }
        } else if (row.current_stock >= item.max_stock) {
            row.last_restock = now;
            updateStmt.run(row.current_stock, row.last_restock, itemId, scope);
        }

        return row;
    }

    getStock(itemId, scope = "global") {
        const items = loadItems();
        const item = items[itemId];
        const row = this._resolve(itemId, scope);

        let secondsUntilRestock = null;
        if (row.current_stock < item.max_stock && item.restock_time > 0) {
            const elapsedSec = (Date.now() - row.last_restock) / 1000;
            secondsUntilRestock = Math.max(0, Math.ceil(item.restock_time - elapsedSec));
        }

        return {
            itemId,
            current_stock: row.current_stock,
            max_stock: item.max_stock,
            secondsUntilRestock
        };
    }

    /**
     * Attempt to remove `quantity` units from stock (or add them back if
     * quantity is negative, used for rollbacks). Returns true on success,
     * false if there isn't enough stock to remove.
     */
    decrement(itemId, quantity = 1, scope = "global") {
        const items = loadItems();
        const item = items[itemId];
        const row = this._resolve(itemId, scope);

        if (row.current_stock < quantity) return false;

        const next = Math.max(0, Math.min(item.max_stock, row.current_stock - quantity));
        updateStmt.run(next, row.last_restock, itemId, scope);
        return true;
    }

    forceRestock(itemId, scope = "global") {
        const items = loadItems();
        const item = items[itemId];
        if (!item) throw new Error(`Unknown shop item: ${itemId}`);

        const row = getStmt.get(itemId, scope);
        if (row) {
            updateStmt.run(item.max_stock, Date.now(), itemId, scope);
        } else {
            insertStmt.run(itemId, scope, item.max_stock, Date.now());
        }
    }
}

module.exports = new StockManager();
