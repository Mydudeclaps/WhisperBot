# 🎮 Tic Tac Toe Investigation & 🧠 Memory Vault Redesign

## Deploy first
No new commands this round (`/tic` and `/memory` both already exist), but
restart the bot after unzipping.

---

## Issue 1: Tic Tac Toe's "missing `tic_games` table" — investigated, not reproducible

I checked before touching anything, the same way I check every bug report
in this project. `tic_games` doesn't appear anywhere in the delivered
code — not in `ticService.js`, not in `ticPvpInteractionHandler.js`, not
in `database.js`. Tic Tac Toe's actual table is `tic_challenges`, which
already has a self-healing `CREATE TABLE IF NOT EXISTS` migration (added
two rounds ago) and was directly tested at the time — full PvP lifecycle
simulation (create → accept → alternating moves → win/draw/invalid-move
rejection), all passing.

I re-ran that same table-creation and CRUD test again this round to be
sure nothing regressed, and it's still solid (see Testing below).

**I didn't add a `tic_games` table.** Adding an unused table that no code
ever queries would be pure clutter — and this prompt's own stated rule
is "no duplicate systems." If you do hit a real SQLite error with Tic Tac
Toe, I'd want the actual error text and a repro step, since `tic_games`
doesn't correspond to anything my code touches.

---

## Issue 2: Memory Vault — real bug, properly fixed

This one was real, and testing found something slightly worse than the
report described. I checked the actual `flipCard()` logic before
rewriting anything:

```js
// old code — the second card of a mismatch:
return { type: "no_match", symbolA: ..., symbolB: ..., posA: firstPos, posB: position };
// game.pendingFlips was already cleared to [] two lines above this,
// and `revealed[firstPos]`/`revealed[position]` were never set true.
```

**The board never showed a mismatched flip at all** — not "flips back too
fast to see," but literally zero trace on the board that either card was
ever touched. The dropdown-vs-button complaint was real too, but this was
the deeper issue.

### The fix
- **Redesigned the state model**: `matched[]` (permanent) is now
  separate from `pendingFlips` (temporary, currently face-up mid-turn).
  A new `getVisiblePositions()` returns both combined — that's what the
  board renders from.
- **A mismatch now stays visible on purpose.** `flipCard()` no longer
  clears `pendingFlips` on a no-match; it leaves both cards in place so
  the caller can actually render them, then calls the new
  `clearPendingMismatch()` after a real `1500ms` delay
  (`await sleep(1500)` inside the button handler, between two separate
  `editReply` calls) before hiding them again — matching the spec's
  "Cards will flip back in a moment..." step for real, not just in text.
- **Buttons replace the dropdown** for cell-picking. Matched cells show
  ✅ and are disabled; a cell mid-reveal shows its actual symbol and is
  disabled; everything else shows its number.
- **All cells lock during the 1.5s mismatch pause** (a `locked` flag
  disabling every cell button at once) so a player can't queue up a third
  flip while the animation is "playing."
- **Hard mode's 36 cells — handled with pagination, not two select
  menus** like last round. Reserving one row (5 slots) for
  Leave/Prev/Next controls leaves 4 rows × 5 = 20 slots for cells, so
  anything over 20 cells paginates: Easy (16) fits on one page, Medium
  (25) splits 20+5, Hard (36) splits 20+16. Verified the row-count math
  directly for all three difficulties — none exceed Discord's 5-row cap.
- **Lucy's dialogue expanded** — added a dedicated `memoryLines` block
  (same pattern as Frank's `pokerLines` from the poker rebuild) with
  match/matchStreak/noMatch/noMatchStreak/win/loss/perfect lines, all
  from the spec's dialogue table. Streak lines trigger on 2+ consecutive
  matches or misses; the perfect line triggers when a vault is cleared in
  exactly the minimum possible attempts.

### What I did NOT change
`memoryService.js`'s core math — `generateGrid()`, `calculateReward()`,
the bonus-cell handling — is untouched from two rounds ago (already
tested and correct then). This was a UI/state-visibility fix, not a
rebuild, per the prompt's own instruction.

---

## Testing performed
Same approach as every round — ran real code through the `node:sqlite`
shim, not just read it. Also: **properly cleaned up node_modules this
time** — last round's cleanup left a stray nested shim folder behind that
I didn't catch until this round. Fixed it properly this time and directly
verified there's no shim signature anywhere inside the restored package
(`grep`'d for the shim's own comment text across the whole module
directory — zero matches) before finishing.

- Full project syntax sweep, zero failures.
- Require-graph test of every touched file.
- Full 74-command loader + Discord API JSON serialization check — zero
  collisions, zero errors (confirms no `tic_games`-shaped changes were
  needed and nothing else regressed).
- **Directly reproduced the old bug and confirmed the fix**: flipped a
  deliberate mismatch, checked `getVisiblePositions()` *before* calling
  `clearPendingMismatch()` — confirmed both mismatched cards were
  present (old code: they never would have been) — then confirmed they
  correctly disappear after clearing.
- Verified matched cells stay permanently visible, and that clicking an
  already-matched or currently-pending cell correctly returns `invalid`
  without corrupting state.
- **Pagination math directly verified for all three difficulties** —
  computed exact row counts per page and confirmed none exceed Discord's
  5-action-row limit (Easy: 1 page/5 rows, Medium: 2 pages/5+2 rows,
  Hard: 2 pages/5+5 rows).
- Ran a full realistic playthrough (deliberate mismatches mixed with real
  matches, using the actual `flipCard`/`clearPendingMismatch` sequence a
  real button session would use) and asserted visibility state at every
  single step — zero bugs across the whole simulated game.
- Re-verified Tic Tac Toe's real table (`tic_challenges`) still creates
  correctly and its CRUD functions still work, to be sure Issue 1's
  investigation didn't miss a real regression elsewhere.
