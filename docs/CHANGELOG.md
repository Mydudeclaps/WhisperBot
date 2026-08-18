# 📜 Changelog

Reconstructed from this project's actual development history — real rounds of work, real bugs found and fixed, in order. Dates approximate where not explicitly recorded.

## Discord Crates & Production Runtime — 2026-08-18
### Added
- `/crate view` and `/crate open`, plus an Open Crate button after key purchases.
- A 5,000-coin Whisper Crate Key in `/shop`, limited to three per player per UTC day.
- Published reward odds, secure server-side rolls, dedicated key balances, and immutable opening audit records.
- Node transaction tests, full command/config validation, Docker runtime, health heartbeat, and persistent-volume deployment configuration.
### Fixed
- Marketplace settlement is now one SQLite transaction: coin debit, stock reservation, inventory/key grant, and purchase audit either all commit or all roll back.
- Discord interaction IDs prevent repeated purchase/open interactions from charging or granting twice.
- SQLite now supports a configured persistent path and enables WAL/busy-timeout safeguards.
- Updated the vulnerable transitive HTTP dependency; production audit is clean.

## Notification Routing Audit — 2026-07-29
### Fixed
- **Lore Archive posts were landing in the Welcome channel.** Root cause: `schedulers/loreBroadcast.js`'s `findBroadcastChannel()` picked `guild.systemChannel` as its first choice when no explicit destination was configured — and WhisperSMP's system channel is the Welcome channel. Removed the guessing entirely; broadcasts now go to a fixed, correctly-configured Lore Archive channel.
- **Level-up and achievement notifications had no fixed destination at all** — `events/messageCreate.js` posted both directly into `message.channel`, i.e. whatever channel the player happened to be chatting in when they crossed an XP threshold. Now routed to a dedicated Player Updates channel.
### Added
- `config/notificationConfig.js` — centralized destination channel IDs for all of WhisperBot's automated (non-reply) announcements: `LORE_ARCHIVE_CHANNEL_ID`, `PLAYER_UPDATES_CHANNEL_ID`, and `WELCOME_CHANNEL_ID` (kept as a documented reference point, not a posting target).
- `utils/notificationRouter.js` — `announceLoreEntry()` and `announcePlayerProgression()`, following the same fetch-and-send-with-graceful-failure pattern already established by `utils/adminLogger.js`. Adding a new announcement type going forward is one new config constant + one new function here.
### Discovered, not fixed
- `services/casinoAnnouncerService.js` uses the identical `guild.systemChannel`-guessing pattern that caused the Lore Archive bug, for big-win announcements. Very likely also currently posting to the Welcome channel. No destination channel ID was specified for this one, so it wasn't redirected on a guess — see [KNOWN_ISSUES.md](KNOWN_ISSUES.md), now a one-line fix once a destination is confirmed.
### Testing
- Full command/module load regression (102 commands, 227 modules, zero errors).
- `notificationRouter.js` tested directly against mocked channel fetches, including a deliberate "channel unreachable" case to confirm graceful failure (no throw).
- `schedulers/loreBroadcast.js`'s actual `broadcastToGuild()` run end-to-end against a seeded lore entry and a mocked client — confirmed it posts to the Lore Archive channel and never touches the Welcome channel.
- `events/messageCreate.js`'s actual `execute()` run end-to-end for a simulated level-up (which also triggered a level-based achievement), with the mock's `message.channel` rigged to throw if ever called — confirming zero fallback to the old per-channel behavior.
### Notes
- Full details in [docs/updates/2026-07-29-notification-routing-audit.md](updates/2026-07-29-notification-routing-audit.md).
- No changes to XP amounts, level thresholds, achievement requirements, or reward values — only where the resulting announcements get posted.

## Robbery System Audit & Completion — 2026-07-29
### Fixed
- **Root cause of "/rob silently stops after the victim responds":** the Discord client was missing the `GatewayIntentBits.DirectMessages` intent and the `Partials.Channel` partial. The bot could send the victim's DM fine (sending never needed these), but without them the DM channel stays uncached, which breaks `Message#awaitMessageComponent()`'s ability to reliably deliver the victim's button click back to the collector — a well-documented discord.js v14 gotcha. Added both to `bot.js`.
- **Two negative-balance bugs in the robbery economy**, found via direct testing of all 7 outcome branches:
  - `hidden_cash` paid a flat 40,000 coins regardless of the victim's actual balance — a victim at the 1,000-coin minimum could be driven to -39,000.
  - `arrested` fines (up to 64,000 at max heat with a witness report) ignored the robber's actual balance — a robber at the 100-coin minimum bet could be driven to -63,900.
  - Both are now clamped to the paying party's real balance in `services/robberyCalculator.js`, the same way normal percentage-based loot already was via `estimateLootRange()`.
### Added
- The victim now receives an actual result DM when the robbery resolves (`robberyVictimResultDMEmbed`, victim-perspective title/description added to `data/robberyOutcomes.js`) — previously their DM only ever showed "✅ Response received." with no indication of what happened.
- A brief "🎲 Rolling the Outcome..." suspense beat (`robberyRollingEmbed`) in the origin channel between the victim's response and the final reveal.
### Testing
- Full `/rob` flow simulated end-to-end with a mocked Discord interaction (scan → estimate → proceed → execution → victim DM → click → resolve → final embed) across all 4 victim responses, a timeout, and a DMs-closed case — zero exceptions, correct coin conservation in every run.
- All 7 outcome branches (`perfect`, `success`, `hidden_cash`, `wallet_empty`, `escaped`, `defended`, `arrested`) tested directly through the embed builders and coin-effect arithmetic.
- Targeted edge-case tests reproduced both negative-balance bugs pre-fix and confirmed the clamp fixes hold post-fix (balances land at exactly 0, never below).
### Notes
- Full details in [docs/updates/2026-07-29-robbery-audit.md](updates/2026-07-29-robbery-audit.md).
- No changes to bet limits, success-chance formulas, loot percentages, cooldowns, or any other existing balance numbers — only the two out-of-bounds edge cases above were touched.

## Maintenance & Cleanup Sprint — 2026-07-29
### Fixed
- Removed a stale, out-of-date duplicate `database.js` at the project root (missing the casino expansion, `tic_challenges`, and numerology tables present in the real `database/database.js`). Nothing required it; it was dead weight that risked confusing a future edit.
- Removed 20 confirmed-unused imports across `services/`, `utils/`, `social-engine/`, and several `commands/casino/*` and `commands/activities/*` files (verified individually — not a blind regex pass).
- Removed unused `sqlite3` dependency from `package.json`. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
### Changed
- Consolidated three duplicate `sleep()`/`capitalize()` helper implementations in the social-engine module into the existing shared `social-engine/utils/helpers.js`.
- Archived `docs/README_FIX.md` → `docs/updates/LORE_MONGODB_TO_SQLITE_MIGRATION.md` with a historical-status header, since the patch it describes is already fully merged.
- Corrected several docs that referred to `database.js` where they meant `database/database.js` (AI_CONTEXT.md, ARCHITECTURE.md, DATABASE.md).
### Removed
- Orphaned root-level `testStats.js` manual test script (unreferenced anywhere).
### Notes
- Full details in [docs/updates/2026-07-29-maintenance-cleanup.md](updates/2026-07-29-maintenance-cleanup.md).
- No gameplay, economy, database schema, or command-facing behavior changed. All 102 commands and 225 modules verified to load with zero errors before and after this sprint.

## Lore System — SQLite Migration
### Fixed
- `/lore` was throwing `MongooseError: buffering timed out` — the bot never connected to MongoDB anywhere; every other feature already ran on the local SQLite database. Migrated the entire lore feature onto `better-sqlite3` (new `lore` table, `services/loreService.js` rewritten).
- `archive_number` was globally unique instead of per-guild, which would break the moment a second guild used the feature. Fixed to a compound unique index on `(guild_id, archive_number)`.
- Broadcast channel picker didn't check bot permissions before posting, causing silent failures. Now checks `ViewChannel`+`SendMessages` first.
- `/lore approve` went from a stubbed-out TODO to a real Accept/Reject button flow.


## Casino System — Initial Build (Phases 1-3)
### Added
- `/casino` hub, `/blackjack`, `/dice`, `/highlow`, `/horse`, `/roulette`, `/poker`, `/slots` (3 machines)
- NPC dealers (Frank, Luca, Old Tom, Silas, Lucy)
- Progressive jackpot, daily lucky number, casino achievements

## Slots UX Upgrade
### Changed
- `/slots` rebuilt from a one-shot spin into a real session (setup → up to 5 spins on one message → cooldown → summary), matching what would later become the template for every other casino game.

## Session Upgrade — All Games
### Changed
- Roulette, horse racing, blackjack, dice, high/low, and poker all rebuilt onto the same session pattern slots introduced.
- Random-duration cooldowns (weighted tiers) replace fixed 60-second cooldowns, for every game except slots (which kept its original fixed cooldown as the "template" version).

## Casino Architecture Upgrade — XP, Ranks, History, Achievements
### Added
- Casino XP/rank system (Visitor → Casino Legend), `/casino history`, `/casino achievements`, richer `/casino passport`.
### Changed
- `/casino vip` now shows the new XP-based rank instead of the older wagered-threshold VIP system (`vipService.js` — kept in the codebase, just no longer wired into any command).
### Fixed
- Real `Fixed cooldown bypass via leave/re-enter` bug — cooldowns lived in a local variable, resetting every time a session command re-ran. Moved to a persistent `casino_cooldowns` table checked *before* a session's setup screen even shows.

## Quest Hub
### Added
- `/quest hub` — paginated Quest Board, Activities list, History placeholder — alongside (not replacing) the original `/quest start`/`active`/`leave`/`abandon` and `/quests`.
- 7 side activities (`/mine`, `/chop`, `/dig`, `/farm`, `/build`, `/nether`, `/end`) with persistent cooldowns.
- `category`/`difficulty`/`emoji` fields added to all 14 existing quests (additive, no existing fields touched).

## High/Low Fix & Progressive 3-Card Poker
### Fixed
- High/Low's dealer card was only ever shown on round 1 — after that, players were guessing against a dealer card that had already been silently redrawn but never displayed. Added an explicit "awaiting guess" state so a fresh card is always shown before Higher/Lower becomes clickable again.
### Changed
- Poker rebuilt from a self-hand-strength-only payout table into real Progressive 3-Card Poker with an actual dealt, hidden-until-showdown dealer hand, and a genuine Bet/Check/Fold decision at each of 3 reveal stages.
### Known issue introduced
- The new poker payout table, applied against real dealer comparison instead of unconditionally, pays out ~126% of what's wagered on average — flagged, not yet fixed (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)).

## Casino Expansion — Fortune Reels, Mega Slots, Tic Tac Toe, Memory Vault
### Added
- 2 new slot machines (5-reel, 3×3 grid), `/tic` (house AI + real PvP wagering), `/memory` (3 difficulties).
### Fixed (caught via simulation before shipping)
- Mega Slots' original payout table simulated to a 47.67x average return — an infinite-money bug, not a balance nitpick. Fixed (removed the 2-of-3 payout tier entirely, cut triple payouts ~30x) to 0.609x, in line with Classic Slots' 0.633x baseline.
- Fortune Reels' original table simulated to 5.27x; fixed to 0.569x the same way.
- **Found but not fixed (out of scope that round):** Kingdom Slots — built earlier, untouched this round — has its own pre-existing 7.46x EV bug, discovered only because a "healthy EV" baseline was being established for comparison.
- Memory Vault's settlement math had a real bug: `addCoins(userId, username, reward.coins - bet + bet)` always simplifies to just `reward.coins` — the bet was never actually deducted. Fixed to the real net change.

## Tic Tac Toe & Memory Vault UX Fixes (Round 1)
### Fixed
- Memory Vault's board never actually showed a mismatched flip — `flipCard()` cleared the mismatch positions before the board ever rendered them. Redesigned the state model (`matched[]` permanent vs. `pendingFlips` temporary) so a mismatch genuinely displays for ~1.5s before flipping back.
- Replaced Memory Vault's dropdown-based cell picking with real buttons, paginated for Hard mode's 36 cells (exceeds Discord's component limits).

## "Missing Table" Investigation (Round 2)
### Investigated, root cause corrected
- A bug report described `no such column: tic_games` / `no such column: memory_games` as missing *tables*. The actual cause: `casinoStatsService.recordBet()` builds column names dynamically (`${game}_games`/`${game}_wins`), and `tic`/`memory`'s columns were never added to the existing `casino_stats` migration when those games shipped. Fixed with 2 lines in the existing migration — no new table, no command-file changes needed.
- The report's other two claims (button layout, flip timing) turned out to already be fixed from the previous round — confirmed by re-checking the actual uploaded code rather than assuming the report was accurate.

## Tic Tac Toe AI & Memory Vault Layout (Round 3)
### Changed
- Tic Tac Toe's AI was fully deterministic given a board state (exploitable with a fixed opening) — added a 40% chance of a non-optimal move (never sacrificing a real win/block) and a 50% chance the house opens with a random move.
### Fixed
- Memory Vault's button grid was hardcoded to 5-wide rows regardless of difficulty — Easy's 4×4 board rendered as visually mismatched 5-wide rows. Fixed to compute row width from the actual board size.

## User Context Menu Commands
### Added
- 21 context menu commands (right-click → Apps → WhisperBot) covering 3 architecturally distinct groups of existing social commands (target-based, simple-response, and the bespoke two-target `/ship`).
### Fixed
- `events/interactionCreate.js` had zero handling for `isUserContextMenuCommand()` — every context command would have registered correctly and then silently failed on click. One-line dispatcher fix.
### Changed
- Discord caps USER context commands at 15/guild — only 15 of the 21 built commands are actually deployed (`deploy-commands.js`'s `CONTEXT_COMMAND_ALLOWLIST`), user-selected. The other 6 still work as their original slash commands.

## Documentation Overhaul
### Added
- This documentation set — `docs/README.md`, `COMMANDS.md`, `ARCHITECTURE.md`, `SYSTEM_MAP.md`, `DATABASE.md`, `FEATURES.md`, `DEVELOPMENT.md`, `AI_CONTEXT.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`, `FUTURE_PLANS.md` — generated from a direct audit of the actual codebase rather than from a plan.

---

## Known Issues (as of this changelog)
See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for full detail. Headline items: Poker's payout table needs rebalancing (~126% average return), Kingdom Slots has an unresolved 7.46x EV bug, 6 activity commands are unconfigured, `commandHandler.js`'s single un-typed command Map is a latent (currently safe) collision risk.
