# 🎮 Tic Tac Toe AI Randomization & 🧠 Memory Vault Button Alignment

## Deploy first
No new commands or schema changes this round — just restart the bot
after unzipping.

---

## Verified both claims against your actual code before changing anything

### Tic Tac Toe: mostly accurate, one detail wasn't
Checked `getAIMove()` directly. The core complaint — the AI is fully
deterministic given a board state, so a player who plays the same
opening every time sees the identical game every time — is real and
confirmed: no random turn order, no strategic deviation existed at all.

One detail in the report doesn't match what was actually there, though:
it describes "corners in fixed order (0, 2, 6, 8)," but the corner
selection was already randomized (`corners[Math.floor(Math.random() *
corners.length)]`) from when this game first shipped. Not a big deal
either way — worth knowing which parts of a report to trust exactly
versus which capture the right idea loosely.

### Memory Vault: confirmed exactly as described
`cellButtonRows()` used a hardcoded `i += 5` for every difficulty,
ignoring the board's actual width (`game.config.size`). Easy's 4×4 board
was rendering as 5-wide button rows — a real visual mismatch, confirmed
by reading the code before touching it.

---

## The fixes

### Tic Tac Toe — `services/ticService.js` + `commands/casino/tic.js`
- **`getAIMove()`**: after the win-check and block-check (which are
  never skipped — see Testing below), there's now a 40% chance the AI
  ignores "optimal" placement (center → corner → edge) and just plays
  anywhere legal instead. The remaining 60% plays exactly as before.
- **New `shouldHouseGoFirst()`** (50/50) and **`getRandomMove()`**: when
  the house wins the coin flip, it places a genuinely random opening
  move before the player ever sees the board — not `getAIMove()`'s
  center-first logic, since an empty board never has a win/block to
  make, which would've just meant the house always opens with the
  center anyway (exactly the predictability this is fixing). Wired into
  `dealNewGame()` in `tic.js`.
- **The one rule I never compromised**: the AI still *always* takes a
  winning move and *always* blocks the player's winning move, no matter
  what the random rolls say. The randomization only ever applies to
  moves that don't matter competitively. Directly verified — see
  Testing.

### Memory Vault — `commands/casino/memory.js`
- `cellButtonRows()` now computes `rowWidth = Math.min(game.config.size,
  5)` per difficulty instead of a hardcoded `5`. Easy now renders true
  4-wide rows matching its 4×4 board exactly — and as a side effect, all
  16 cells now fit on a single page with no pagination needed at all.
  Medium and Hard are unchanged (5-wide was already correct for Medium;
  Hard's 6-wide board still caps at 5 per row since that's Discord's own
  hard limit — matches what the report's own table asked for).
- Page sizing (`cellsPerPage = rowWidth * 4`) now adapts alongside the
  row width instead of being a fixed constant, so pagination math stays
  correct for all three difficulties automatically.

---

## Testing performed
Same approach as every round — ran real code, not just read it:
- Full syntax sweep, zero failures.
- Full 80-command loader + Discord API JSON serialization check — zero
  collisions, zero errors.
- **The one property that actually matters for a gambling game**:
  confirmed the AI never sacrifices a real win or a necessary block, even
  with the 40% randomization active — forced a guaranteed-win board and a
  guaranteed-block board through `getAIMove()` 2,000 times each with the
  random branch live; **zero failures on either**.
- Verified the random-deviation rate lands close to the configured 40%
  (measured 35.1% non-center moves on an empty board — matches the math:
  40% random pick has a 1-in-9 chance of landing on center by luck
  anyway, so ~35.6% is the expected non-center rate, not 40% flat).
- Verified `shouldHouseGoFirst()` lands at ~50% over 5,000 rolls (50.1%
  measured) and `getRandomMove()` never selects an occupied cell (0 bad
  picks over 1,000 trials against partially-filled boards).
- **Ran 500 complete simulated games** end-to-end through the real
  `dealNewGame`/`getAIMove`/`checkWinner` sequence a live session would
  use (house-first ~49% of the time, matching expectations) — zero
  crashes across all 500.
- **Directly computed the new button-grid row/page math for all three
  difficulties** rather than eyeballing it: confirmed Easy now renders
  true 4-wide rows (16 cells, 1 page, no pagination needed), Medium
  unchanged at 5-wide (2 pages), Hard unchanged at 5-wide-capped (2
  pages) — none exceed Discord's 5-action-row limit.
