const Database = require("better-sqlite3");


const db = new Database("whisperbot.db");


db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        coins INTEGER DEFAULT 0,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        kingdom TEXT DEFAULT 'None',
        kingdom_rep INTEGER DEFAULT 0,
        kingdom_joined TEXT,
        joined TEXT,
        daily_streak INTEGER DEFAULT 0,
        last_daily TEXT,
        total_dailies INTEGER DEFAULT 0
    )
`).run();

// Self-healing migration: `kingdom_joined` powers "Joined X days ago" and
// "Newest Member" on /kingdom info. It's included in the CREATE TABLE above
// for brand-new databases, and this ALTER heals any existing database that
// was created before the column existed — no manual migration step needed.
try {

    db.prepare(`
        ALTER TABLE users
        ADD COLUMN kingdom_joined TEXT
    `).run();

} catch (e) {

    // Column already exists — nothing to do.

}

// Self-healing migration: daily check-in columns for the /here command.
// `daily_streak` is the current consecutive-day streak, `last_daily` is the
// ISO timestamp of the last successful check-in, `total_dailies` is a
// lifetime counter. Same heal-existing-DB pattern as kingdom_joined above.
for (const column of [
    "daily_streak INTEGER DEFAULT 0",
    "last_daily TEXT",
    "total_dailies INTEGER DEFAULT 0"
]) {

    try {

        db.prepare(`
            ALTER TABLE users
            ADD COLUMN ${column}
        `).run();

    } catch (e) {

        // Column already exists — nothing to do.

    }

}

db.prepare(`
    CREATE TABLE IF NOT EXISTS achievements (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id TEXT,

        achievement TEXT,

        unlocked_at TEXT

    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id TEXT,

        item TEXT,

        amount INTEGER DEFAULT 1

    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS quests (

        id TEXT PRIMARY KEY,

        name TEXT,

        description TEXT,

        type TEXT,

        goal INTEGER,

        reward_xp INTEGER DEFAULT 0,

        reward_coins INTEGER DEFAULT 0,

        reward_rep INTEGER DEFAULT 0

    )
`).run();



db.prepare(`
    CREATE TABLE IF NOT EXISTS user_quests (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id TEXT,

        quest_id TEXT,

        progress INTEGER DEFAULT 0,

        completed INTEGER DEFAULT 0,

        started_at TEXT,

        completed_at TEXT,

        channels_meta TEXT

    )
`).run();

// Self-healing migration: `channels_meta` stores a JSON array of channel IDs
// a user has already been credited for on CHANNELS-type quests (e.g. "send
// messages in 5 different channels"), so repeat messages in the same channel
// don't count twice. Included in CREATE TABLE for new databases, and this
// ALTER heals existing databases created before the column existed.
try {

    db.prepare(`
        ALTER TABLE user_quests
        ADD COLUMN channels_meta TEXT
    `).run();

} catch (e) {

    // Column already exists — nothing to do.

}

db.prepare(`
    CREATE TABLE IF NOT EXISTS user_stats (

        user_id TEXT,

        stat_name TEXT,

        stat_value INTEGER DEFAULT 0,

        PRIMARY KEY (user_id, stat_name)

    )
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS user_daily_missions (

    user_id TEXT,

    mission_id TEXT,

    progress INTEGER DEFAULT 0,

    completed INTEGER DEFAULT 0,

    assigned_date TEXT,

    PRIMARY KEY (user_id, mission_id)

)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS bot_settings (

    setting TEXT PRIMARY KEY,

    value TEXT

)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS highlow_stats (
        user_id TEXT PRIMARY KEY,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_won INTEGER DEFAULT 0,
        total_lost INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_stats (
        user_id TEXT PRIMARY KEY,
        total_bets INTEGER DEFAULT 0,
        total_wagered INTEGER DEFAULT 0,
        total_won INTEGER DEFAULT 0,
        total_lost INTEGER DEFAULT 0,
        biggest_win INTEGER DEFAULT 0,
        biggest_loss INTEGER DEFAULT 0,
        dice_games INTEGER DEFAULT 0,
        dice_wins INTEGER DEFAULT 0,
        blackjack_games INTEGER DEFAULT 0,
        blackjack_wins INTEGER DEFAULT 0
    )
`).run();

// Per-user robbery meta: heat (recent-robbery suspicion level, decays over
// time), streak (consecutive successful robberies, resets on any failure),
// and cooldown_until (when this player can attempt /rob again — longer
// after an arrest than a normal attempt).
db.prepare(`
    CREATE TABLE IF NOT EXISTS robbery_stats (
        user_id TEXT PRIMARY KEY,
        heat INTEGER DEFAULT 0,
        last_heat_decay TEXT,
        streak INTEGER DEFAULT 0,
        cooldown_until TEXT
    )
`).run();

// Full audit trail of every robbery attempt, for moderation/debugging and
// for any future /rob history or leaderboard features.
db.prepare(`
    CREATE TABLE IF NOT EXISTS robbery_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        robber_id TEXT,
        victim_id TEXT,
        bet_amount INTEGER,
        loot_stolen INTEGER,
        outcome TEXT,
        victim_response TEXT,
        success_chance INTEGER,
        random_roll INTEGER,
        timestamp TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_races (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1_id TEXT,
        player2_id TEXT,
        bet_amount INTEGER,
        status TEXT DEFAULT 'pending',
        created_at TEXT,
        accepted_at TEXT,
        completed_at TEXT,
        winner_id TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS embed_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        name TEXT,
        data TEXT,
        created_by TEXT,
        created_at TEXT,
        updated_at TEXT,
        UNIQUE(guild_id, name)
    )
`).run();


// ---------------------------------------------------------------------
// Social Engine (Phase 1 core schema)
// ---------------------------------------------------------------------

// Per-user lifetime social stats. JSON columns (command_usage,
// interaction_counts, rarity_counts, achievements_unlocked,
// titles_unlocked) are stored as TEXT and JSON.parse/stringify'd in
// SocialStats.js — better-sqlite3 has no native JSON column type.
db.prepare(`
    CREATE TABLE IF NOT EXISTS social_stats (
        user_id TEXT PRIMARY KEY,
        total_interactions INTEGER DEFAULT 0,
        command_usage TEXT DEFAULT '{}',
        interaction_counts TEXT DEFAULT '{}',
        combos_triggered INTEGER DEFAULT 0,
        highest_combo INTEGER DEFAULT 0,
        rarity_counts TEXT DEFAULT '{}',
        npc_interactions INTEGER DEFAULT 0,
        plot_twists_witnessed INTEGER DEFAULT 0,
        achievements_unlocked TEXT DEFAULT '[]',
        titles_unlocked TEXT DEFAULT '[]',
        active_title TEXT,
        favorite_command TEXT,
        most_interacted_with TEXT,
        updated_at TEXT
    )
`).run();

// One row per completed social interaction — powers /history, /replay,
// and /halloffame down the line. `story` is a JSON array of
// { stage, text } objects.
db.prepare(`
    CREATE TABLE IF NOT EXISTS social_history (
        event_id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        user_id TEXT NOT NULL,
        target_id TEXT,
        target_mentioned INTEGER DEFAULT 0,
        rarity TEXT NOT NULL,
        combo INTEGER DEFAULT 0,
        combo_was_active INTEGER DEFAULT 0,
        npc_interrupted INTEGER DEFAULT 0,
        npc_name TEXT,
        plot_twist_occurred INTEGER DEFAULT 0,
        achievement_unlocked TEXT,
        story TEXT NOT NULL,
        ended_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Tracks back-to-back interactions between the same two players so a
// combo counter can build up. `user_pair` is the two user IDs sorted and
// joined with ":" so "A hugs B" and "B hugs A" share the same combo.
db.prepare(`
    CREATE TABLE IF NOT EXISTS active_combos (
        user_pair TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        last_used TEXT DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Reserved for Phase 4 (seasonal overrides). Created now so the schema
// is complete per the Phase 1 plan, but nothing reads from it yet.
db.prepare(`
    CREATE TABLE IF NOT EXISTS seasonal_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        active INTEGER DEFAULT 0,
        data TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// The Whisper Archives (/lore). Lives in the same SQLite database as
// everything else — no separate MongoDB connection required.
// archive_number is per-guild (see loreService.submitEntry), so it's only
// unique in combination with guild_id, not on its own.
db.prepare(`
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
`).run();

db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lore_guild_archive
    ON lore (guild_id, archive_number)
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_lore_guild_approved
    ON lore (guild_id, approved)
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_lore_category
    ON lore (category)
`).run();


console.log("✅ Database connected");


module.exports = db;