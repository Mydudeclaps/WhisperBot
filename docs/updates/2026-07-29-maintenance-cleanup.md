# WhisperBot Maintenance & Cleanup Sprint — 2026-07-29

## Summary

A full-codebase audit and cleanup pass across all 392 tracked files (commands,
services, utils, social-engine, shop-engine, events, handlers, config, data,
docs). Goal was to leave WhisperBot cleaner and more maintainable **without
changing any user-facing behavior** — no gameplay, economy, database schema,
or command changes.

The codebase was already in good shape. No syntax errors, no broken requires,
no command-name collisions were found anywhere. The bulk of this sprint was
removing dead files, unused imports, and duplicate helper functions, plus
syncing documentation that had drifted slightly out of date.

Every command (102) and every supporting module (225 total files across
`services/`, `utils/`, `shop-engine/`, `social-engine/`, `handlers/`,
`schedulers/`, `config/`, `data/`, plus all 4 `events/`) was `require()`-loaded
successfully both before and after every change in this sprint, using a
temporary `node:sqlite`-backed shim in place of the Windows-native
`better-sqlite3` binary (this environment's sandbox can't load the real
Windows `.node` binary — the project's own `DEVELOPMENT.md` documents this
exact workaround). The shim was only ever used in an isolated copy of the
project for testing; the real Windows binary shipped in this delivery is
untouched and was verified intact (`file` confirms it's still a Windows
PE32+ DLL) before packaging.

## Files Modified

**Removed:**
- `database.js` (root) — stale duplicate, see Bug Fixes
- `testStats.js` (root) — orphaned manual test script

**Moved:**
- `docs/README_FIX.md` → `docs/updates/LORE_MONGODB_TO_SQLITE_MIGRATION.md`

**Edited (unused-import cleanup only, no logic changes):**
- `services/dailyResetService.js`
- `services/raceService.js`
- `services/numerologyService.js`
- `services/achievementService.js`
- `social-engine/engine/StoryBuilder.js`
- `social-engine/engine/SimpleResponseRunner.js`
- `social-engine/engine/SocialCommandRunner.js`
- `social-engine/engine/SocialEmbedBuilder.js`
- `social-engine/utils/helpers.js`
- `utils/numerologyMessageHandler.js`
- `utils/embedFactory.js`
- `utils/ticPvpInteractionHandler.js`
- `commands/admin/numerology.js`
- `commands/economy/racebet.js`
- `commands/casino/dice.js`
- `commands/casino/highlow.js`
- `commands/casino/roulette.js`
- `commands/casino/slots.js`
- `commands/casino/tic.js`
- `commands/activities/build.js`, `chop.js`, `dig.js`, `end.js`, `farm.js`,
  `hunt.js`, `magic.js`, `mine.js`, `monster.js`, `museum.js`, `nether.js`,
  `shipwreck.js`, `treasure.js` (all 13 — identical unused `MessageFlags`
  import, evidently copy-pasted from a shared template)
- `package.json` — removed unused `sqlite3` dependency

**Documentation updated:**
- `docs/CHANGELOG.md`
- `docs/KNOWN_ISSUES.md`
- `docs/AI_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/README.md`
- `docs/updates/LORE_MONGODB_TO_SQLITE_MIGRATION.md` (new location, added
  historical-status header)

## Improvements Made

- **Removed 20 confirmed-unused imports.** Found via a heuristic scan (regex
  for `const x = require(...)` / `const { a, b } = require(...)` followed by
  a usage-count check), then **every single hit was manually verified** by
  grepping the full file before touching it — the heuristic had a few false
  positives (e.g. renamed destructures like `const { contribute:
  contributeJackpot }`) that were correctly left alone. Nothing was removed
  on the strength of the regex alone.
- **Consolidated 3 duplicate helper functions.** `sleep()` was defined
  identically in `SimpleResponseRunner.js` and `SocialCommandRunner.js`;
  `capitalize()` was defined identically in `SimpleResponseRunner.js` and
  `SocialEmbedBuilder.js`. Both now live once in the social-engine's existing
  shared `utils/helpers.js` (which already held `pickRandom`,
  `pickRandomMany`, `fillTemplate`, `rollChance` — this was the established
  pattern, just under-used). All three call sites now import instead of
  redefining.
- **Removed an unused npm dependency** (`sqlite3`) that was never imported
  anywhere in the source tree — only `better-sqlite3` is actually used.
- **Doc/code drift fixed:** three docs (`AI_CONTEXT.md`, `ARCHITECTURE.md`,
  `DATABASE.md`) referred to the database module as `database.js`, which
  was ambiguous now that a second, stale `database.js` existed at the root.
  All three now say `database/database.js` explicitly.
- **Archived a stale "how to apply this patch" doc** (`README_FIX.md`) that
  described a fix already fully merged weeks/months ago, moved it into
  `docs/updates/` (where completed-work records belong) with a clear
  "already applied" header so it can't be mistaken for an outstanding task.

## Bug Fixes

No functional bugs were found or fixed this sprint — the codebase's own
`docs/KNOWN_ISSUES.md` already tracks the real outstanding bugs (poker payout
imbalance, Kingdom Slots EV bug, 6 unconfigured activity commands), and none
of those were in scope for a "preserve all existing functionality" cleanup
pass. What *was* fixed:

- A stale, incomplete duplicate of the database schema file
  (`database.js` at the project root) existed alongside the real,
  up-to-date `database/database.js`. It was missing entire table groups
  added since it was last synced (the full casino-expansion columns,
  `casino_horses`, `casino_history`, `casino_cooldowns`,
  `activity_cooldowns`, `activity_history`, `quest_history`,
  `tic_challenges`, and the entire Numerology schema). Confirmed via `diff`
  and a require-graph search that **nothing in the codebase ever required
  it** — every real reference resolves to `database/database.js` — so this
  was purely a latent trap for a future developer (or a future me) who might
  have edited the wrong file. Removed.

## Refactoring

- Helper consolidation described above under Improvements Made. This is the
  only structural change made this sprint — deliberately minimal, per the
  "don't rewrite working systems without a reason" rule. Two other
  duplicate-looking patterns were investigated and **deliberately left
  alone**:
  - `randomBetween()` is defined identically in `services/activityService.js`
    and `services/casinoService.js`. Small (3-line), pure, unlikely to
    diverge. Consolidating it would mean creating a new shared root-level
    `utils/helpers.js` for two call sites — judged not worth the
    (admittedly small) risk and churn for this pass. Noted below as a
    recommendation.
  - Several per-service helper names repeat across the codebase
    (`ensureRow`, `checkCooldown`, `clearCooldown`, `getStats`, etc.) but
    each is a private, table-specific implementation for that service's own
    schema — this is the established, intentional per-service pattern
    throughout the project, not accidental duplication.

## Documentation Updated

- `docs/CHANGELOG.md` — added this sprint's entry at the top
- `docs/KNOWN_ISSUES.md` — marked the empty `models/` folder and unused
  `sqlite3` dependency items resolved; left every other tracked issue as-is
  (still accurate, still unresolved, still correctly out of scope)
- `docs/AI_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md` —
  `database.js` → `database/database.js` precision fix
- `docs/README.md` — updated the `sqlite3` dependency note to reflect removal
- `docs/updates/LORE_MONGODB_TO_SQLITE_MIGRATION.md` — relocated from
  `docs/README_FIX.md`, added historical-status header

## Notes

- **`docs/KNOWN_ISSUES.md` remains the accurate source of truth** for real
  outstanding bugs and technical debt. Nothing in that file was resolved by
  this sprint except the two items noted above (empty `models/` folder,
  unused `sqlite3` dependency) — the poker/Kingdom Slots economy bugs and the
  6 unconfigured activity commands are unscoped feature/balance work and
  were correctly left untouched.
- **Recommendation (not implemented):** `handlers/commandHandler.js` stores
  every command — slash and context-menu alike — in one `Map` keyed only by
  `command.data.name`. `docs/KNOWN_ISSUES.md` already flags this as
  currently-safe-but-fragile (verified no actual collision across all 102
  commands today, since Map keys are case-sensitive and every context
  command's display name is capitalized while its slash equivalent is
  lowercase). Fixing it properly means keying by `${type}:${name}` in both
  `commandHandler.js` and the dispatch lookup in `events/interactionCreate.js`
  — a two-file change to the core dispatch path. Left alone this sprint
  since it's not causing any live problem and touching the dispatch path
  carries more risk than the cleanup items above; still worth doing in a
  dedicated round of work.
- **Recommendation (not implemented):** `randomBetween()` duplication between
  `activityService.js` and `casinoService.js` (see Refactoring above) — low
  priority, flagged for whenever a third caller shows up.
- **Recommendation (not implemented):** `docs/KNOWN_ISSUES.md`'s
  `highlow_stats` redundant-table item is still valid and still open —
  `services/highlowService.js` writes to both the legacy `highlow_stats`
  table and the real source-of-truth `casino_stats` columns. Not touched
  this sprint since it involves live casino-adjacent write paths, which
  falls outside a pure cleanup pass.
- `services/featureFlags.js` and `services/vipService.js` were checked and
  are **not** dead code to be removed — both are deliberately-kept
  forward-looking infrastructure (a hot-reloadable feature-flag system, and
  a wagered-threshold VIP system kept in reserve after the casino XP/rank
  system replaced it as the active one). Left exactly as-is.
