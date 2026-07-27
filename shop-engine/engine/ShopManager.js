const fs = require("fs");
const path = require("path");
const StockManager = require("./StockManager");

const { getUser } = require("../../services/userService");
const { getInventory } = require("../../services/inventoryService");

const MERCHANTS_PATH = path.join(__dirname, "..", "data", "merchants.json");
const ITEMS_PATH = path.join(__dirname, "..", "data", "items.json");
const CATEGORIES_PATH = path.join(__dirname, "..", "data", "categories.json");

const ITEMS_PER_PAGE = 3;

/**
 * ShopManager
 * Central read-side controller for the marketplace: merchants, items,
 * live stock, and player-facing stats (coins/items owned/reputation),
 * pulled straight from WhisperBot's existing users/inventory tables.
 */
class ShopManager {
    _loadMerchants() {
        if (!this._merchants) {
            this._merchants = JSON.parse(fs.readFileSync(MERCHANTS_PATH, "utf8"));
        }
        return this._merchants;
    }

    _loadItems() {
        if (!this._items) {
            this._items = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
        }
        return this._items;
    }

    _loadCategories() {
        if (!this._categories) {
            try {
                this._categories = JSON.parse(fs.readFileSync(CATEGORIES_PATH, "utf8"));
            } catch (err) {
                this._categories = {};
            }
        }
        return this._categories;
    }

    /** Call if you hot-edit the JSON data files and want changes picked up without a restart. */
    reloadData() {
        this._merchants = null;
        this._items = null;
        this._categories = null;
    }

    getMerchants() {
        return this._loadMerchants();
    }

    getMerchant(key) {
        return this._loadMerchants()[key] || null;
    }

    /**
     * Every item for a merchant, merged with current stock levels.
     * `scope` lets you run per-guild stock instead of one global economy;
     * defaults to a single shared "global" stock pool across the bot.
     */
    getMerchantItems(merchantKey, scope = "global") {
        const merchant = this.getMerchant(merchantKey);
        if (!merchant) return [];

        const items = this._loadItems();

        return merchant.items
            .map(itemId => items[itemId])
            .filter(item => item && item.active !== false)
            .map(item => {
                const stock = StockManager.getStock(item.id, scope);
                return { ...item, current_stock: stock.current_stock, secondsUntilRestock: stock.secondsUntilRestock };
            });
    }

    getItem(itemId) {
        return this._loadItems()[itemId] || null;
    }

    /** Paginate a merchant's items ITEMS_PER_PAGE at a time. */
    getMerchantItemsPage(merchantKey, page = 0, scope = "global") {
        const items = this.getMerchantItems(merchantKey, scope);
        const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
        const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
        const start = clampedPage * ITEMS_PER_PAGE;
        return {
            items: items.slice(start, start + ITEMS_PER_PAGE),
            page: clampedPage,
            totalPages,
            totalItems: items.length
        };
    }

    getCategories() {
        return this._loadCategories();
    }

    /**
     * Player-facing stats shown in the marketplace header. Reads straight
     * from the `users` and `inventory` tables via the bot's own services —
     * getUser() also creates the row for brand-new players.
     */
    getPlayerStats(userId, username) {
        const user = getUser(userId, username);
        const itemsOwned = getInventory(userId).length; // distinct item types owned

        return {
            coins: user.coins,
            itemsOwned,
            reputation: user.kingdom_rep
        };
    }
}

module.exports = new ShopManager();
