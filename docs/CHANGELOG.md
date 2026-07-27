# 📜 Changelog

Reconstructed from this project's actual development history — real rounds of work, real bugs found and fixed, in order. Dates approximate where not explicitly recorded.

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
