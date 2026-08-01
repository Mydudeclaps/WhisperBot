# 🐛 Known Issues

## Active Bugs

### Poker payout table pays out more than it takes in
**Description:** A 20,000-hand simulation at minimum bet (ante only) showed Progressive 3-Card Poker returning ~126% of what's wagered on average — the casino loses money on this game with volume play.
**Location:** `config/gameConfig.js` → `POKER.PAYOUTS`, applied in `commands/casino/poker.js`
**Possible cause:** The payout table (500x/40x/30x/6x/3x/2x/1x) was originally tuned for a self-hand-strength-only variant where it applied regardless of beating the dealer. Now that the same multipliers only pay out on the ~50% of hands that beat a real dealt dealer hand, they're worth roughly double what they should be. Real 3-card poker keeps a much smaller separate "Ante Bonus" table specifically because it stacks alongside a real head-to-head comparison, not instead of one.
**Status:** ⚠️ Unresolved — flagged, not fixed, since picking new numbers is a house-edge decision that wasn't this round's call to make unilaterally.
**Suggested fix:** Cut `POKER.PAYOUTS` roughly in half as a starting point, then re-simulate against Classic Slots' 0.633x baseline the same way Fortune Reels/Mega Slots were rebalanced.

### Kingdom Slots has a severe positive-EV bug
**Description:** 7.46x average return over 50,000 simulated spins.
**Location:** `config/gameConfig.js` → `SLOTS.VARIANTS.kingdom.payouts`
**Possible cause:** Not investigated in depth — discovered as a side effect of establishing an EV baseline while fixing Fortune Reels/Mega Slots, not because Kingdom Slots itself was being worked on that round.
**Status:** ⚠️ Unresolved, not yet investigated further. This is a live, exploitable bug if the bot is in real use.
**Suggested fix:** Same simulate-then-rebalance treatment already applied successfully to Fortune Reels and Mega Slots.

### 6 activity commands have no matching configuration
**Description:** `/hunt`, `/magic`, `/monster`, `/museum`, `/shipwreck`, `/treasure` exist as command files (following the same template as the 7 working activities) but have no entry in `data/activities.js`. They load without crashing — `activityService.executeActivity()` returns a graceful "Activity not found" error — but are otherwise non-functional.
**Location:** `commands/activities/{hunt,magic,monster,museum,shipwreck,treasure}.js`
**Possible cause:** Unknown — these weren't built as part of any documented round of work; they appear to have been added directly to the project (possibly by another session or manually) without the corresponding config.
**Status:** ⚠️ Unresolved. Not fixed on discovery since building out 6 activities' full config (symbols, outcome tables, cooldown ranges, NPC lines) is real, unscoped work.
**Fix attempts:** None yet.

---

### `casinoAnnouncerService.js` has the same channel-guessing risk the Lore Archive bug had
**Description:** Big casino win announcements (`maybeAnnounceWin()`) pick a destination channel by guessing — `findAnnounceChannel()` prefers `guild.systemChannel`, falling back to the first postable text channel — the exact same pattern that caused scheduled Lore Archive posts to land in WhisperSMP's Welcome channel instead of the Lore Archive channel (see `docs/updates/2026-07-29-notification-routing-audit.md`). This means casino win announcements are very likely *also* currently landing in the Welcome channel today, since `guild.systemChannel` is the same channel either way.
**Location:** `services/casinoAnnouncerService.js` (`findAnnounceChannel()`)
**Why it wasn't fixed alongside the Lore Archive routing fix:** no destination channel ID for casino win announcements was specified as part of that audit's scope (only Lore Archive and Player Updates channel IDs were given), and redirecting a working, unrequested system's destination on a guess risked being wrong. `utils/notificationRouter.js` and `config/notificationConfig.js` already exist and are built to make this a one-line fix (add a `CASINO_ANNOUNCER_CHANNEL_ID` constant + one `announceCasinoWin()` function) whenever the intended destination is confirmed.
**Status:** ⚠️ Unresolved, flagged for awareness. Behavior unchanged from before this audit.
**Fix attempts:** None yet — awaiting a decision on destination channel.

---

## Technical Debt

### `commandHandler.js`'s command Map has no type separation
**Description:** Every command (chat input, user context menu) is stored in one `Map`, keyed only by `command.data.name`. Discord treats slash commands and context menu commands as separate namespaces (a slash command and a context command can share a name), but this codebase's dispatch layer doesn't reflect that distinction.
**Location:** `handlers/commandHandler.js`, `events/interactionCreate.js`
**Why it matters:** Currently safe — every context command's display name is capitalized ("Hug") while its slash equivalent is lowercase ("hug"), and JS Map keys are case-sensitive, so there's no actual collision today (verified across all 101 commands). But nothing enforces this; a future context command sharing exact case with an existing command of a different type would silently overwrite one of them in the Map.
**Suggested fix:** Key the Map by `${type}:${name}` instead of just `name`, or maintain separate Maps per command type.

### `package.json` listed an unused dependency
**Status:** ✅ Resolved (2026-07-29 maintenance sprint) — `sqlite3` was removed from `package.json`. Nothing in the codebase ever required it; `better-sqlite3` is the only SQLite driver in use.

### `highlow_stats` table is redundant with `casino_stats`
**Description:** High/Low still writes to its own legacy `highlow_stats` table for backwards compatibility, but `casino_stats.highlow_games`/`highlow_wins` is the actual source of truth everywhere else (leaderboards, passport, etc.).
**Location:** `database/database.js`, `services/highlowService.js`
**Why it matters:** Low — the duplicate write is harmless, just dead weight. Nothing currently reads `highlow_stats` exclusively.
**Suggested fix:** Confirm nothing reads it, then stop writing to it (don't drop the table — self-healing migrations never remove data).

### `models/` folder is empty
**Status:** ✅ Resolved (2026-07-29 maintenance sprint) — the folder no longer exists in the project; nothing referenced it.

### `vipService.js` is dead code
**Description:** Fully functional wagered-threshold VIP rank system, completely unused since the casino XP/rank system replaced it as what `/casino vip` actually displays.
**Location:** `services/vipService.js`
**Why it matters:** Low — not harmful, just unreferenced. Kept deliberately in case it's wanted for something else (e.g. a "lifetime high roller" title independent of current rank).
**Suggested fix:** No action needed unless you decide you don't want it; document the decision either way if it's ever revisited.

### Activity/quest history tables are write-only
**Description:** `activity_history` and `quest_history` are populated on every relevant action but nothing currently queries them.
**Location:** `database/database.js`, `services/activityService.js`, `services/questRewardService.js`
**Why it matters:** Not a bug — this was intentional ("record now so there's real data whenever a history feature gets built"), but worth knowing these aren't dead tables, just unfinished features waiting on a command that reads them. See [FUTURE_PLANS.md](FUTURE_PLANS.md).
