// Uses the bot's existing SQLite database (database/database.js) —
// same connection every other service uses. No MongoDB/Mongoose needed.
const db = require("../database/database");

// Self-healing: ensures the `lore` table exists even if database.js
// wasn't updated to create it. Safe to run every time the process starts
// (IF NOT EXISTS), matching the self-healing pattern already used
// elsewhere in this codebase (see the kingdom_joined / daily_streak
// migrations in database/database.js).
db.exec(`
    CREATE TABLE IF NOT EXISTS lore (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        archive_number INTEGER NOT NULL,
        text TEXT NOT NULL,
        category TEXT DEFAULT 'history',
        submitted_by TEXT NOT NULL,
        approved INTEGER DEFAULT 0,
        featured INTEGER DEFAULT 0,
        legendary INTEGER DEFAULT 0,
        readings INTEGER DEFAULT 0,
        broadcast_count INTEGER DEFAULT 0,
        last_broadcast TEXT,
        mod_notes TEXT,
        deleted INTEGER DEFAULT 0,
        submitted_at TEXT NOT NULL
    )
`);
db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lore_guild_archive
    ON lore (guild_id, archive_number)
`);
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lore_guild_approved
    ON lore (guild_id, approved)
`);
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lore_category
    ON lore (category)
`);

function nextArchiveNumber(guildId) {
    const row = db.prepare(
        "SELECT MAX(archive_number) AS max FROM lore WHERE guild_id = ?"
    ).get(guildId);

    return (row?.max || 0) + 1;
}

// Submit a new lore entry
function submitEntry(guildId, userId, text, category = "history") {
    const archiveNumber = nextArchiveNumber(guildId);

    db.prepare(`
        INSERT INTO lore (guild_id, archive_number, text, category, submitted_by, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        guildId,
        archiveNumber,
        text.trim(),
        category,
        userId,
        new Date().toISOString()
    );

    return db.prepare(
        "SELECT * FROM lore WHERE guild_id = ? AND archive_number = ?"
    ).get(guildId, archiveNumber);
}

// Auto-approved system entry — for programmatically-generated lore (e.g.
// Numerology milestone/chaos event records) rather than user
// submissions. Skips moderation since there's no user-generated content
// to review; the "author unknown" philosophy still holds (submitted_by
// is the bot's own ID, never displayed anywhere, same as a real
// submission).
function submitSystemEntry(guildId, botUserId, text, category = "history") {

    const archiveNumber = nextArchiveNumber(guildId);

    db.prepare(`
        INSERT INTO lore (guild_id, archive_number, text, category, submitted_by, approved, submitted_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(
        guildId,
        archiveNumber,
        text.trim(),
        category,
        botUserId,
        new Date().toISOString()
    );

    return db.prepare(
        "SELECT * FROM lore WHERE guild_id = ? AND archive_number = ?"
    ).get(guildId, archiveNumber);

}


// Get random approved entry
function getRandom(guildId, category = null) {
    let query = "SELECT * FROM lore WHERE guild_id = ? AND approved = 1 AND deleted = 0";
    const params = [guildId];

    if (category) {
        query += " AND category = ?";
        params.push(category);
    }

    const rows = db.prepare(query).all(...params);
    if (!rows.length) return null;

    const entry = rows[Math.floor(Math.random() * rows.length)];

    db.prepare("UPDATE lore SET readings = readings + 1 WHERE id = ?").run(entry.id);
    entry.readings += 1;

    return entry;
}

// Get latest entries
function getLatest(guildId, limit = 10) {
    return db.prepare(`
        SELECT * FROM lore
        WHERE guild_id = ? AND approved = 1 AND deleted = 0
        ORDER BY datetime(submitted_at) DESC
        LIMIT ?
    `).all(guildId, limit);
}

// Get oldest entries
function getOldest(guildId, limit = 10) {
    return db.prepare(`
        SELECT * FROM lore
        WHERE guild_id = ? AND approved = 1 AND deleted = 0
        ORDER BY datetime(submitted_at) ASC
        LIMIT ?
    `).all(guildId, limit);
}

// Search entries (simple substring match — SQLite has no $text like Mongo)
function search(guildId, query) {
    return db.prepare(`
        SELECT * FROM lore
        WHERE guild_id = ? AND approved = 1 AND deleted = 0 AND text LIKE ?
        ORDER BY datetime(submitted_at) DESC
        LIMIT 20
    `).all(guildId, `%${query}%`);
}

// Get Hall of Legends (top 100 most read, min 10 reads)
function getHallOfLegends(guildId) {
    return db.prepare(`
        SELECT * FROM lore
        WHERE guild_id = ? AND approved = 1 AND deleted = 0 AND readings > 10
        ORDER BY readings DESC
        LIMIT 100
    `).all(guildId);
}

// Get archive stats
function getStats(guildId) {
    const totals = db.prepare(`
        SELECT COUNT(*) AS total,
               MIN(submitted_at) AS oldest,
               MAX(submitted_at) AS newest
        FROM lore
        WHERE guild_id = ? AND approved = 1 AND deleted = 0
    `).get(guildId);

    const categories = db.prepare(`
        SELECT category AS name, COUNT(*) AS count
        FROM lore
        WHERE guild_id = ? AND approved = 1 AND deleted = 0
        GROUP BY category
        ORDER BY count DESC
    `).all(guildId);

    return {
        total: totals?.total || 0,
        oldest: totals?.oldest || null,
        newest: totals?.newest || null,
        categories
    };
}

// Approve an entry (mod only)
function approveEntry(entryId) {
    db.prepare("UPDATE lore SET approved = 1 WHERE id = ?").run(entryId);
    return db.prepare("SELECT * FROM lore WHERE id = ?").get(entryId);
}

// Delete an entry (mod only, soft delete)
function deleteEntry(entryId) {
    db.prepare("UPDATE lore SET deleted = 1 WHERE id = ?").run(entryId);
    return db.prepare("SELECT * FROM lore WHERE id = ?").get(entryId);
}

// Mark as legendary (rare spawn)
function markLegendary(entryId) {
    db.prepare("UPDATE lore SET legendary = 1 WHERE id = ?").run(entryId);
    return db.prepare("SELECT * FROM lore WHERE id = ?").get(entryId);
}

// Get a specific entry by archive number
function getByArchiveNumber(guildId, archiveNumber) {
    return db.prepare(`
        SELECT * FROM lore
        WHERE guild_id = ? AND archive_number = ? AND approved = 1 AND deleted = 0
    `).get(guildId, archiveNumber);
}

// Get pending entries for moderation
function getPending(guildId) {
    return db.prepare(`
        SELECT * FROM lore
        WHERE guild_id = ? AND approved = 0 AND deleted = 0
        ORDER BY datetime(submitted_at) ASC
        LIMIT 20
    `).all(guildId);
}

// Broadcast an entry (track broadcast count)
function broadcastEntry(entryId) {
    db.prepare(`
        UPDATE lore
        SET broadcast_count = broadcast_count + 1, last_broadcast = ?
        WHERE id = ?
    `).run(new Date().toISOString(), entryId);

    return db.prepare("SELECT * FROM lore WHERE id = ?").get(entryId);
}

// Get count by category
function getCategoryCount(guildId) {
    return db.prepare(`
        SELECT category AS name, COUNT(*) AS count
        FROM lore
        WHERE guild_id = ? AND approved = 1 AND deleted = 0
        GROUP BY category
        ORDER BY count DESC
    `).all(guildId);
}

module.exports = {
    submitEntry,
    submitSystemEntry,
    getRandom,
    getLatest,
    getOldest,
    search,
    getHallOfLegends,
    getStats,
    approveEntry,
    deleteEntry,
    markLegendary,
    getByArchiveNumber,
    getPending,
    broadcastEntry,
    getCategoryCount
};
