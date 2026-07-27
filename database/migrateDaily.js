const db = require("./database");


try {

    db.prepare(`
        ALTER TABLE users
        ADD COLUMN last_daily TEXT
    `).run();

    console.log("✅ Added last_daily column");

} catch {

    console.log("last_daily already exists");

}


try {

    db.prepare(`
        ALTER TABLE users
        ADD COLUMN daily_streak INTEGER DEFAULT 0
    `).run();

    console.log("✅ Added daily_streak column");

} catch {

    console.log("daily_streak already exists");

}


// Add completed_at to daily missions

try {

    db.prepare(`
        ALTER TABLE user_daily_missions
        ADD COLUMN completed_at TEXT
    `).run();

    console.log("✅ Added completed_at column");

} catch {

    console.log("completed_at already exists");

}