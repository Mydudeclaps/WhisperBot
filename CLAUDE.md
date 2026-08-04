# CLAUDE.md — WhisperBot

This is a thin index, not a duplicate of this project's own documentation.
This project's `docs/` folder is extensive, well-maintained, and graded by
its own confidence level — read it, don't re-derive it from this file.

Workspace-wide context (cross-project patterns, shared conventions) lives
in `~/Projects/AI/` — see `AI/CLAUDE.md` first if you haven't already.

## Purpose

The main Discord bot for WhisperSMP: utility, economy, casino, quests,
lore, kingdoms, social interactions, and Minecraft-themed activities.
Meant to feel like a living world with its own economy and characters, not
a command list — see `docs/PROJECT_VISION.md` for the full identity/tone
guide, and read it before adding any user-facing feature or text.

## Current Status

Active, shipping, git-tracked. Has real, currently-unresolved bugs — see
`docs/KNOWN_ISSUES.md` before assuming any casino game's payout math is
correct (two are confirmed broken: Progressive 3-Card Poker pays out
~126% of wagers; Kingdom Slots returns ~7.46x on average).

## Technology Stack

Node.js (CommonJS), discord.js v14, better-sqlite3, node-cron, dotenv. No
automated test suite — verification happens by running the logic, not by
a test runner (see `docs/AI_CONTEXT.md`).

## Architecture

Full breakdown, file-by-file ownership, and system flow diagrams:
**`docs/ARCHITECTURE.md`**. Short version: `config → service → thin
command wrapper → embed helper`, with `services/*.js` owning shared logic
and `utils/embedFactory.js` owning all embed styling.

## Important Files

- `docs/AI_CONTEXT.md` — **read this before touching anything.** Core
  principles, hard-won lessons from real development history, and which
  parts of the docs are deeply verified vs. only structurally checked.
- `docs/ARCHITECTURE.md` — file structure, core file ownership, system
  flow.
- `docs/KNOWN_ISSUES.md` — active bugs and technical debt, including two
  live, unfixed economy bugs. See also `AI/context/TECHNICAL_DEBT.md` for
  the cross-project-consolidated version, which includes a few items not
  yet in this file (Memory Vault Hard mode's completion bug, the
  `casinoAnnouncerService.js` channel-guessing risk).
- `docs/PROJECT_VISION.md` — identity, tone, design philosophy.
- `docs/DEVELOPMENT.md`, `docs/COMMANDS.md`, `docs/DATABASE.md`,
  `docs/SYSTEM_MAP.md`, `docs/FEATURES.md`, `docs/FUTURE_PLANS.md` —
  reference detail as needed.
- `docs/updates/` — dated audit trail of real work sessions. The technical
  content is credible and internally consistent; the day-by-day dating is
  a documentation narrative, not independently confirmed by git history
  (see `AI/VISION.md`'s documentation-trustworthiness note) — don't cite
  exact dates from here as verified fact.
- **`README.md` (this project's root, not `docs/README.md`) is a stale
  placeholder** — invite links and support-server links are literal
  placeholder text, and it lists `/bet` as a live command though
  `docs/CHANGELOG.md` records it as removed in favor of `/casino menu`.
  Don't treat it as current-state truth for anything.

## Development Rules

Full protocol in `docs/AI_CONTEXT.md`'s "AI Development Protocol" section.
The two rules most worth internalizing before making any change:

1. **Extend existing services, don't invent parallel ones** — check
   `casinoService`/`coinService`/`xpService`/etc. before building a new
   cooldown, economy hook, or XP grant.
2. **Test by running, not by reading** — especially anything touching
   payout math or persistent cooldowns. Multiple real, serious bugs here
   were only caught by simulation.

## Known Issues

See `docs/KNOWN_ISSUES.md` — do not treat this `CLAUDE.md` as current on
bug status; that file is the source of truth and is actively maintained.

## Future Roadmap

See `docs/FUTURE_PLANS.md`.
