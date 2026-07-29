# 🎲 High/Low Fix & ♠️ Progressive 3-Card Poker

## Deploy first
No new commands this round (both `/highlow` and `/poker` already existed),
but restart the bot after unzipping so it picks up the new code.

---

## 🎲 High/Low — the bug, confirmed and fixed

I traced the actual code before touching anything, and the bug was real
— worse than the report even described. Here's exactly what was
happening:

Round 1 draws a dealer card and shows Higher/Lower buttons — correct.
When you guess, the code resolves the round and **re-renders the result
screen using the same Higher/Lower buttons** (there was no separate
"round resolved" state). Then, *after* rendering, it silently drew a
**new** dealer card for "next round" — but never showed it to you.

So on round 2, you're looking at round 1's result screen (old dealer
card, old player card, old outcome) and clicking Higher/Lower on it —
except that click now compares your new card against a dealer card
you've never seen, generated silently in the background. You weren't
just "guessing blind" — you were making a decision the game had already
partially resolved without telling you.

**The fix:** added an explicit `awaitingGuess` state. The result screen
now only shows **[🔄 Next Round] [🚪 Leave]** — Higher/Lower physically
isn't there. Clicking Next Round is what draws and displays the new
dealer card; only then do Higher/Lower buttons reappear. Also added a
small defensive guard (`!awaitingGuess`) against the edge case of a
stale button click landing between message edits.

---

## ♠️ Poker — from "random result generator" to real head-to-head poker

The old `/poker` dealt the player 3 cards and paid out purely off their
own hand strength, with no dealer hand at all — confirmed by reading the
code, not just the report. It's now **Progressive 3-Card Poker**:

1. **Ante** → sit down with a bet, same as every other game's setup.
2. **First Card** → your first card is revealed. Dealer shows only
   "🂠 Hidden" — nothing about their hand yet. Choose **Bet** (add
   another ante-sized wager) or **Fold** (forfeit what's in — no Check
   option this early, matching the spec).
3. **Second Card** → your 2nd card revealed, **and the dealer's 2nd card
   revealed too** (their 1st stays hidden). Now Bet / Check / Fold.
4. **Third Card** → your 3rd card revealed, dealer's 3rd revealed. Bet /
   Check / Fold again.
5. **Showdown** → the dealer's hidden first card is finally revealed,
   both full hands are evaluated and compared, and the better hand wins.

Frank's dialogue changes at every stage (`data/casinoNpcs.js` →
`frank.pokerLines`), matching the spec's stage table.

### Real dealer opposition, real stakes
`services/pokerService.js` got two new functions — `dealProgressiveHands()`
and `compareHands()` — which evaluate **both** hands and pick a winner by
rank tier, then by a full tiebreak comparator (pair value → kicker, flush
high card, etc.) for same-tier hands. `dealHand()`/`evaluateHand()` (the
original single-hand payout-table logic) are completely untouched —
`compareHands()` is built on top of them, not a replacement.

This also fixes something I flagged as unusual back when I first built
this game: the old payout table had no real losing outcome (worst case
was always a push). With a dealer hand to lose against, **folding and
losing are both real now** — folding forfeits your entire current bet,
losing to a better dealer hand forfeits your entire current bet, and a
push (identical hands) returns it. This is a meaningfully different
— and much more genuinely "poker" — game than before.

### ⚠️ Found during testing: this needs a balance pass before you rely on it economically
I ran 20,000 simulated hands at minimum bet (ante only, no extra
Bet actions) through the exact payout logic the command uses. **Average
return was 126% of what was wagered** — meaning every hand played drains
roughly a quarter of the ante, on average, out of the casino and into
players' pockets. With betting rounds included (players adding to
`currentBet`), it's essentially the same ratio scaled up.

The cause: the payout table (500x/40x/30x/6x/3x/2x/1x) was originally
built for the old variant, where it applied *regardless* of beating the
dealer — a rare, big multiplier landing was rare specifically because it
only triggered on rare hands. Now that the same table only pays out on
the ~50% of hands where the player's hand beats the dealer's, the
multipliers are effectively worth roughly double what they should be —
real 3-card poker keeps a separate, much smaller "Ante Bonus" payout
table specifically because it stacks alongside a real head-to-head
comparison, not instead of one.

I didn't feel right silently picking new numbers without knowing what
economy balance you're aiming for, so I shipped the game exactly as
specified (dealer comparison, progressive reveal, bet/check/fold) but
want to flag clearly: **before this sees real play, you'll likely want to
cut `POKER.PAYOUTS` in `config/gameConfig.js` significantly** (rough
napkin math: roughly in half, to bring the ante-only EV close to 1.0) —
that's a one-file, no-code-logic change whenever you're ready.

### Payout mechanics, precisely
- Multiplier applies to the **full `currentBet`** (ante + every "Bet"
  action taken), not just the ante.
- Win: `payout = currentBet * PAYOUTS[yourHandRank]`, only if your hand
  beats the dealer's.
- Loss: forfeit `currentBet` entirely.
- Push (identical hand, tiebreak included): `currentBet` returned.
- Fold: forfeit `currentBet` entirely (whatever's been wagered so far).

---

## Testing performed
Same approach as every round — ran real code through the shim, not just
read it:
- Full syntax sweep and require-graph test of every touched file.
- Full 72-command loader + Discord API JSON serialization check — zero
  collisions, zero errors.
- **12 hand-built unit tests** for `compareHands()`: every rank tier
  beating every lower tier, dealer winning with a better hand, tiebreaks
  within pair (pair value, then kicker), three-of-a-kind, flush, and
  high-card, exact pushes on identical hands (including identical
  high-card hands), and mini royal correctly beating a lower straight
  flush. All 12 passed.
- 5,000-hand simulation of `dealProgressiveHands()` + `compareHands()` —
  confirmed a symmetric win/loss split (as expected, since both hands
  draw from the same distribution) and only 7 exact pushes out of 5,000,
  which is the right order of magnitude for 3-card hands.
- 3,000-hand simulation of the *exact* settlement arithmetic the command
  runs (random fold/bet/check patterns, real payout math) — zero crashes,
  zero negative or nonsensical payouts.
- The 20,000-hand ante-only EV simulation described above, which is what
  surfaced the balance issue in the first place.
