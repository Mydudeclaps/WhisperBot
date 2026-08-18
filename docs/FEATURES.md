# 🎰 WhisperBot Systems

## 🎰 Casino System

**Games:** Blackjack, Dice, High/Low, Horse Racing, Roulette, Three Card Poker, Slots (5 machines), Tic Tac Toe (house + PvP), Memory Vault — 9 games, 10 commands.

**Core mechanics, shared across every game:**
- **Session pattern:** setup screen → up to 5 plays on one continuously-edited message → cooldown → optional next session. Every game follows this shape (`commands/casino/*.js`), sharing UI helpers from `utils/casinoSessionUI.js`.
- **Random cooldowns** (`casinoService.getRandomCooldown()`) — weighted tiers (mostly short, occasionally long) rather than a fixed duration, so the casino "feels alive." Persisted to `casino_cooldowns` — **not** a local variable, specifically because a local-variable version was a real, shipped bug (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)).
- **Casino XP & Ranks** — Visitor → Regular → VIP → High Roller → Casino Legend, earned by playing (10% of net winnings + 1 XP per win, 1 XP participation on a loss). Deliberately replaced an earlier wagered-threshold VIP system (`services/vipService.js`, still present but unused) because rewarding raw bet size rather than actual play felt wrong for a "sit down and play" casino.
- **Game history** (`/casino history`) — last 10 plays, `casino_history` table.
- **NPC dealers** — Frank (blackjack, poker), Luca (horse), Old Tom (dice, highlow), Silas (slots), Lucy (roulette, memory) — `data/casinoNpcs.js` + `services/casinoNpcService.js`. Poker and Memory Vault have extra stage-specific dialogue (`frankPokerLine`, `lucyMemoryLine`) beyond the shared win/lose/catchphrase pool.
- **Progressive jackpot** — 1% of every bet across every game feeds it (`jackpotService.js`, stored via `bot_settings`), with a small per-bet chance of hitting it outright.
- **Daily lucky number** — refreshes at the existing midnight reset cycle, self-heals if checked before that day's refresh happened.
- **Achievements** — 6 casino-specific entries in the shared `achievements` table (`CASINO_`-prefixed IDs), not a separate table.

**Game-specific notes:**
- **Horse Racing** — 5-horse field drawn from a 10-horse roster (`data/horses.js`), fixed for the whole session (you're picking among the same field each race, not a fresh draw every time). Owning a horse (`/horse buy`) gives +5% win chance / +10% payout when it races.
- **Poker** — Progressive 3-Card Poker with a real dealt dealer hand (not just a self-hand-strength payout table like the original design). ⚠️ Payout math needs rebalancing — see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
- **Slots** — Classic/Treasure/Kingdom are 3-reel; Fortune Reels is 5-reel with 3 paylines; Mega Slots is a 3×3 grid with 8 paylines. The two grid machines' payout tables were substantially rebalanced after simulation caught a severe positive-EV bug (see CHANGELOG).
- **Tic Tac Toe** — house mode has a deliberately imperfect AI (40% chance of a non-optimal move once win/block isn't on the table, 50% chance the house opens) so it's not a fully deterministic, exploitable opponent. PvP mode (`/tic opponent:@user amount:N`) is the only casino system with real player-vs-player stakes and DB-persisted cross-interaction state.
- **Memory Vault** — difficulty-scaled grids (4×4/5×5/6×6), button-based cell picking sized to match the actual board width, real mismatch-then-flip-back timing (not instant).

**Files:** `commands/casino/*.js`, `services/casinoService.js`, `services/casinoStatsService.js`, `services/{blackjack,horse,slots,roulette,poker,tic,memory}Service.js`, `services/jackpotService.js`, `services/luckyNumberService.js`, `services/casinoNpcService.js`, `services/casinoDailyService.js`, `services/casinoAnnouncerService.js`, `data/casinoNpcs.js`, `data/horses.js`.

---

## 💬 Social Engine

29 target-based/simple-response/bespoke social commands (`/hug`, `/8ball`, `/ship`, etc.) plus a 22nd (`yeet.js`) not accounted for in any prior spec, plus 15 of 21 built context-menu equivalents. Full mechanical breakdown in [ARCHITECTURE.md](ARCHITECTURE.md#social-engine).

**Key features:** 6-tier rarity system (Common → Divine), combo tracking between the same two users, random NPC interruptions, an achievement system separate from the casino's, and a 3-stage cinematic story format (intro → action → outcome, each a separate staged embed edit) for the target-based commands.

**Files:** `social-engine/` (self-contained), `commands/social/*.js`, `commands/context/*.js`.

---

## 📜 Lore System (The Whisper Archives)

A community-written mythology engine. Submissions are anonymous by design — the system never displays who submitted an entry, matching an explicit "history belongs to everyone" design philosophy. Requires mod approval (Manage Messages permission) before an entry becomes publicly visible. A `node-cron` scheduler posts a random approved entry twice daily with a 2% "legendary" variant.

**Files:** `commands/lore/lore.js` (all 8 subcommands in one file — required, since Discord doesn't allow a bare command alongside its own subcommands), `services/loreService.js`, `schedulers/loreBroadcast.js`, `utils/loreInteractionHandler.js`, `utils/loreUtils.js`.

---

## 🗺️ Quest System

14 quests across social/voice/community/exploration categories. `/quest hub` is a menu-driven Quest Journal (paginated Quest Board, Activities list, History placeholder) built alongside — not replacing — the original flat `/quest start`/`/quest active`/`/quest leave`/`/quest abandon` and `/quests` commands. Quests are one-time per player (no repeat-completion support currently).

Progress tracking is message- and reaction-driven (`services/events/messagePipeline.js`, `services/events/emojiReactionService.js`), not command-driven — quests progress passively as users chat/react, which is why quest-related logic lives partly in `events/messageCreate.js`'s pipeline rather than only in `commands/quests/`.

**Files:** `commands/quests/*.js`, `services/questService.js`, `services/questProgressService.js`, `services/questRewardService.js`, `services/events/messagePipeline.js`, `services/events/emojiReactionService.js`, `data/quests.js`, `data/dailyMissions.js`, `data/emojiTriggers.js`.

---

## ⛏️ Activity System

Run-anytime, no-objective commands with random rewards and real persistent cooldowns (`activity_cooldowns` table — same "don't use a local variable" lesson as the casino cooldown fix). 7 of 13 activity command files are fully configured and working (`mine`, `chop`, `dig`, `farm`, `build`, `nether`, `end`); 6 more exist but have no matching config entry in `data/activities.js` (`hunt`, `magic`, `monster`, `museum`, `shipwreck`, `treasure`) — see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

Rewards go through `coinService`/`xpService` directly (not a bypass), so mining a diamond and leveling up as a result triggers the bot's normal level-up flow like any other XP source.

**Files:** `commands/activities/*.js`, `services/activityService.js`, `data/activities.js`.

---

## 🏰 Kingdom System

Four kingdoms (North/East/South/West), each with a distinct color scheme and lore identity referenced throughout the bot (e.g. Kingdom Slots' bonus for matching your own kingdom's symbol, kingdom-flavored quest text). `kingdom`/`kingdom_rep`/`kingdom_joined` live directly on the `users` table rather than a separate table.

**Files:** `commands/kingdoms/*.js`, `services/kingdomService.js`, `data/kingdoms.js`, `utils/kingdomEmbeds.js`.

---

## 💰 Economy System

Coins, shop (`shop-engine/` — its own engine/data split, same pattern as `social-engine/`), Discord crates, inventory, robbery (`/rob` — heat/streak/cooldown persistence, full audit log via `robbery_logs`), and the daily-mission race system (`/racebet` etc. — explicitly kept separate from the casino's `/horse`, per an earlier requirement that these stay two distinct systems despite both involving "racing").

The Traveling Merchant sells up to three Whisper Crate Keys per player per UTC day. `/crate view` publishes the exact reward odds; `/crate open` and the post-purchase button consume one key and grant one Discord-only coin or collectible reward. Purchases and openings are atomic and idempotent.

**Files:** `commands/economy/*.js`, `commands/player/*.js`, `services/coinService.js`, `services/inventoryService.js`, `services/crateService.js`, `services/robbery{Calculator,Logger,Validator}.js`, `shop-engine/`.

---

## 🎖️ Achievement System

Two genuinely separate achievement systems exist, not one:
1. **Generic** (`achievements` table, `services/achievementService.js`) — used by leveling, robbery, and casino (via `CASINO_`-prefixed IDs). This is the one casino/quest/activity features should extend.
2. **Social Engine's own** (`social_stats.achievements_unlocked`, JSON column, `social-engine/engine/AchievementTracker.js`) — separate data store, separate tracker, only used by social commands.

There is no cross-reference between the two — a player's social achievements and their casino/leveling achievements are tracked completely independently.

---

## 🤖 NPC Systems

Two, also separate:
1. **Casino NPCs** — Frank, Luca, Old Tom, Silas, Lucy (`data/casinoNpcs.js`, `services/casinoNpcService.js`), each tagged with which game(s) they appear in.
2. **Social Engine NPCs** — a different roster, rolled via `social-engine/engine/NPCManager.js`, sourced from each social command's own `social-engine/data/commands/<name>.json`.

---

## 🛠️ Admin Tools

`/admin` (coins/inventory/stats/reset, all destructive actions requiring explicit confirmation), `/embedbuilder` (interactive live-preview embed creation with template save/load — `services/embedBuilder/`, `utils/embedBuilder/`), `/questchannels` (configure quest-tracking channels), `/resetdaily`, `/addxp`, `/testxp`/`/testvoice` (both have permission checks now — previously a known gap).

---

## 🧩 Context Menu Commands

21 built, 15 deployed (Discord's 15-per-guild USER command limit). Right-click → Apps → WhisperBot. Reuses the exact same underlying logic as their slash-command counterparts via shared runner functions — genuinely no duplicated game/interaction logic, just a different way of discovering the target user. Full detail in [ARCHITECTURE.md](ARCHITECTURE.md#social-engine) and [COMMANDS.md](COMMANDS.md#-context-menu-commands-commandscontext--21-files-15-deployed).
