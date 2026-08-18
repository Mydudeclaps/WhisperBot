const fs = require("fs");
const path = require("path");

const db = require("../database/database");

const databasePath = process.env.WHISPERBOT_DB_PATH || "whisperbot.db";
const backupDirectory = process.env.WHISPERBOT_BACKUP_DIR ||
    path.join(path.dirname(databasePath), "backups");
const timestamp = new Date().toISOString().replaceAll(":", "-");
const destination = path.join(backupDirectory, `whisperbot-${timestamp}.db`);

fs.mkdirSync(backupDirectory, { recursive: true });

db.backup(destination)
    .then(() => {
        console.log(`✅ Database backup created: ${path.basename(destination)}`);
        db.close();
    })
    .catch(error => {
        console.error("❌ Database backup failed:", error.message);
        db.close();
        process.exitCode = 1;
    });
