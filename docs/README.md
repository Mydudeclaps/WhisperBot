# 🕊️ WhisperBot Atlas

## Documentation Version

**Version:** 1.0
**Last Updated:** 2026-07-26
**Generated From:** Direct audit of the actual source tree (file listings, `grep`'d table/command names, and first-hand knowledge of systems built across this project's development) — not from assumptions. See [AI_CONTEXT.md](AI_CONTEXT.md) for exactly how confident this documentation is about each system.
**Maintainer:** Project Owner

---

## Overview

WhisperBot is a cinematic Discord bot built for the **WhisperSMP** community — a Minecraft server organized around four fantasy kingdoms (North, East, South, West). It's not a generic utility bot; nearly every feature is written to feel like part of a living world: NPC dealers with personalities, a "Whisper Archives" lore system, kingdom-flavored economy, and a full casino built as an actual game platform rather than a handful of gambling commands bolted on.

**Technology stack:**
- **Runtime:** Node.js, [discord.js v14](https://discord.js.org/) (`^14.27.0`)
- **Database:** SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (`^12.11.1`) — one file, `whisperbot.db`, 25 tables, self-healing migrations on every boot
- **Scheduling:** `node-cron` (lore broadcast) + a `setInterval`-based daily reset and hourly cooldown cleanup
- **Host:** Windows (the committed `better-sqlite3` native binary is Windows-built — see [DEVELOPMENT.md](DEVELOPMENT.md) for why this matters if you ever run this on Linux/macOS)

**Current development status:** Actively developed, in real use. The casino system in particular has been through several rounds of real bug fixes (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) and [CHANGELOG.md](CHANGELOG.md) for specifics) — this isn't a "finished, never-touched-again" codebase, and this documentation set is meant to be updated again the next time something changes.

**Note on `package.json`:** it used to list both `better-sqlite3` and an unused `sqlite3` package. `sqlite3` was removed in the 2026-07-29 maintenance sprint (verified: zero `require("sqlite3")` anywhere in the source tree) — `better-sqlite3` is the only SQLite driver in use.

---

## Documentation

- [Commands → COMMANDS.md](COMMANDS.md) — every command, generated from the actual command files, organized by folder
- [Architecture → ARCHITECTURE.md](ARCHITECTURE.md) — file structure, file ownership, system flow
- [System Map → SYSTEM_MAP.md](SYSTEM_MAP.md) — visual diagrams of how systems connect
- [Database → DATABASE.md](DATABASE.md) — all 25 tables, generated from `database/database.js`
- [Features → FEATURES.md](FEATURES.md) — every major system explained in depth
- [Development → DEVELOPMENT.md](DEVELOPMENT.md) — how to add commands/features, coding standards
- [AI Context → AI_CONTEXT.md](AI_CONTEXT.md) — **read this first if you're an AI agent about to modify this codebase**
- [Changelog → CHANGELOG.md](CHANGELOG.md) — update history
- [Known Issues → KNOWN_ISSUES.md](KNOWN_ISSUES.md) — live bugs and technical debt
- [Future Plans → FUTURE_PLANS.md](FUTURE_PLANS.md) — planned/unfinished features

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables (.env in project root)
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_test_guild_id

# 3. Register slash + context menu commands (guild-scoped, updates instantly)
node deploy-commands.js

# 4. Start the bot
node bot.js
```

**Development workflow:** this project has no test framework or CI. The established practice (see [AI_CONTEXT.md](AI_CONTEXT.md)) is: syntax-check every touched file (`node --check`), require-load every touched module to catch missing-import errors, and run the full command loader against every file in `commands/` to catch name collisions and Discord API serialization errors — all before ever touching a real Discord connection. Since `better-sqlite3`'s committed binary is Windows-only, testing on a non-Windows machine requires swapping in a `node:sqlite`-backed shim (see [DEVELOPMENT.md](DEVELOPMENT.md)).
