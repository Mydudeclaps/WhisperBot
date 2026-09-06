const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Database = require("better-sqlite3");

test("startup adds completed_at to a legacy daily-mission table without losing rows", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whisperbot-migration-"));
    const databasePath = path.join(directory, "legacy.db");
    const legacy = new Database(databasePath);

    legacy.exec(`
        CREATE TABLE user_daily_missions (
            user_id TEXT,
            mission_id TEXT,
            progress INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            assigned_date TEXT,
            PRIMARY KEY (user_id, mission_id)
        );
        INSERT INTO user_daily_missions
            (user_id, mission_id, progress, completed, assigned_date)
        VALUES ('member', 'messages_50', 12, 0, 'Mon Aug 31 2026');
    `);
    legacy.close();

    const script = `
        const db = require('./database/database');
        const columns = db.pragma('table_info(user_daily_missions)').map(c => c.name);
        const row = db.prepare('SELECT * FROM user_daily_missions WHERE user_id = ?').get('member');
        console.log(JSON.stringify({ columns, row }));
        db.close();
    `;
    const result = spawnSync(process.execPath, ["-e", script], {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, WHISPERBOT_DB_PATH: databasePath },
        encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout.trim().split("\n").at(-1));
    assert.ok(output.columns.includes("completed_at"));
    assert.equal(output.row.progress, 12);
    assert.equal(output.row.mission_id, "messages_50");

    fs.rmSync(directory, { recursive: true, force: true });
});

test("a completed daily mission records its timestamp and rewards only once", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whisperbot-mission-"));
    const databasePath = path.join(directory, "mission.db");
    const script = `
        (async () => {
            const db = require('./database/database');
            const { updateMissionProgress } = require('./services/dailyProgressService');
            const assignedDate = new Date().toDateString();
            db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run('member', 'member');
            db.prepare(\`INSERT INTO user_daily_missions
                (user_id, mission_id, progress, completed, assigned_date)
                VALUES (?, ?, ?, 0, ?)\`).run('member', 'messages_50', 49, assignedDate);
            let sends = 0;
            const channel = { send: async () => { sends += 1; } };
            await updateMissionProgress('member', 'messages', 1, channel);
            const afterFirst = db.prepare('SELECT coins, xp, kingdom_rep FROM users WHERE id = ?').get('member');
            await updateMissionProgress('member', 'messages', 1, channel);
            const afterSecond = db.prepare('SELECT coins, xp, kingdom_rep FROM users WHERE id = ?').get('member');
            const mission = db.prepare('SELECT progress, completed, completed_at FROM user_daily_missions WHERE user_id = ?').get('member');
            console.log(JSON.stringify({ afterFirst, afterSecond, mission, sends }));
            db.close();
        })().catch(error => { console.error(error); process.exit(1); });
    `;
    const result = spawnSync(process.execPath, ["-e", script], {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, WHISPERBOT_DB_PATH: databasePath },
        encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout.trim().split("\n").at(-1));
    assert.deepEqual(output.afterSecond, output.afterFirst);
    assert.equal(output.mission.progress, 50);
    assert.equal(output.mission.completed, 1);
    assert.ok(Number.isFinite(Date.parse(output.mission.completed_at)));
    assert.equal(output.sends, 1);

    fs.rmSync(directory, { recursive: true, force: true });
});
