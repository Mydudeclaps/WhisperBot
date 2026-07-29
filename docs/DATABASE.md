# 💾 WhisperBot Database Schema

Single SQLite file (`whisperbot.db`), one connection module (`database/database.js`), 25 tables. Every table uses `CREATE TABLE IF NOT EXISTS`, and every column added after initial release uses `ALTER TABLE ADD COLUMN` wrapped in try/catch — this is a **self-healing** schema: starting the bot against an old database file automatically brings it up to date, no manual migration step, ever. This documentation is generated directly from that file, table by table, in the order they appear.

---

### `users`
**Purpose:** Core per-user record — economy, leveling, kingdom membership, daily check-in.
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | Discord user ID |
| username | TEXT | |
| coins | INTEGER | Default 0 |
| xp | INTEGER | Default 0 |
| level | INTEGER | Default 1 |
| kingdom | TEXT | Default `'None'` |
| kingdom_rep | INTEGER | Default 0 |
| kingdom_joined | TEXT | *(migrated in)* |
| joined | TEXT | |
| daily_streak | INTEGER | Default 0 *(migrated in)* |
| last_daily | TEXT | *(migrated in)* |
| total_dailies | INTEGER | Default 0 *(migrated in)* |

### `achievements`
**Purpose:** Generic cross-feature achievement unlocks — used by leveling, robbery, casino (`CASINO_`-prefixed IDs), etc. Deliberately shared rather than each system having its own table.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| user_id | TEXT |
| achievement | TEXT |
| unlocked_at | TEXT |

### `inventory`
**Purpose:** Item ownership.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| user_id | TEXT |
| item | TEXT |
| amount | INTEGER, default 1 |

### `quests`
**Purpose:** Quest definitions (14 quests currently — social/voice/community/exploration categories).
| Column | Type |
|---|---|
| id | TEXT PK |
| name, description, type | TEXT |
| goal | INTEGER |
| reward_xp, reward_coins, reward_rep | INTEGER, default 0 |

### `user_quests`
**Purpose:** Per-user quest progress/completion.
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT |
| user_id, quest_id | TEXT |
| progress | INTEGER, default 0 |
| completed | INTEGER, default 0 |
| started_at, completed_at | TEXT |
| channels_meta | TEXT | *(migrated in)* JSON array of channel IDs already credited, for CHANNELS-type quests |

### `user_stats`
**Purpose:** Generic per-user named stat counters.
| Column | Type |
|---|---|
| user_id, stat_name | TEXT, composite PK |
| stat_value | INTEGER, default 0 |

### `user_daily_missions`
**Purpose:** Daily mission assignment/progress (separate system from `/here` check-in).
| Column | Type |
|---|---|
| user_id, mission_id | TEXT, composite PK |
| progress, completed | INTEGER, default 0 |
| assigned_date | TEXT |

### `bot_settings`
**Purpose:** Generic key/value store. Currently used for the casino jackpot amount and the daily lucky number (`services/settingsService.js`).
| Column | Type |
|---|---|
| setting | TEXT PK |
| value | TEXT |

### `highlow_stats`
**Purpose:** Legacy per-user High/Low stats, predates `casino_stats`. Still written to alongside `casino_stats` for backwards compatibility, nothing currently reads it exclusively.
| Column | Type |
|---|---|
| user_id | TEXT PK |
| games_played, games_won | INTEGER, default 0 |
| total_won, total_lost | INTEGER, default 0 |

### `casino_stats`
**Purpose:** The central per-user casino stats table — every game's play/win counters, VIP/XP tracking, jackpot count, daily bonus streak. **The most-migrated table in the schema** — 4 separate migration blocks have added to it over time.
| Column | Type | Notes |
|---|---|---|
| user_id | TEXT PK |
| total_bets, total_wagered, total_won, total_lost | INTEGER, default 0 |
| biggest_win, biggest_loss | INTEGER, default 0 |
| dice_games, dice_wins | INTEGER, default 0 |
| blackjack_games, blackjack_wins | INTEGER, default 0 |
| highlow_games, highlow_wins | INTEGER, default 0 | *(migrated)* |
| horse_games, horse_wins | INTEGER, default 0 | *(migrated)* |
| slots_games, slots_wins | INTEGER, default 0 | *(migrated)* |
| roulette_games, roulette_wins | INTEGER, default 0 | *(migrated)* |
| poker_games, poker_wins | INTEGER, default 0 | *(migrated)* |
| jackpots_won | INTEGER, default 0 | *(migrated)* |
| last_daily_bonus | TEXT | *(migrated)* |
| daily_bonus_streak | INTEGER, default 0 | *(migrated)* |
| tic_games, tic_wins | INTEGER, default 0 | *(migrated — added late; this exact gap caused a real "no such column" bug, see [KNOWN_ISSUES.md](KNOWN_ISSUES.md))* |
| memory_games, memory_wins | INTEGER, default 0 | *(migrated — same bug/fix as tic_games)* |
| casino_xp | INTEGER, default 0 | *(migrated)* Visitor→Casino Legend rank progression |

⚠️ **`recordBet(userId, game, ...)` in `casinoStatsService.js` builds `${game}_games`/`${game}_wins` column names dynamically.** Any future casino game **must** have its two columns added to the migration list in `database/database.js`, or the very first session settlement for that game throws `SqliteError: no such column`. This has happened twice already.

### `casino_horses`
**Purpose:** Horse ownership for `/horse buy` — owning a horse gives it a win/payout bonus when it races.
| Column | Type |
|---|---|
| user_id, horse_id | TEXT, composite PK |
| purchased_at | TEXT |
| races, wins | INTEGER, default 0 |

### `casino_history`
**Purpose:** Per-play history log (powers `/casino history`) — deliberately separate from `casino_stats`, which only holds running totals, not per-play detail.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| user_id, game_type, result | TEXT, NOT NULL |
| bet_amount | INTEGER, NOT NULL |
| win_amount | INTEGER, default 0 |
| played_at | TEXT, NOT NULL |

Indexed on `(user_id, played_at)`.

### `casino_cooldowns`
**Purpose:** Persistent per-game session cooldowns. **Exists specifically to fix a real bug** — cooldowns used to live in a local variable inside each game command, resetting to nothing every time the command was re-run, letting players bypass the 5-play limit just by leaving and reopening the game.
| Column | Type |
|---|---|
| user_id, game_type | TEXT, composite PK |
| cooldown_until | INTEGER, NOT NULL (unix ms) |

### `activity_cooldowns`
**Purpose:** Same pattern as `casino_cooldowns`, for `/mine`, `/chop`, etc.
| Column | Type |
|---|---|
| user_id, activity | TEXT, composite PK |
| cooldown_until | INTEGER, NOT NULL |

### `activity_history`
**Purpose:** Full activity result log. Not read by anything yet — recorded from day one so a future history feature has real data.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| user_id, activity | TEXT, NOT NULL |
| reward_coins, reward_xp | INTEGER, default 0 |
| created_at | TEXT, NOT NULL |

### `quest_history`
**Purpose:** Same "recorded but not yet read" pattern as `activity_history`, for completed quests.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| user_id, quest_id | TEXT, NOT NULL |
| completed_at | TEXT, NOT NULL |
| reward_coins, reward_xp, reward_rep | INTEGER, default 0 |

### `robbery_stats`
**Purpose:** Per-user robbery meta — heat (decays over time), streak, cooldown.
| Column | Type |
|---|---|
| user_id | TEXT PK |
| heat | INTEGER, default 0 |
| last_heat_decay | TEXT |
| streak | INTEGER, default 0 |
| cooldown_until | TEXT |

### `robbery_logs`
**Purpose:** Full audit trail of every `/rob` attempt.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| robber_id, victim_id | TEXT |
| bet_amount, loot_stolen | INTEGER |
| outcome, victim_response | TEXT |
| success_chance, random_roll | INTEGER |
| timestamp | TEXT |

### `daily_races`
**Purpose:** Daily-mission race challenges (`/racebet` etc. — **not** the casino's `/horse`, a deliberately separate system).
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| player1_id, player2_id | TEXT |
| bet_amount | INTEGER |
| status | TEXT, default `'pending'` |
| created_at, accepted_at, completed_at | TEXT |
| winner_id | TEXT |

### `tic_challenges`
**Purpose:** `/tic` PvP challenges — the one casino system where two different users' interactions coordinate through persisted state (see [ARCHITECTURE.md](ARCHITECTURE.md)). Same shape as `daily_races` (established pending-challenge pattern in this codebase) plus board/turn state.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| player1_id, player2_id | TEXT, NOT NULL |
| bet_amount | INTEGER, NOT NULL |
| status | TEXT, default `'pending'` |
| board | TEXT, default empty 9-cell JSON array |
| turn | TEXT, default `'player1'` |
| message_id, channel_id | TEXT |
| created_at | TEXT, NOT NULL |
| accepted_at, completed_at, winner_id | TEXT |

### `embed_templates`
**Purpose:** Saved templates for the `/embedbuilder` admin tool.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| guild_id, name | TEXT, UNIQUE together |
| data | TEXT |
| created_by, created_at, updated_at | TEXT |

### `social_stats` *(Social Engine)*
**Purpose:** Per-user lifetime social interaction stats. Several columns are JSON stored as TEXT (no native JSON column type in SQLite) — `command_usage`, `interaction_counts`, `rarity_counts`, `achievements_unlocked`, `titles_unlocked`.
| Column | Type |
|---|---|
| user_id | TEXT PK |
| total_interactions | INTEGER, default 0 |
| command_usage | TEXT, default `'{}'` |
| interaction_counts | TEXT, default `'{}'` |
| combos_triggered, highest_combo | INTEGER, default 0 |
| rarity_counts | TEXT, default `'{}'` |
| npc_interactions, plot_twists_witnessed | INTEGER, default 0 |
| achievements_unlocked | TEXT, default `'[]'` |
| titles_unlocked | TEXT, default `'[]'` |
| active_title, favorite_command, most_interacted_with | TEXT |
| updated_at | TEXT |

### `social_history` *(Social Engine)*
**Purpose:** One row per completed social interaction — powers `/history`, `/replay`, `/halloffame`.
| Column | Type |
|---|---|
| event_id | TEXT PK |
| command, user_id | TEXT, NOT NULL |
| target_id | TEXT |
| target_mentioned | INTEGER, default 0 |
| rarity | TEXT, NOT NULL |
| combo | INTEGER, default 0 |
| combo_was_active | INTEGER, default 0 |
| npc_interrupted | INTEGER, default 0 |
| npc_name | TEXT |
| plot_twist_occurred | INTEGER, default 0 |
| achievement_unlocked | TEXT |
| story | TEXT, NOT NULL (JSON array of `{stage, text}`) |
| ended_at | TEXT, default CURRENT_TIMESTAMP |

### `active_combos` *(Social Engine)*
**Purpose:** Tracks back-to-back interactions between the same two players. `user_pair` is both user IDs sorted and joined with `:` so direction doesn't matter.
| Column | Type |
|---|---|
| user_pair | TEXT PK |
| command | TEXT, NOT NULL |
| count | INTEGER, default 1 |
| last_used | TEXT, default CURRENT_TIMESTAMP |

### `seasonal_events` *(Social Engine)*
**Purpose:** Reserved for a planned "Phase 4" seasonal-override system. Table exists; **nothing in the codebase reads from it yet.** STATUS: 🚧 Planned.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| name | TEXT, NOT NULL |
| start_date, end_date | TEXT |
| active | INTEGER, default 0 |
| data | TEXT, default `'{}'` |
| created_at | TEXT, default CURRENT_TIMESTAMP |

### `lore`
**Purpose:** The Whisper Archives. `archive_number` is scoped per-guild (unique together with `guild_id`, not globally unique) — this was a real bug fix (see CHANGELOG) after the original design made it globally unique and broke the moment a second guild tried to submit lore.
| Column | Type |
|---|---|
| id | INTEGER PK AUTOINCREMENT |
| guild_id | TEXT, NOT NULL |
| archive_number | INTEGER, NOT NULL |
| text | TEXT, NOT NULL |
| category | TEXT, default `'history'` |
| submitted_by | TEXT, NOT NULL |
| approved, featured, legendary, deleted | INTEGER, default 0 |
| readings, broadcast_count | INTEGER, default 0 |
| last_broadcast, mod_notes | TEXT |
| submitted_at | TEXT, NOT NULL |

Indexes: unique on `(guild_id, archive_number)`, plus `(guild_id, approved)` and `(category)`.

---

## Tables that exist but nothing currently reads
Worth knowing about specifically, since "recorded but unused" is different from "dead code":
- `activity_history` — written on every activity use, nothing queries it yet
- `quest_history` — written on every quest completion, nothing queries it yet
- `seasonal_events` — schema-complete, zero code references it at all (not even writes)
- `highlow_stats` — still written to for backwards compatibility, but `casino_stats.highlow_games`/`highlow_wins` is the actual source of truth now
