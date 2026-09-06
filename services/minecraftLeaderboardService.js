const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const { EmbedBuilder } = require("discord.js");
const db = require("../database/database");
const config = require("../config/minecraftLeaderboardConfig");

const BANNER_PATH = path.join(__dirname, "..", "assets", "images", "leaderboard_banner.png");
const BANNER_NAME = "whisper-smp-leaderboards.png";

db.exec(`
    CREATE TABLE IF NOT EXISTS minecraft_leaderboard_snapshots (
        snapshot_date TEXT NOT NULL,
        metric TEXT NOT NULL,
        player_uuid TEXT NOT NULL,
        username TEXT NOT NULL,
        value INTEGER NOT NULL,
        captured_at TEXT NOT NULL,
        PRIMARY KEY (snapshot_date, metric, player_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_minecraft_leaderboard_snapshot_lookup
    ON minecraft_leaderboard_snapshots (metric, snapshot_date);

    CREATE TABLE IF NOT EXISTS minecraft_leaderboard_posts (
        post_date TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        posted_at TEXT NOT NULL
    );
`);

function normalizeUuid(value) {
    return String(value || "").replaceAll("-", "").toLowerCase();
}

function dateInTimeZone(date = new Date(), timeZone = config.TIME_ZONE) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function timeInTimeZone(date = new Date(), timeZone = config.TIME_ZONE) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return { hour: Number(values.hour), minute: Number(values.minute) };
}

function sourceFingerprint(sourcePath) {
    return [sourcePath, `${sourcePath}-wal`].map(filePath => {
        try {
            const stat = fs.statSync(filePath);
            return `${stat.size}:${stat.mtimeMs}`;
        } catch (error) {
            if (error.code === "ENOENT") return "missing";
            throw error;
        }
    }).join("|");
}

function openReadOnlySnapshot(sourcePath) {
    // A WAL-mode database can need to create temporary -shm metadata even
    // for a read. The live plugin directories stay mounted read-only, so copy
    // a stable DB/WAL pair into the container tmpfs and query that copy.
    // Retrying if either source file moves avoids accepting a torn copy.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const tempDirectory = fs.mkdtempSync("/tmp/whisperbot-minecraft-");
        const snapshotPath = path.join(tempDirectory, path.basename(sourcePath));
        const before = sourceFingerprint(sourcePath);

        try {
            fs.copyFileSync(sourcePath, snapshotPath);
            if (fs.existsSync(`${sourcePath}-wal`)) {
                fs.copyFileSync(`${sourcePath}-wal`, `${snapshotPath}-wal`);
            }

            const after = sourceFingerprint(sourcePath);
            if (before !== after) throw new Error("Minecraft database changed during snapshot");

            const snapshot = new Database(snapshotPath, {
                readonly: true,
                fileMustExist: true
            });
            const check = snapshot.pragma("quick_check", { simple: true });
            if (check !== "ok") {
                snapshot.close();
                throw new Error(`Minecraft database snapshot failed quick_check: ${check}`);
            }

            return {
                database: snapshot,
                close() {
                    snapshot.close();
                    fs.rmSync(tempDirectory, { recursive: true, force: true });
                }
            };
        } catch (error) {
            fs.rmSync(tempDirectory, { recursive: true, force: true });
            if (attempt === 3) throw error;
        }
    }

    throw new Error("Unable to create a stable Minecraft database snapshot");
}

function readMinecraftData(paths = config) {
    const wegoSnapshot = openReadOnlySnapshot(paths.WEGO_ECONOMY_DB_PATH);
    const wego = wegoSnapshot.database;
    let banks;

    try {
        wego.pragma("busy_timeout = 5000");

        const accounts = wego.prepare(`
            SELECT player_uuid, balance_cents
            FROM economy_accounts
        `).all();
        const profiles = wego.prepare(`
            SELECT player_uuid, username, mobs_killed, money_made_cents
            FROM economy_profiles
        `).all();
        // WegoCore's canonical money-made stat is correction-aware. Raw sell
        // history remains useful for itemized audit, but may intentionally
        // retain incident-era transactions after staff restores a profile.
        const sellers = profiles.map(profile => ({
            player_uuid: profile.player_uuid,
            proceeds_cents: profile.money_made_cents
        }));

        const bankRows = [];
        if (fs.existsSync(paths.EBANKS_DB_PATH)) {
            banks = openReadOnlySnapshot(paths.EBANKS_DB_PATH);
            banks.database.pragma("busy_timeout = 5000");
            bankRows.push(...banks.database.prepare(`
                SELECT uuid AS player_uuid, name AS username, balance
                FROM ebanks_accounts
            `).all());
        }

        return combineMinecraftData({ accounts, profiles, sellers, bankRows });
    } finally {
        if (banks) banks.close();
        wegoSnapshot.close();
    }
}

function combineMinecraftData({ accounts, profiles, sellers, bankRows }) {
    const names = new Map();
    const uuids = new Map();

    for (const row of bankRows) {
        const key = normalizeUuid(row.player_uuid);
        uuids.set(key, String(row.player_uuid));
        if (row.username) names.set(key, row.username);
    }
    for (const row of profiles) {
        const key = normalizeUuid(row.player_uuid);
        uuids.set(key, String(row.player_uuid));
        if (row.username) names.set(key, row.username);
    }

    const makeEntry = (playerUuid, value) => {
        const key = normalizeUuid(playerUuid);
        return {
            playerUuid: uuids.get(key) || String(playerUuid),
            username: names.get(key) || "Unknown player",
            value: Math.max(0, Math.round(Number(value) || 0))
        };
    };

    const wealth = new Map();
    for (const row of accounts) {
        const key = normalizeUuid(row.player_uuid);
        wealth.set(key, (wealth.get(key) || 0) + Number(row.balance_cents || 0));
    }
    for (const row of bankRows) {
        const key = normalizeUuid(row.player_uuid);
        wealth.set(key, (wealth.get(key) || 0) + Math.round(Number(row.balance || 0) * 100));
    }

    const sortEntries = entries => entries.sort((a, b) =>
        b.value - a.value || a.username.localeCompare(b.username)
    );

    return {
        wealth: sortEntries([...wealth].map(([key, value]) => makeEntry(uuids.get(key) || key, value))),
        mobs: sortEntries(profiles.map(row => makeEntry(row.player_uuid, row.mobs_killed))),
        sell: sortEntries(sellers.map(row => makeEntry(row.player_uuid, row.proceeds_cents)))
    };
}

function previousSnapshots(postDate) {
    const previousDate = db.prepare(`
        SELECT MAX(snapshot_date) AS snapshot_date
        FROM minecraft_leaderboard_snapshots
        WHERE snapshot_date < ?
    `).get(postDate)?.snapshot_date;

    if (!previousDate) return { date: null, values: new Map() };

    const rows = db.prepare(`
        SELECT metric, player_uuid, value
        FROM minecraft_leaderboard_snapshots
        WHERE snapshot_date = ?
    `).all(previousDate);
    return {
        date: previousDate,
        values: new Map(rows.map(row => [`${row.metric}:${normalizeUuid(row.player_uuid)}`, row.value]))
    };
}

function money(cents) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    }).format(cents / 100);
}

function deltaText(delta, isMoney) {
    if (delta === null || delta === undefined) return "";
    if (delta === 0) return "  •  — today";
    const arrow = delta > 0 ? "▲" : "▼";
    const rendered = isMoney ? money(Math.abs(delta)) : Math.abs(delta).toLocaleString("en-US");
    return `  •  ${arrow} ${rendered} today`;
}

function leaderboardLines(entries, metric, priorValues, isMoney) {
    const medals = ["🥇", "🥈", "🥉"];
    return entries.slice(0, 10).map((entry, index) => {
        const previous = priorValues.get(`${metric}:${normalizeUuid(entry.playerUuid)}`);
        const delta = previous === undefined ? null : entry.value - previous;
        const value = isMoney ? money(entry.value) : entry.value.toLocaleString("en-US");
        const rank = medals[index] || `**${index + 1}.**`;
        return `${rank} **${entry.username}** — ${value}${deltaText(delta, isMoney)}`;
    }).join("\n");
}

function buildLeaderboardPayload(data, options = {}) {
    const now = options.now || new Date();
    const postDate = options.postDate || dateInTimeZone(now);
    const previous = options.previous || previousSnapshots(postDate);
    const preview = Boolean(options.preview);
    const baselineNote = previous.date
        ? `Daily movement compared with ${previous.date}.`
        : "Tonight establishes the baseline; daily movement begins tomorrow.";

    const definitions = [
        {
            metric: "wealth",
            title: "💰 Wealthiest Players",
            subtitle: "Total wealth — wallet + eBank",
            color: 0xF1C40F,
            isMoney: true
        },
        {
            metric: "mobs",
            title: "⚔️ Monster Hunters",
            subtitle: "All-time hostile and passive mob kills",
            color: 0xE74C3C,
            isMoney: false
        },
        {
            metric: "sell",
            title: "📦 Merchant Royalty",
            subtitle: "All-time gross earnings from /sell",
            color: 0x2ECC71,
            isMoney: true
        }
    ];

    const embeds = definitions.map((definition, index) => {
        const embed = new EmbedBuilder()
            .setTitle(definition.title)
            .setDescription(
                `*${definition.subtitle}*\n\n` +
                (leaderboardLines(
                    data[definition.metric],
                    definition.metric,
                    previous.values,
                    definition.isMoney
                ) || "No standings are available yet.")
            )
            .setColor(definition.color)
            .setFooter({ text: "WhisperBot • All-time standings • Nightly at 9:00 PM ET" })
            .setTimestamp(now);
        if (index === 0 && fs.existsSync(BANNER_PATH)) {
            embed.setImage(`attachment://${BANNER_NAME}`);
        }
        return embed;
    });

    return {
        content: `${preview ? "🔎 **Preview** • " : "🌙 **Whisper SMP Nightly Standings**\n"}${baselineNote}`,
        embeds,
        files: fs.existsSync(BANNER_PATH) ? [{ attachment: BANNER_PATH, name: BANNER_NAME }] : []
    };
}

function hasPosted(postDate) {
    return Boolean(db.prepare(`
        SELECT 1 FROM minecraft_leaderboard_posts WHERE post_date = ?
    `).get(postDate));
}

function recordScheduledPost(postDate, messageId, data, now = new Date()) {
    const capturedAt = now.toISOString();
    const insertSnapshot = db.prepare(`
        INSERT OR REPLACE INTO minecraft_leaderboard_snapshots
            (snapshot_date, metric, player_uuid, username, value, captured_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertPost = db.prepare(`
        INSERT INTO minecraft_leaderboard_posts (post_date, message_id, posted_at)
        VALUES (?, ?, ?)
    `);

    db.transaction(() => {
        for (const metric of ["wealth", "mobs", "sell"]) {
            for (const entry of data[metric]) {
                insertSnapshot.run(
                    postDate,
                    metric,
                    entry.playerUuid,
                    entry.username,
                    entry.value,
                    capturedAt
                );
            }
        }
        insertPost.run(postDate, String(messageId), capturedAt);
    })();
}

async function fetchDestination(client) {
    const channel = await client.channels.fetch(config.CHANNEL_ID);
    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
        throw new Error(`Configured leaderboard destination ${config.CHANNEL_ID} is not sendable`);
    }
    if (channel.guildId !== config.GUILD_ID) {
        throw new Error("Configured leaderboard destination is outside the approved guild");
    }
    return channel;
}

async function postLeaderboards(client, { preview = false, now = new Date() } = {}) {
    const postDate = dateInTimeZone(now);
    if (!preview && hasPosted(postDate)) {
        return { skipped: true, reason: "already-posted", postDate };
    }

    const data = readMinecraftData();
    const payload = buildLeaderboardPayload(data, { preview, now, postDate });
    const channel = await fetchDestination(client);
    const message = await channel.send(payload);

    if (!preview) recordScheduledPost(postDate, message.id, data, now);
    return { skipped: false, messageId: message.id, postDate };
}

module.exports = {
    buildLeaderboardPayload,
    combineMinecraftData,
    dateInTimeZone,
    deltaText,
    hasPosted,
    postLeaderboards,
    readMinecraftData,
    timeInTimeZone
};
