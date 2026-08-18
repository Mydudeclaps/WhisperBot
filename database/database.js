const Database = require("better-sqlite3");


const dbPath = process.env.WHISPERBOT_DB_PATH || "whisperbot.db";
const db = new Database(dbPath);

// WhisperBot is intentionally a single-replica SQLite service. WAL keeps
// reads responsive while a purchase/opening transaction is being committed,
// and busy_timeout turns brief lock contention into a bounded wait instead of
// a player-facing failure.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");


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

// Self-healing migration: Whispers Casino expansion. Adds per-game
// counters for every new casino game (same `${game}_games`/`${game}_wins`
// pattern casinoStatsService.recordBet already relies on for dice and
// blackjack), a jackpot-wins counter, and casino daily-bonus streak
// tracking. Safe to run on every boot — ALTER TABLE ADD COLUMN throws if
// the column already exists, which we just swallow, same pattern as the
// users-table migrations above.
for (const column of [
    "highlow_games INTEGER DEFAULT 0",
    "highlow_wins INTEGER DEFAULT 0",
    "horse_games INTEGER DEFAULT 0",
    "horse_wins INTEGER DEFAULT 0",
    "slots_games INTEGER DEFAULT 0",
    "slots_wins INTEGER DEFAULT 0",
    "roulette_games INTEGER DEFAULT 0",
    "roulette_wins INTEGER DEFAULT 0",
    "poker_games INTEGER DEFAULT 0",
    "poker_wins INTEGER DEFAULT 0",
    "jackpots_won INTEGER DEFAULT 0",
    "last_daily_bonus TEXT",
    "daily_bonus_streak INTEGER DEFAULT 0",
    // Added when /tic and /memory shipped — casinoStatsService.recordBet()
    // builds column names dynamically as `${game}_games`/`${game}_wins`,
    // and these two were missed when they were first added, causing a
    // real "no such column: tic_games" / "no such column: memory_games"
    // error the moment either game's session tried to settle.
    "tic_games INTEGER DEFAULT 0",
    "tic_wins INTEGER DEFAULT 0",
    "memory_games INTEGER DEFAULT 0",
    "memory_wins INTEGER DEFAULT 0"
]) {

    try {

        db.prepare(`
            ALTER TABLE casino_stats
            ADD COLUMN ${column}
        `).run();

    } catch (e) {

        // Column already exists — nothing to do.

    }

}

// Casino horse ownership (Whispers Derby). A user can own more than one
// horse, but only once each — composite primary key enforces that.
db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_horses (
        user_id TEXT NOT NULL,
        horse_id TEXT NOT NULL,
        purchased_at TEXT NOT NULL,
        races INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, horse_id)
    )
`).run();

// Self-healing migration: Casino XP / rank system (Visitor -> Casino
// Legend). Separate from the total_wagered-based VIP thresholds
// (services/vipService.js) — see CASINO_CHANGES.md for why both exist
// and how they're surfaced differently now.
try {

    db.prepare(`
        ALTER TABLE casino_stats
        ADD COLUMN casino_xp INTEGER DEFAULT 0
    `).run();

} catch (e) {

    // Column already exists — nothing to do.

}

// Per-game history log — powers /casino history. Deliberately separate
// from casino_stats (which holds running totals only, no per-play
// detail).
db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        game_type TEXT NOT NULL,
        bet_amount INTEGER NOT NULL,
        result TEXT NOT NULL,
        win_amount INTEGER DEFAULT 0,
        played_at TEXT NOT NULL
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_casino_history_user
    ON casino_history (user_id, played_at)
`).run();

// Persistent per-game session cooldowns. Fixes a real bug: session
// cooldowns used to live only in a local variable inside each game
// command's execute() call, so leaving and re-running the command reset
// it to null every time — a player could bypass the 5-play cooldown just
// by clicking Leave and reopening the game. cooldown_until is a unix ms
// timestamp; checked against Date.now() at read time rather than storing
// remaining seconds, so accuracy doesn't depend on when it's read.
db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_cooldowns (
        user_id TEXT NOT NULL,
        game_type TEXT NOT NULL,
        cooldown_until INTEGER NOT NULL,
        PRIMARY KEY (user_id, game_type)
    )
`).run();

// Side activities (/mine, /chop, /dig, /farm, /build, /nether, /end) —
// persistent per-activity cooldowns, same reasoning as casino_cooldowns:
// a local variable would reset every time the command re-runs.
db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_cooldowns (
        user_id TEXT NOT NULL,
        activity TEXT NOT NULL,
        cooldown_until INTEGER NOT NULL,
        PRIMARY KEY (user_id, activity)
    )
`).run();

// Full history of activity results — not read by anything yet (future
// expansion, per the quest hub's "History: Coming Soon" placeholder),
// but recorded from day one so there's real data to show once that's
// built.
db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        activity TEXT NOT NULL,
        reward_coins INTEGER DEFAULT 0,
        reward_xp INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
`).run();

// Same deal for completed quests — not read anywhere yet, but recorded
// going forward so /quest history has real data whenever it's built.
db.prepare(`
    CREATE TABLE IF NOT EXISTS quest_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        reward_coins INTEGER DEFAULT 0,
        reward_xp INTEGER DEFAULT 0,
        reward_rep INTEGER DEFAULT 0
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

// /tic PvP challenges. Same shape as daily_races above (this codebase's
// established pending-challenge pattern), plus board/turn state — unlike
// every other casino game (one player, one command execution, state
// lives in local closures), a PvP tic-tac-toe match is played out by two
// different users clicking the same message across separate interaction
// events, so the board has to be persisted and read back on every move.
db.prepare(`
    CREATE TABLE IF NOT EXISTS tic_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1_id TEXT NOT NULL,
        player2_id TEXT NOT NULL,
        bet_amount INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        board TEXT DEFAULT '["","","","","","","","",""]',
        turn TEXT DEFAULT 'player1',
        message_id TEXT,
        channel_id TEXT,
        created_at TEXT NOT NULL,
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


// ---------------------------------------------------------------------
// Numerology — The Chaos Engine
// ---------------------------------------------------------------------

// One row per game session (a channel can have at most one ACTIVE game
// at a time, enforced in numerologyService.js, not by a DB constraint —
// SQLite has no easy "at most one row where status='active'" constraint
// without a partial unique index, and this keeps the logic readable).
// formula_state is a JSON blob holding whatever the active formula needs
// to remember beyond just current_number (e.g. the previous number, for
// a Fibonacci-style "current + previous" formula) plus any active chaos
// effects (warp remaining, curse target, ghost number pending).
db.prepare(`
    CREATE TABLE IF NOT EXISTS numerology_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        formula TEXT,
        formula_state TEXT DEFAULT '{}',
        current_number INTEGER NOT NULL DEFAULT 0,
        goal_number INTEGER,
        status TEXT DEFAULT 'active',
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        total_contributions INTEGER DEFAULT 0,
        highest_count INTEGER DEFAULT 0
    )
`).run();

// One row per contribution (correct or incorrect) — this is the audit
// trail /numerology admin's Statistics page reads from, and what
// per-contributor totals get computed from at goal completion.
db.prepare(`
    CREATE TABLE IF NOT EXISTS numerology_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        is_correct INTEGER DEFAULT 1,
        attempt_time TEXT DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_numerology_contributions_game
    ON numerology_contributions (game_id, user_id)
`).run();

// Per-user LIFETIME stats — persists across game resets/restarts,
// unlike numerology_games/contributions which are per-session.
db.prepare(`
    CREATE TABLE IF NOT EXISTS numerology_stats (
        user_id TEXT PRIMARY KEY,
        total_correct INTEGER DEFAULT 0,
        total_incorrect INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        highest_count_achieved INTEGER DEFAULT 0,
        chaos_events_witnessed INTEGER DEFAULT 0,
        milestones_reached INTEGER DEFAULT 0,
        last_contribution TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS numerology_chaos_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        description TEXT NOT NULL,
        triggered_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Anti-spam mistake tracking. Deliberately DB-backed, not an in-memory
// Map — every other cooldown/rate-limit system in this codebase learned
// that lesson the hard way (see casino_cooldowns' comment above), and a
// Map would also just reset on every bot restart, undermining the "10+
// mistakes in 5 minutes gets logged to mod-log" escalation tier the
// first time the bot happens to restart mid-window.
db.prepare(`
    CREATE TABLE IF NOT EXISTS numerology_mistakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        occurred_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_numerology_mistakes_user
    ON numerology_mistakes (user_id, occurred_at)
`).run();


// ---------------------------------------------------------------------
// Whisper Marketplace + Discord crates
// ---------------------------------------------------------------------

db.prepare(`
    CREATE TABLE IF NOT EXISTS shop_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interaction_id TEXT,
        guild_id TEXT,
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT,
        price INTEGER,
        quantity INTEGER,
        total_price INTEGER,
        purchased_at TEXT
    )
`).run();

for (const column of [
    "interaction_id TEXT",
    "guild_id TEXT"
]) {
    try {
        db.prepare(`
            ALTER TABLE shop_purchases
            ADD COLUMN ${column}
        `).run();
    } catch (e) {
        // Column already exists — nothing to do.
    }
}

db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_purchases_interaction
    ON shop_purchases (interaction_id)
    WHERE interaction_id IS NOT NULL
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_shop_purchases_user_item_date
    ON shop_purchases (user_id, item_id, purchased_at)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS crate_key_balances (
        user_id TEXT NOT NULL,
        key_type TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, key_type)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS crate_openings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interaction_id TEXT NOT NULL UNIQUE,
        guild_id TEXT,
        user_id TEXT NOT NULL,
        key_type TEXT NOT NULL,
        reward_id TEXT NOT NULL,
        reward_type TEXT NOT NULL,
        reward_amount INTEGER NOT NULL DEFAULT 1,
        opened_at TEXT NOT NULL
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_crate_openings_user_date
    ON crate_openings (user_id, opened_at)
`).run();


console.log("✅ Database connected");


module.exports = db;
