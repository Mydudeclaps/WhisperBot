# 🎰 Casino Expansion — Fortune Reels, Mega Slots, Tic Tac Toe, Memory Vault

## Deploy first
New commands this round (`/tic`, `/memory`), so run `node deploy-commands.js`
after unzipping, then restart the bot.

---

## 🚨 Three real bugs were found and fixed during testing this round

I want to lead with these rather than bury them, since two of them are
economy-breaking and I fixed them before they shipped rather than just
flagging them:

### 1. Mega Slots would have paid out 47.67x what was wagered, on average
Not a balance nitpick — an infinite-money bug. With 8 overlapping
paylines (the center cell alone is part of 4 of them), the spec's own
payout numbers compounded catastrophically. Verified via a 10,000-spin
simulation, then rebalanced (removed the 2-of-3 "double" tier entirely —
with 8 overlapping lines a partial match happens constantly, and paying
out on it at all compounds fast — and cut triple payouts ~30x) until it
matched Classic Slots' existing, presumably-tuned 0.633x baseline.
Landed at 0.609x.

### 2. Fortune Reels would have paid out 5.27x on average
Same root cause, smaller scale (fewer overlapping lines). Rebalanced the
same way, landed at 0.569x.

**Both were caught by actually simulating thousands of spins before
shipping, not by inspecting the numbers and guessing.** The exact
before/after payout tables and reasoning are commented directly in
`config/gameConfig.js`.

### 3. Memory Vault never actually deducted the player's bet
Caught in code review, not simulation. The settlement line read:
```js
addCoins(userId, username, reward.coins - bet + bet);
```
`reward.coins - bet + bet` always simplifies to just `reward.coins` — the
bet was being added back to itself and canceling out, meaning **every
memory game was a pure, uncapped free-money grant** regardless of outcome.
Fixed to `addCoins(userId, username, reward.coins - bet)`, the actual net
change.

### Bonus finding, out of scope but worth knowing about
While establishing a "healthy EV" baseline to rebalance the new slots
against, I ran the same simulation against **Kingdom Slots — built in an
earlier session, not touched this round** — and it's sitting at **7.46x
EV**, its own pre-existing economy-breaking bug. I didn't touch it since
it's outside this round's scope, but you should know it's live and
probably wants the same simulate-then-rebalance treatment whenever you're
ready for it.

---

## 🎰 Phase 1 — Slot Machine Expansion

- **Fortune Reels** (`fortune5`) — 5 reels × 3 rows, 3 horizontal
  paylines, 5/4/3-of-a-kind payout tiers per line, multiple lines can win
  simultaneously.
- **Mega Slots** (`mega3x3`) — 3×3 grid, 8 paylines (3 horizontal, 3
  vertical, 2 diagonal).
- Both added as **fully isolated code paths** in `slotsService.js` —
  `spinFortune5`/`resolveFortune5` and `spinMega3x3`/`resolveMega3x3` are
  brand new functions; the original `spin()`/`resolveSpin()` (Classic,
  Treasure, Kingdom) are untouched. `calculateSlotPayout()` dispatches on
  a new `variant.type` field, defaulting to the original 3-reel path for
  anything without one — confirmed via direct regression test that
  Classic/Treasure/Kingdom produce identical results to before.
- `slots.js` and `embedFactory.js` extended to render a 3×5 or 3×3 grid
  layout instead of always assuming 3 symbols in a row.

---

## ❌⭕ Phase 2 — Gambling Tic Tac Toe (`/tic`)

- **House mode** — same session pattern as every other casino game (5
  games, persistent random cooldown, Change Bet, Leave). Medium-difficulty
  AI: win if possible, block if necessary, otherwise center → corner →
  edge.
- **PvP mode** (`/tic opponent:@user amount:<bet>`) — the one casino game
  where a real player is on the other side of the wager. This needed a
  genuinely different architecture: every other game runs start-to-finish
  inside one player's single command execution (state lives in local
  variables). PvP tic-tac-toe has **two different users clicking the same
  message across separate interaction events**, so the board has to be
  persisted — added a `tic_challenges` table following the exact shape of
  your existing `daily_races` table (the `racebet`/`raceaccept` pattern),
  plus board/turn state. Moves are routed through a new global handler
  (`utils/ticPvpInteractionHandler.js`), wired into `interactionCreate.js`
  the same way `lore_`/`casino_` buttons already are.
- **Escrow handling**: the challenger's bet is never touched until the
  opponent accepts. Both balances are re-checked at accept time (not just
  at challenge-send time, since time may have passed), and if either side
  can no longer cover the bet, the challenge is cancelled cleanly instead
  of failing mid-game. A draw refunds both players (no money changes
  hands).
- **A real namespacing risk I caught before wiring anything up**: house
  mode's local buttons (`tic_move_0`, `tic_bet_select`, etc.) and PvP's
  global buttons both live under the `tic_` prefix. If I'd routed
  `interactionCreate.js` on a blanket `customId.startsWith("tic_")`, it
  would have intercepted house-mode's local button clicks before
  `tic.js`'s own `awaitMessageComponent` loop could see them, breaking
  house mode entirely. Used distinct sub-prefixes instead
  (`tic_accept_`, `tic_decline_`, `tic_pvp_move_` vs. house mode's
  `tic_move_`) and routed only on those three specific prefixes —
  confirmed no overlap before wiring it in.

---

## 🧠 Phase 3 — Memory Vault (`/memory`)

- Three difficulties, exactly as specified — with one real math fix: the
  spec's medium tier was "5×5 — 12.5 pairs," and a 5×5 grid has 25 cells,
  which is odd and can't form whole pairs. Fixed by keeping the 5×5 grid
  but making cell #25 a **bonus cell** instead of part of a pair — 12 real
  pairs (24 cells) + 1 bonus cell = 25. Flipping it awards a small
  immediate coin bonus and doesn't count toward "pairs found."
- **A second real Discord constraint, not just a spec math error**: Hard
  mode is 6×6 = 36 cells. Discord caps a message at 25 total components
  (5 rows × 5 buttons, or 1 select menu with 25 options per row) — a
  36-button grid physically cannot exist in one message, and the spec's
  numbered-button mockups don't account for this. Solved by using select
  menus for cell-picking instead of a button grid (Easy and Medium fit in
  one select menu each; Hard splits across two, 18 cells each), which
  also conveniently solves "how do I show 36 individual button states"
  more cleanly than a giant button wall would have anyway.
- **Reward formula bug caught by testing the exact boundary conditions**:
  my first version of `calculateReward()` scored "perfect play" against
  `maxAttempts` instead of the *minimum possible* attempts (`pairs`) — a
  mathematically perfect Easy game (8 attempts, the fewest possible for 8
  pairs) was scoring 2.5x instead of the intended 3x. Fixed the formula
  and directly verified all three boundary conditions: exactly-perfect
  play hits `perfectMultiplier` exactly, using every single available
  attempt while still completing hits `baseMultiplier` exactly, and an
  incomplete vault pays only whatever bonus-cell coins were collected
  along the way (confirmed: multiplier 0, bet lost, bonus coins kept).
- **Balance finding, not fixed, flagged for you**: realistic-play
  simulation (imperfect memory, not perfect recall) shows Easy is
  reasonably tuned and Medium has a solid house edge, but **Hard mode is
  essentially uncompletable** — 0% average return across thousands of
  simulated games at both tested skill levels, because 18 pairs with only
  7 "slack" attempts beyond the mathematical minimum is extremely
  unforgiving for real (imperfect) memory. This is the opposite failure
  mode from the slots bugs — nobody exploits it, but nobody enjoys a mode
  that's effectively unwinnable either. Worth loosening `maxAttempts` for
  `hard` in `config/gameConfig.js` if you want it to actually get played.

---

## Files changed
`config/gameConfig.js`, `services/slotsService.js`, `commands/casino/slots.js`,
`utils/embedFactory.js`, `data/casinoNpcs.js`, `database/database.js`,
`events/interactionCreate.js`

## Files created
`services/ticService.js`, `services/memoryService.js`,
`commands/casino/tic.js`, `commands/casino/memory.js`,
`utils/ticPvpInteractionHandler.js`

## Files NOT touched (as planned)
`blackjack.js`, `dice.js`, `highlow.js`, `horse.js`, `roulette.js`,
`poker.js`, `casinoService.js`, `casinoStatsService.js`,
`casinoDailyService.js`, `jackpotService.js`

---

## Testing performed
Same approach as every round — ran real code through a `node:sqlite`
shim, not just read it. Also worth noting: **mid-testing I discovered a
leftover shim artifact from an earlier round that hadn't been fully
cleaned up** (a nested copy inside `node_modules/better-sqlite3` from an
interrupted restore). Found it, cleaned it up properly, and verified the
real Windows-built binary is correctly restored — confirmed by attempting
to instantiate it on this Linux sandbox and getting the expected
`ERR_DLOPEN_FAILED` (proving it's the real cross-platform-incompatible
binary, not an accidentally-still-active shim).

- Full project syntax sweep (zero failures) and require-graph test of
  every new/touched file, run twice — once mid-build, once after the
  node_modules cleanup, to be certain nothing was affected.
- Full 74-command loader + Discord API JSON serialization check — zero
  collisions, zero errors, confirmed both `/tic` and `/memory` present.
- **Slots**: 10,000-spin simulations for both new machines (twice each —
  once to discover the original bugs, once to confirm the fix), plus a
  50,000-spin baseline run against Classic and Kingdom slots for
  comparison. Confirmed dispatch correctness across all 5 variants from
  a single test loop. Regression-confirmed the original 3-reel
  spin/resolve path produces identical results to before this update.
- **Tic Tac Toe**: win detection verified on all 8 lines (rows, columns,
  diagonals), 1,000-trial AI stress test confirming it never selects an
  occupied cell, and a full PvP lifecycle simulation — create, accept,
  alternating moves, win detection, invalid-move rejection (wrong turn
  and occupied-cell, both confirmed to leave board state untouched), and
  a full draw sequence confirming correct terminal state.
- **Memory Vault**: grid generation verified for all three difficulties
  (correct cell counts, all symbols properly paired, bonus cell present
  only where expected), a full perfect-play simulation, and the reward
  formula tested directly at all boundary conditions (perfect, worst-case
  complete, midpoint, incomplete) after catching and fixing the scoring
  bug. Realistic-play economics simulated at two skill levels across all
  three difficulties, which is what surfaced the Hard-mode difficulty
  finding above.
