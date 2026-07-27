# Fix: `/lore` MongoDB timeout

## Root cause

`MongooseError: Operation lores.findOne() buffering timed out` wasn't a
connection-timing bug — your bot never connects to MongoDB at all. Every
other feature (`users`, `daily_streak`, kingdoms, casino, etc.) reads and
writes to `whisperbot.db`, a local SQLite file, via `better-sqlite3`. Only
the lore feature was built on Mongoose/MongoDB, which nothing in your
`.env` or `bot.js` ever sets up. Mongoose queued the query in its buffer
waiting for a connection that was never coming, and gave up after 10s.

The suggestions in the console-error writeup (add `mongoose.connect`,
check `MONGODB_URI`) would work, but they'd mean standing up an entire
separate MongoDB server just for one feature. Instead, this fix moves
the lore feature onto the SQLite database your bot already uses — no new
service to run, no new env vars.

## What's in this patch

```
database/database.js           # adds a `lore` table + indexes to your existing SQLite db
services/loreService.js         # rewritten to use better-sqlite3 instead of Mongoose
utils/loreUtils.js              # updated to match new field names (archive_number, submitted_at)
commands/lore/lore.js           # same, plus entry.id instead of entry._id
schedulers/loreBroadcast.js     # same field-name updates
utils/loreInteractionHandler.js # same, plus converts button entryId to a number for SQLite
events/interactionCreate.js     # routes lore_approve:*/lore_reject:* buttons to the handler above
bot.js                          # starts the lore broadcast scheduler once the client is ready
package.json                    # removed the now-unused "mongoose" dependency
```

## How to apply

1. **Copy these files into your project**, overwriting the existing ones at the same paths.
2. **Delete `models/Lore.js`** — it was the Mongoose schema and is no longer used by anything.
3. **Run `npm install`** to drop `mongoose` from `node_modules` (safe — nothing else in the project used it; confirmed by search).
4. Start the bot normally. The `lore` table is created automatically the first time `database/database.js` runs (same self-healing pattern your other tables already use), so there's no manual migration step.
5. Run `/lore submit`, then `/lore approve` as a moderator (needs Manage Messages) to test the new Approve/Reject buttons, then `/lore random`.

## Behavior notes / small differences from before

- **`/lore search` is now a substring match** (`LIKE '%query%'`) instead of MongoDB's `$text` full-text search — SQLite doesn't have that out of the box. Fine for casual searching; let me know if you want real full-text search (SQLite's FTS5 extension can do it, just a bit more setup).
- **`/lore approve` now actually works.** The original spec left the approve/reject buttons as a "could implement this" TODO — this patch wires them up for real, via `utils/loreInteractionHandler.js` and a new branch in `events/interactionCreate.js` (following the same pattern your `bet_*` buttons already use).
- Entry IDs are now plain SQLite integers (`entry.id`) instead of Mongo ObjectIds (`entry._id`), and field names use snake_case (`archive_number`, `submitted_at`) to match the rest of your database's column naming.

I tested the schema and every query in `loreService.js` directly (submit, approve, random, latest/oldest, search, stats, pending, legendary/broadcast tracking, and the per-guild archive-number uniqueness) before handing this back — all passing.
