# 🤖 AI Context — How To Think About WhisperBot

Read this before touching anything. It's written from direct experience building and fixing this codebase across many rounds of real development, not from a plan or spec.

---

## Project Philosophy

WhisperBot is not a collection of commands — it's meant to feel like a living world. NPC dealers have personalities, lore is anonymous and community-written, the casino has its own economy that needs to stay balanced, not just "work." When adding to this codebase, match that tone (see any existing embed or NPC line for the register), not generic bot-speak.

---

## Confidence levels in this documentation set

Be honest with yourself about this, the same way this documentation tries to be honest with you:

**Deeply verified, built and tested directly, high confidence:** the entire casino system, the quest hub, the lore system's SQLite migration, the activity system, the social engine's context-menu refactor. These sections of the docs reflect code that was actually run (via a `node:sqlite` shim) and checked against real output, not just read.

**Structurally verified but not deeply audited:** kingdom system internals, shop-engine internals, admin tool internals, robbery system internals, the `services/embedBuilder/` and `services/events/` subfolders. Their existence, file names, and general purpose (from names + brief spot-checks of command descriptions) are confirmed accurate. Their exact internal logic has not been read line-by-line. If you're about to modify one of these, **read the actual file first** — don't trust a one-line summary in FEATURES.md as if it were a full audit.

**Known gaps, called out explicitly rather than papered over:**
- 6 of 13 activity commands (`hunt`, `magic`, `monster`, `museum`, `shipwreck`, `treasure`) have no matching `data/activities.js` config — they exist, load fine, and do nothing useful. Nobody has decided whether to finish these or remove them.
- `models/` folder is empty (leftover from a since-removed MongoDB-based lore system).
- `vipService.js` (wagered-threshold VIP ranks) is fully functional but unused — superseded by the XP-based casino rank system, kept in case it's wanted for something else later.
- ~~`package.json` lists `sqlite3` as a dependency; nothing uses it. Only `better-sqlite3` is real.~~ Removed in the 2026-07-29 maintenance sprint.

---

## Core Principles

1. **Preserve existing systems** — never rewrite working code to "clean it up" unless asked. Extend it.
2. **Extend patterns, don't invent parallel ones** — before writing a new cooldown system, economy hook, or XP grant, check whether `casinoService`/`coinService`/`xpService` already does it. It almost certainly does.
3. **Audit before changing.** Every time this codebase has been handed a bug report in this project's history, checking the actual code first (rather than trusting the report's diagnosis) has mattered — several reports described symptoms accurately but misdiagnosed the cause (a "missing table" that was actually a missing column; a claimed bug that turned out to already be fixed; error messages that didn't match any code path in the actual file). **Verify against real code before writing a fix**, every time, no exceptions.
4. **Test by running, not by reading.** Reading code doesn't catch a payout table that mathematically pays out 47x what's wagered, or a hand-comparison function that's subtly wrong on tiebreaks. Actually running the logic hundreds of times and checking real numbers has caught real, serious bugs that a code review alone would have missed.
5. **Document what you find, not what you expect to find.** If a codebase audit surfaces something unexpected — extra files, a naming collision, a table nobody reads — say so plainly rather than silently working around it or ignoring it.

---

## Hard-won lessons from this project's actual history

These aren't hypothetical warnings — each of these is something that actually happened during development:

- **A cooldown stored in a local variable is not a cooldown.** It resets the instant the command re-runs. Both `casino_cooldowns` and `activity_cooldowns` exist specifically because this was shipped, reported, and fixed.
- **Dynamic column names need matching migrations.** `casinoStatsService.recordBet(userId, game, ...)` builds `${game}_games`/`${game}_wins` as a template string. Add a new casino game without adding its two columns to `database/database.js`'s migration list, and the bug won't surface until someone actually finishes a session — not at load time, not at command-registration time. This has happened twice.
- **A feature can register with Discord perfectly and still be completely broken.** All 21 context menu commands worked correctly at the "Discord shows them in the menu" level while `events/interactionCreate.js` had zero code path for `isUserContextMenuCommand()` — every click would have silently failed with no server-side error at all. The only way to catch this was tracing the actual dispatch logic, not looking at the command files themselves.
- **Platform limits are real constraints, not suggestions.** Discord caps USER context commands at 15/guild. A docs search initially surfaced an outdated "5" figure from a third-party library's documentation before a fetch of Discord's own current developer docs gave the real number. When a platform limit matters, verify it against the primary source, not a cached number, and don't assume old training data is current.
- **Simulate economy math before shipping, every time.** Slot machine payout tables, poker payout math, memory vault reward formulas — every one of these has had at least one real, serious bug caught only by running thousands of simulated plays and checking the actual average return, not by reading the numbers and eyeballing whether they look reasonable.
- **When testing requires a platform-specific native module you can't run here, say so and work around it properly** — don't silently skip testing. This codebase's `better-sqlite3` binary is Windows-only; testing here means a temporary `node:sqlite`-backed shim, always fully restored and *verified* restored (not just assumed) before anything ships.

---

## AI Development Protocol

When modifying WhisperBot:
1. Inspect the actual current code before editing — don't trust a prior summary, including this one, without spot-checking it.
2. Understand the existing pattern for whatever you're touching before adding to it.
3. Avoid duplicate systems — search for whether the thing you're about to build already exists first.
4. Extend services instead of creating parallel logic.
5. Update documentation after changes — this file included, if the change affects how future agents should think about the project.
6. Test by running the code, not just reading it.
7. Explain architectural decisions and trade-offs in your response, especially when a request's assumptions don't match the real codebase — say so plainly rather than silently reinterpreting the request to fit.

## Critical Systems — Handle With Care

### `casinoService.js` / `casinoStatsService.js`
Central managers for casino sessions, cooldowns, XP, history. Extend, don't bypass — and remember `recordBet()`'s dynamic column naming (above) any time a new game is added.

### `database/database.js`
Self-healing migrations on every boot. Never delete existing tables or columns — every change in this file's history has been additive.

### `embedFactory.js`
Consistent visual identity (win=green, loss=red, jackpot=gold). New embed types belong here, not built inline in a command file.

### `events/interactionCreate.js`
The entire interaction dispatch pipeline. If a new interaction *type* is ever added to Discord's API (or discord.js exposes a new one this bot wants to use), check whether this file's top-level guard needs extending — the context-menu gap above is exactly this class of bug.

## Where To Add New Features
1. Check if it extends an existing system first.
2. If genuinely new, follow the casino's proven shape: config → service → thin command wrapper → embed helper.
3. Add to documentation.
4. Test regression on everything adjacent, not just the new feature.
