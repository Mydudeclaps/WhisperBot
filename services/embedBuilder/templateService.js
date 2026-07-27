const db = require("../../database/database");


function listTemplates(guildId) {

    return db.prepare(`
        SELECT name, updated_at
        FROM embed_templates
        WHERE guild_id = ?
        ORDER BY name COLLATE NOCASE ASC
    `).all(guildId);

}


function getTemplate(guildId, name) {

    const row = db.prepare(`
        SELECT * FROM embed_templates
        WHERE guild_id = ? AND name = ?
    `).get(guildId, name);

    if (!row) return null;

    try {

        return {
            name: row.name,
            data: JSON.parse(row.data),
            createdBy: row.created_by,
            updatedAt: row.updated_at
        };

    } catch (err) {

        console.error("Failed to parse embed template JSON:", err);
        return null;

    }

}


// Upserts a template — saving over an existing name overwrites it.
function saveTemplate(guildId, name, draft, userId) {

    const now = new Date().toISOString();
    const data = JSON.stringify(draft);

    db.prepare(`
        INSERT INTO embed_templates (guild_id, name, data, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, name)
        DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `).run(guildId, name, data, userId, now, now);

}


function deleteTemplate(guildId, name) {

    const result = db.prepare(`
        DELETE FROM embed_templates
        WHERE guild_id = ? AND name = ?
    `).run(guildId, name);

    return result.changes > 0;

}


function renameTemplate(guildId, oldName, newName) {

    try {

        db.prepare(`
            UPDATE embed_templates
            SET name = ?, updated_at = ?
            WHERE guild_id = ? AND name = ?
        `).run(newName, new Date().toISOString(), guildId, oldName);

        return true;

    } catch (err) {

        // Most likely a UNIQUE constraint hit — a template with newName
        // already exists.
        return false;

    }

}


function duplicateTemplate(guildId, name, newName, userId) {

    const existing = getTemplate(guildId, name);

    if (!existing) return false;

    try {

        saveTemplate(guildId, newName, existing.data, userId);
        return true;

    } catch (err) {

        return false;

    }

}


module.exports = {

    listTemplates,
    getTemplate,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
    duplicateTemplate

};
