const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whisperbot-check-"));
process.env.WHISPERBOT_DB_PATH = path.join(tempDirectory, "check.db");

let db;

try {
    const commandsRoot = path.join(__dirname, "..", "commands");
    const seenNames = new Map();
    let commandCount = 0;

    for (const folder of fs.readdirSync(commandsRoot)) {
        const folderPath = path.join(commandsRoot, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        for (const file of fs.readdirSync(folderPath).filter(name => name.endsWith(".js"))) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);

            if (!command.data || typeof command.execute !== "function") {
                throw new Error(`${filePath} does not export both data and execute`);
            }

            const json = command.data.toJSON();
            const key = json.name;

            if (seenNames.has(key)) {
                throw new Error(`Command name collision: ${key} (${seenNames.get(key)} and ${filePath})`);
            }

            seenNames.set(key, filePath);
            commandCount += 1;
        }
    }

    const items = require("../shop-engine/data/items.json");
    const { CRATES } = require("../config/crateConfig");

    for (const crate of Object.values(CRATES)) {
        const keyItem = items[crate.keyItemId];
        if (!keyItem) throw new Error(`${crate.name} references missing key item ${crate.keyItemId}`);
        if (keyItem.price !== crate.price) throw new Error(`${crate.name} key price does not match shop price`);
        if (keyItem.metadata?.daily_limit !== crate.dailyPurchaseLimit) {
            throw new Error(`${crate.name} daily limit does not match shop configuration`);
        }

        const totalWeight = crate.rewards.reduce((sum, reward) => sum + reward.weight, 0);
        if (totalWeight !== 10000) {
            throw new Error(`${crate.name} reward weights must total 10000, got ${totalWeight}`);
        }

        for (const reward of crate.rewards) {
            if (reward.type === "item" && !items[reward.itemId]) {
                throw new Error(`${crate.name} reward references missing item ${reward.itemId}`);
            }
        }
    }

    db = require("../database/database");
    console.log(`✅ Loaded and validated ${commandCount} commands`);
    console.log(`✅ Validated ${Object.keys(CRATES).length} crate reward table`);
} finally {
    if (db?.open) db.close();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
}
