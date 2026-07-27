// Run this once with: node database/migrateKingdomJoin.js
// Adds a column to track when a player joined their current kingdom, so
// /kingdom info can show "Joined X days ago" instead of just their overall
// server join date.

const db = require("./database");

try {

    db.prepare(`
        ALTER TABLE users
        ADD COLUMN kingdom_joined TEXT
    `).run();

    console.log("✅ Added kingdom_joined column");

} catch {

    console.log("kingdom_joined already exists");

}
