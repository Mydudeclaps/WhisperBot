# 🛠️ WhisperBot Developer Guide

## Adding a New Slash Command

1. Create a file in the appropriate `commands/<folder>/` — folder is purely organizational, doesn't affect registration.
2. Export `{ data: new SlashCommandBuilder()..., async execute(interaction) {...} }`.
3. If it's a casino game, follow the session pattern (setup → play loop → cooldown) — see any existing file in `commands/casino/` as a template, and reuse `utils/casinoSessionUI.js` for bet-select rows/start buttons rather than rebuilding them.
4. **If it's a new casino game**, add `${name}_games`/`${name}_wins` columns to the `casino_stats` self-healing migration in `database/database.js`. Skipping this step is the single most common real bug in this codebase's history — it's happened twice (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)) and produces a `no such column` error the moment a session tries to settle, not at load time, so it's easy to miss until someone actually plays the game.
5. Run `node deploy-commands.js`.
6. Test (see "Testing Practice" below before touching a real Discord connection).

## Adding a User Context Menu Command

1. Create a file in `commands/context/`.
2. `data: new ContextMenuCommandBuilder().setName(displayName).setType(ApplicationCommandType.User)` — display names can have spaces/mixed case, unlike slash command names.
3. Target is `interaction.targetUser`, not `interaction.options.getUser(...)` (context menus have no options object).
4. **Reuse the underlying slash command's logic** — don't duplicate it. If the slash command doesn't already expose its core logic as a separate function, extract it first (see `social-engine/engine/SocialCommandRunner.js`'s `runTargetInteraction()` for the pattern: pull everything after "target is known" into a standalone async function both the slash and context versions call).
5. **Check Discord's 15-per-guild USER command limit before adding a new one to `deploy-commands.js`'s `CONTEXT_COMMAND_ALLOWLIST`.** Currently at exactly 15/15 — adding a 16th means removing one of the current 15 first, or the deploy script's built-in guard will refuse to run (by design, to avoid a partial/failed bulk command overwrite that could also affect your slash commands, since they're submitted in the same request).
6. Verify `events/interactionCreate.js`'s guard still includes `isUserContextMenuCommand()` — if this ever regresses, every context command will register successfully and then silently fail on click with zero server-side error to debug from. This exact bug existed in this codebase until it was found and fixed.

## Adding a New Feature

1. Check if it extends an existing system first (casino, social engine, activities, quests) before building something parallel.
2. If genuinely new, follow the casino's proven pattern: config in `config/` or `data/`, logic in a `services/*.js` file, commands as thin wrappers calling the service, embeds added to `utils/embedFactory.js` rather than built inline.
3. Add database tables via `database/database.js`'s existing self-healing pattern — `CREATE TABLE IF NOT EXISTS` for new tables, `ALTER TABLE ADD COLUMN` wrapped in try/catch for new columns on existing tables.
4. Register commands, run `node deploy-commands.js`.
5. Update documentation (this folder).
6. Test regression — see below.

## Coding Standards

- **Naming:** camelCase for variables/functions, kebab-case-free file names (mostly `camelCase.js` or `lowercase.js` in this codebase — not strictly kebab-case, worth matching whatever the surrounding folder already does rather than a fixed universal rule)
- **Error handling:** try/catch with a graceful fallback embed, never let a command throw uncaught into `interactionCreate.js`'s generic "❌ Command error occurred" (that's a safety net, not a first line of defense)
- **Comments:** explain *why*, not *what* — this codebase's existing comments consistently explain the reasoning behind a design choice or the bug a piece of code fixes, not just restate the code in prose
- **Embeds:** go through `utils/embedFactory.js` — win=green, loss=red, jackpot=gold, neutral=blue is the established casino convention
- **Database:** prepared statements only (`db.prepare(...).run()/.get()/.all()`), never string-interpolated user input into SQL
- **Cooldowns:** must be database-backed (`casino_cooldowns`/`activity_cooldowns` pattern), never a local variable or `setTimeout` — this has been a real, shipped bug more than once

## Testing Practice (established across this project's actual development)

Run `npm test` for the automated marketplace/crate transaction suite and `npm run check` for the full Discord command graph and crate configuration validation. Broader systems still use the established focused verification practice below:

1. **Syntax check every touched file:** `node --check path/to/file.js`
2. **Require-graph test:** actually `require()` every touched module (and anything that imports it) to catch missing-import errors that `--check` alone won't find
3. **Full command loader test:** replicate what `handlers/commandHandler.js` does — loop every file in every `commands/` subfolder, `require()` it, call `.data.toJSON()` (catches malformed Discord API payloads before Discord ever sees them), and check for name collisions across the whole set
4. **Functional tests where it matters:** for anything with real game math (payout tables, hand comparisons, cooldown distributions), actually run the logic hundreds or thousands of times and check the results, not just that it doesn't crash. This is how the slots EV bug and the poker hand-comparison logic were caught — reading the code wouldn't have surfaced either.
5. **Mocked interaction tests** for command `execute()` functions — a plain JS object with `user`, `targetUser`, `deferReply`/`editReply`/`fetchReply` stubs is usually enough to exercise the real logic without a live Discord connection.

### The `better-sqlite3` problem
The committed native binary in `node_modules/better-sqlite3` is **Windows-built**. It will not load on Linux/macOS (`ERR_DLOPEN_FAILED`). To test database-touching code on a non-Windows machine: swap in a shim backed by Node's built-in `node:sqlite` module (same `prepare().run()/get()/all()` + `exec()` surface as `better-sqlite3`, close enough to be a drop-in for testing purposes) — **swap it back to the real binary before packaging anything for delivery**, and verify the swap-back actually worked by attempting to instantiate a real `Database()` and confirming you get `ERR_DLOPEN_FAILED` again (proves it's genuinely the Windows binary, not an accidentally-still-active shim). This exact mistake — forgetting to fully restore the real binary, or losing it entirely with a careless `rm -rf` — has actually happened during this project's development. Always back up the real binary with `mv`, never delete it outright until the replacement is verified working.

## Where NOT to make changes without a real reason
- `casinoService.js`, `casinoStatsService.js` — extend, don't bypass
- `database/database.js` — additive migrations only, never `DROP`/destructive `ALTER`
- Existing game logic in `blackjackService.js`, `pokerService.js`, etc. — these have been carefully tested; if fixing a UI/UX issue, isolate the change to the command file's rendering, not the underlying game math, unless the math itself is the bug
