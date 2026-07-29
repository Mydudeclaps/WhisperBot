# 🏹 Activity System Audit — Root Cause, Fix, and Startup Validation

## Deploy first
No new commands, but a real behavior change: **the bot will now refuse
to start if any activity's config is broken**, with a clear list of
every problem found. This is intentional (see Phase 4). No manual step
needed otherwise — just restart.

---

## 1. Exact root cause of the `/hunt` crash

**The object that was `null`:** `config`, on line 30 of the *original*
`hunt.js` — the result of a second, separate call to `getActivity("hunt")`
made specifically to build the error embed's title.

**Why it was `null`, traced start to finish:**
1. `hunt.js` had a command file, a working slash command definition, and
   `ACTIVITY_ID = "hunt"` — but `data/activities.js`'s registry had no
   `hunt` entry at all. Confirmed directly: only 7 of 13 activity command
   files (`mine`, `chop`, `dig`, `farm`, `build`, `nether`, `end`) had a
   matching registry entry before this fix.
2. `executeActivity(userId, username, "hunt")` correctly looked up
   `activities["hunt"]`, got `undefined`, and returned
   `{ error: "Activity not found." }` — this part never crashed.
3. Back in `hunt.js`, `result.error` was truthy, so it entered the error
   branch and called `getActivity("hunt")` **a second time**, purely to
   fetch a name for the embed title. `getActivity()` does
   `return activities[activityId] || null` — so this returned `null`
   (not `undefined` — the explicit `|| null` matters here).
4. `activityCooldownEmbed(config.name, ...)` — `config` is `null`,
   `.name` throws. Exact match to the reported stack trace
   (`hunt.js:30:67`).

**The true root cause is a missing content registration** (`hunt` never
added to `data/activities.js`), **compounded by a fragile pattern**
repeated identically across all 13 activity command files: every one of
them called `getActivity()` a second, redundant time after
`executeActivity()` had already done the real lookup — meaning any
future activity with the same "command file exists, registry entry
doesn't" mistake would crash exactly the same way, in exactly the same
place, regardless of which activity it was.

**Confirmed this reproduces**, not assumed: called `executeActivity()`
directly against a deliberately empty-outcomes activity before writing
any fix and got the same `Cannot read properties of undefined` shape of
error — same bug class, different trigger, proving this wasn't
`/hunt`-specific.

---

## 2. Files modified

| File | Change |
|---|---|
| `data/activities.js` | Added the 6 missing registry entries: `hunt`, `magic`, `monster`, `museum`, `shipwreck`, `treasure` — the actual root-cause fix, not a null-safety patch |
| `commands/activities/museum.js` | Fixed `ACTIVITY_ID` — was `"WHISPER_MUSEUM"` (uppercase, doesn't match the registry-key convention every other activity uses), now `"museum"` |
| `services/activityService.js` | `executeActivity()` now returns `name` (and always did return `emoji`) directly in **every** branch, including errors — eliminating the redundant second `getActivity()` lookup that actually crashed, rather than just null-guarding it. Also added `validateActivities()` (Phase 4) |
| `commands/activities/*.js` (all 13) | Removed the redundant `getActivity()` import and both call sites; use `result.name` directly. One consistent change applied identically to all 13 files, not 13 separate patches |
| `bot.js` | Calls `validateActivities()` at startup, right after the database connects and before anything else loads |

---

## 3. Every bug found during the audit

1. **The root cause**: 6 of 13 activity commands had no matching config
   entry (`hunt`, `magic`, `monster`, `museum`, `shipwreck`, `treasure`).
2. **The crash-causing pattern**: all 13 activity command files
   (including the 7 that already worked) called `getActivity()` a
   second, redundant time to render a title, with zero null-guarding —
   latent in every one of them, not just the 6 broken ones. Any of the 7
   working activities would have crashed the identical way if their
   config were ever accidentally removed or renamed.
3. **`museum.js`'s ID mismatch**: used `"WHISPER_MUSEUM"` while its
   sibling files all use a lowercase ID matching the registry key —
   would have stayed broken even after adding a `museum` entry, unless
   caught specifically (which the "IDs match exactly" audit step was
   built to catch).
4. **An unvalidated empty-outcomes array crashes the same way**:
   confirmed directly by testing — `getWeightedOutcome([])` returns
   `outcomes[-1]` (`undefined`), and `executeActivity()` then does
   `outcome.coins.min` on `undefined`. Nothing in the original code
   prevented a future activity from being configured this way.
5. **Malformed reward ranges would silently corrupt data, not crash**:
   an outcome with `coins: { min: 500, max: 100 }` (max < min) wouldn't
   throw — `randomBetween()` would produce nonsensical results, and a
   fully missing `coins`/`xp` object would hand out `NaN` coins/XP
   directly into a player's real balance with no error at all. Worse
   than a crash, since nothing would ever surface it.
6. **Outcome chances not summing to 1.0** wouldn't error either — some
   outcomes would just be quietly unreachable or over-weighted,
   changing the actual odds without anyone noticing.

## 4. Additional activities affected
All 13 were affected by bug #2 above (the latent crash pattern), even
though only the 6 unconfigured ones were affected by bug #1. Fixing #2
architecturally (rather than patching `hunt.js` alone) means the other
12 — including all 7 that were already "working" — are now also
protected against the same failure mode if their config is ever broken
in the future.

## 5. Preventative validation added
`services/activityService.js`'s new `validateActivities()`, called from
`bot.js` at startup, checks every activity for: registry key matching
its own `id`, a valid `name`/`emoji`, a valid `cooldown` range (positive,
min ≤ max), a non-empty `outcomes` array, every outcome having a valid
`chance` (0–1), `text`, and valid `coins`/`xp` ranges (min ≥ 0, min ≤
max), and outcome chances summing to 1.0 within a small tolerance.
**Reports every problem found in one pass, not just the first**, and
throws — the bot will not start with a broken activity config. Directly
tested against 6 independently-broken configs (bad ID, missing name,
inverted cooldown range, empty outcomes, mismatched chance sum, inverted
coin range) and confirmed it caught all 6 simultaneously with clear,
specific messages.

---

## 6. Confirmation: all activity commands execute successfully

Ran all 13 activities end-to-end through their **real command files**
with mocked Discord interactions (not just the underlying service in
isolation) — every one produced a valid embed, granted coins, recorded
history, and started a cooldown, including `/hunt`.

**Then specifically re-created the exact original crash scenario**:
called `/hunt` twice in a row for the same user, so the second call hits
the cooldown/error branch — the precise code path that crashed before.
It now renders a correct cooldown embed (`"Hunting • WhisperBot"` in the
footer) instead of throwing.

Full test log (all 13, `success/embed/coins/history/cooldown` — all
`true` for every one):
```
mine, chop, dig, farm, build, nether, end, hunt, magic, monster,
museum, shipwreck, treasure  →  ALL PASS
```

## Testing performed
- Full syntax sweep, zero failures.
- Full 102-command loader + Discord API JSON serialization check — zero
  errors (unaffected by this round's changes, confirming no regression
  elsewhere).
- **Full `bot.js` startup simulation** (validation → command loading →
  event registration, everything short of the live Discord connection)
  — zero errors, confirmed `validateActivities()` runs and passes before
  anything else loads.
- **Directly confirmed the validator blocks startup** on a deliberately
  broken config (empty outcomes array), not just that it runs.
- All 13 activities' outcome chances verified to sum to exactly 1.0000.
- Confirmed `getActivity()` is no longer imported or called anywhere in
  `commands/activities/` (fully eliminated, not just guarded).
