# 🚀 Future Plans

## Planned Features

### `/quest history` and `/activity history`
**Status:** 🚧 Planned (infrastructure exists, command doesn't)
**Description:** `quest_history` and `activity_history` tables have been recording every completion/use since they were created, specifically so a future history command would have real data to show rather than starting from zero. No command currently reads either table.
**Priority:** Medium
**Dependencies:** None — this is pure command-layer work on top of existing, populated tables.

### Seasonal Events
**Status:** 🚧 Planned (schema-only)
**Description:** `seasonal_events` table exists with a complete schema (name, date range, active flag, JSON data blob) but zero code references it — not even writes. Appears to be reserved from an early Social Engine design phase ("Phase 4" per an in-code comment) that was never built.
**Priority:** Low/Unknown — no indication of how important this is to the project owner.
**Dependencies:** Would need both a write path (something that activates/deactivates events) and a read path (something that changes behavior while an event is active) designed from scratch.

### Rebalanced Poker & Kingdom Slots economics
**Status:** ⚠️ Needed, not planned as a feature so much as required maintenance
**Description:** Both have confirmed, simulation-verified positive-EV bugs (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)). Not "future" in the sense of new functionality — existing functionality that needs its numbers fixed before heavy real-money-adjacent use.
**Priority:** High if the casino is in active use with real players; the bug drains the in-game economy with volume play.

### Configuring the 6 orphaned activities
**Status:** ⚠️ Incomplete — decision needed, not just implementation
**Description:** `hunt`, `magic`, `monster`, `museum`, `shipwreck`, `treasure` exist as command files with no matching config. Someone needs to decide whether these should be finished (write outcome tables, NPC lines, cooldown ranges for each in `data/activities.js`, following the pattern of the 7 working activities) or removed.
**Priority:** Medium — currently a confusing "why doesn't this work" experience for anyone who finds these commands.

### Real full-text search for `/lore search`
**Status:** 🚧 Planned (explicitly deferred, not forgotten)
**Description:** Current implementation is a `LIKE '%query%'` substring match (SQLite has no built-in full-text search the way MongoDB's `$text` did, which the original lore design used before migrating to SQLite). SQLite's FTS5 extension could provide real full-text search with some additional setup.
**Priority:** Low — substring matching is functional for casual use.

### Type-safe command dispatch (slash vs. context menu)
**Status:** 🚧 Planned (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) technical debt)
**Description:** `client.commands` is a single un-typed Map. Not currently causing problems, but worth fixing before it becomes a real collision.
**Priority:** Low urgency, but cheap to fix — a good "while you're in there" task alongside unrelated work in `commandHandler.js`.

---

## Ideas For Consideration

*(Not committed to, not scoped — genuinely just ideas, flagged as such and no more.)*

- A `/lore setchannel` admin command instead of the broadcast scheduler guessing at a postable channel every time.
- Extending the generic `achievements` table's unlock conditions to cover the Social Engine's currently-separate achievement system, so a player's "achievements" feel like one unified thing across casino and social rather than two parallel systems.
- A real deck-based (not independent-draw) card system for blackjack/poker/highlow, if card-counting-style mechanics or multi-hand games are ever wanted — everything currently draws cards independently with replacement, which is simpler but means there's no "deck" to actually deplete.
- A configurable house-edge target per casino game, computed and displayed to admins, rather than discovering the real EV only when someone thinks to simulate it (which is how both the slots and poker bugs were actually found).
