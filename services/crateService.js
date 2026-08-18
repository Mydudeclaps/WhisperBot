const { randomInt } = require("crypto");

const db = require("../database/database");
const { getCrate } = require("../config/crateConfig");
const { getUser } = require("./userService");
const { addItem } = require("./inventoryService");

const getBalanceStmt = db.prepare(`
    SELECT quantity
    FROM crate_key_balances
    WHERE user_id = ? AND key_type = ?
`);

const grantKeysStmt = db.prepare(`
    INSERT INTO crate_key_balances (user_id, key_type, quantity, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, key_type) DO UPDATE SET
        quantity = quantity + excluded.quantity,
        updated_at = excluded.updated_at
`);

const consumeKeyStmt = db.prepare(`
    UPDATE crate_key_balances
    SET quantity = quantity - 1, updated_at = ?
    WHERE user_id = ? AND key_type = ? AND quantity > 0
`);

const getOpeningByInteractionStmt = db.prepare(`
    SELECT *
    FROM crate_openings
    WHERE interaction_id = ?
`);

const logOpeningStmt = db.prepare(`
    INSERT INTO crate_openings (
        interaction_id, guild_id, user_id, key_type,
        reward_id, reward_type, reward_amount, opened_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const addCoinsStmt = db.prepare(`
    UPDATE users
    SET coins = coins + ?
    WHERE id = ?
`);

function getKeyBalance(userId, keyType = "whisper") {
    const row = getBalanceStmt.get(userId, keyType);
    return row ? row.quantity : 0;
}

function grantKeys(userId, keyType = "whisper", quantity = 1) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error("Crate key quantity must be a positive integer");
    }

    if (!getCrate(keyType)) {
        throw new Error(`Unknown crate key type: ${keyType}`);
    }

    grantKeysStmt.run(userId, keyType, quantity, new Date().toISOString());
    return getKeyBalance(userId, keyType);
}

function chooseReward(crate, rng = randomInt) {
    const totalWeight = crate.rewards.reduce((sum, reward) => sum + reward.weight, 0);
    let roll = rng(totalWeight);

    for (const reward of crate.rewards) {
        if (roll < reward.weight) return reward;
        roll -= reward.weight;
    }

    throw new Error("Crate reward table has no selectable reward");
}

const openTransaction = db.transaction(({
    userId,
    username,
    guildId,
    interactionId,
    keyType,
    rng
}) => {
    const crate = getCrate(keyType);
    if (!crate) return { success: false, reason: "unknown_crate" };

    if (!interactionId) return { success: false, reason: "invalid_interaction" };

    if (getOpeningByInteractionStmt.get(interactionId)) {
        return { success: false, reason: "already_processed" };
    }

    getUser(userId, username);

    const now = new Date().toISOString();
    const consumed = consumeKeyStmt.run(now, userId, keyType);
    if (consumed.changes !== 1) {
        return { success: false, reason: "no_key", keyBalance: 0 };
    }

    const reward = chooseReward(crate, rng);
    let newBalance = null;

    if (reward.type === "coins") {
        addCoinsStmt.run(reward.amount, userId);
        newBalance = db.prepare("SELECT coins FROM users WHERE id = ?").get(userId).coins;
    } else if (reward.type === "item") {
        addItem(userId, reward.itemId, reward.amount);
    } else {
        throw new Error(`Unsupported crate reward type: ${reward.type}`);
    }

    logOpeningStmt.run(
        interactionId,
        guildId || null,
        userId,
        keyType,
        reward.id,
        reward.type,
        reward.amount,
        now
    );

    return {
        success: true,
        crate,
        reward,
        keyBalance: getKeyBalance(userId, keyType),
        newBalance
    };
});

function openCrate({
    userId,
    username,
    guildId = null,
    interactionId,
    keyType = "whisper",
    rng = randomInt
}) {
    try {
        return openTransaction({
            userId,
            username,
            guildId,
            interactionId,
            keyType,
            rng
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return { success: false, reason: "already_processed" };
        }
        throw error;
    }
}

function getRecentOpenings(userId, limit = 5) {
    return db.prepare(`
        SELECT *
        FROM crate_openings
        WHERE user_id = ?
        ORDER BY opened_at DESC
        LIMIT ?
    `).all(userId, limit);
}

module.exports = {
    getKeyBalance,
    grantKeys,
    chooseReward,
    openCrate,
    getRecentOpenings
};
