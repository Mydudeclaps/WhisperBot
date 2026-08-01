# Robbery System Audit & Completion Sprint — 2026-07-29

## Summary

A full trace of the `/rob` command from slash command through every service,
util, and embed it touches, triggered by a reported bug: the robbery
interaction appeared to silently stop after the victim chose "Defend" in
their DM — no outcome shown, no coins moved, nothing posted anywhere.

The flow itself turned out to be logically complete already — every code
path was audited and simulated end-to-end with zero exceptions. The actual
root cause was a Discord client configuration gap, not a logic bug. Fixing
it also surfaced two genuine economy bugs and one real feature gap (the
victim never learning the outcome), both of which are now fixed.

## Root Cause

`bot.js`'s Discord client was constructed without `GatewayIntentBits.DirectMessages`
or a `Partials.Channel` partial. `commands/player/rob.js` sends the victim a
DM containing the response buttons, then calls
`dmMessage.awaitMessageComponent()` to wait for their click. Sending a DM
doesn't require either of the missing settings — but reliably receiving the
button click back through that DM channel does, since without them the
channel stays "partial"/uncached and the interaction collector can fail to
resolve it. This is a well-documented discord.js v14 behavior, not specific
to this codebase, but WhisperBot's client was never configured for it
because until `/rob` shipped, nothing else in the bot needed to *receive*
interactions from inside a DM.

**Fix:** added `GatewayIntentBits.DirectMessages` to the client's intents
and `partials: [Partials.Channel]` to its config in `bot.js`. Neither is a
privileged intent, so no Discord Developer Portal changes are needed —
`npm install` and restart is all this requires.

## Files Inspected

Every file in the robbery system's require graph, read in full:
- `commands/player/rob.js`
- `services/robberyCalculator.js`
- `services/robberyLogger.js`
- `services/robberyValidator.js`
- `utils/robberyUtils.js`
- `utils/embedFactory.js` (the 7 `robbery*Embed` functions)
- `data/robberyOutcomes.js`
- `config/robberyConfig.js`
- `database/database.js` (`robbery_stats`, `robbery_logs` schema)
- `events/interactionCreate.js` (confirmed no conflict — `rob_*` custom IDs
  aren't intercepted by the global button dispatcher; DM component
  collectors are independent of it entirely)
- `bot.js` (client construction — where the actual bug was)

## Files Modified

- `bot.js` — added `DirectMessages` intent + `Channel` partial (the fix)
- `services/robberyCalculator.js` — `resolveRobbery()` now accepts
  `robberCoins` and clamps both fine paths to it; `hidden_cash` loot now
  clamps to `victimCoins` instead of a hardcoded flat amount
- `commands/player/rob.js` — imports the two new embed builders, adds a
  brief rolling/suspense beat before the reveal, passes `robberCoins` into
  `resolveRobbery()`, sends the victim a DM with the actual final outcome
- `utils/embedFactory.js` — added `robberyRollingEmbed()` and
  `robberyVictimResultDMEmbed()`, exported both
- `data/robberyOutcomes.js` — added `victimTitle`/`victimDescription` to
  all 7 outcomes (purely additive; existing `title`/`description` fields
  and every other reader of this file are untouched)
- `docs/AI_CONTEXT.md` — moved the robbery system from "structurally
  verified but not deeply audited" to "deeply verified"

## Bugs Fixed

1. **DM button collector unreliable (the reported bug).** Root cause above.
   This explains the reported symptom for Defend and would equally have
   affected Run/Look Around/Ignore — any victim response depended on the
   same collector.
2. **`hidden_cash` could drive a victim's balance negative.** Paid a flat
   40,000 coins with no relationship to the victim's actual balance
   (`MIN_VICTIM_CASH` only guarantees 1,000). Now clamped to
   `Math.min(40000, victimCoins)`.
3. **`arrested` fines could drive a robber's balance negative.** At heat
   tier 11 with a witness report, the fine formula
   `(ARREST_FINE_BASE + heat * ARREST_FINE_PER_HEAT) * 2` reaches 64,000,
   while `MIN_BET` only requires a robber to have 100 coins to attempt a
   robbery in the first place. Now clamped to the robber's actual balance
   in both the direct-arrest and witness-reported-arrest branches.

## New Interaction Paths Completed

- **Victim result DM.** Previously the victim's DM was only ever edited to
  "✅ Response received." — they had no way to know whether they'd been
  robbed, how much they lost (or recovered, on a successful Defend), or
  what happened to their attacker. They now get a full result embed,
  written from their own point of view, with their own updated balance.
  Wrapped in try/catch — if their DMs are closed, the public channel result
  (which was already complete) remains the source of truth and nothing
  about the already-applied economy outcome changes.
- **Rolling/suspense beat.** A short "🎲 Rolling the Outcome..." embed now
  appears in the origin channel between the victim's response coming in and
  the final result being revealed, per the "should feel like a living
  event" goal — the reveal no longer cuts instantly from "DM sent" to
  "here's what happened."

## Deliberately Not Changed

- **Action set (Look Around / Run / Defend / Ignore).** The brief's example
  flow used Fight/Surrender-style buttons; the actual implementation uses a
  different, already-complete four-action design (Look Around, Run, Defend,
  Ignore) with its own fully wired probability effects
  (`VICTIM_DEFENSE_BONUS`, `LOOK_AROUND_PENALTY`, `RUN_ESCAPE_CHANCE` in
  `config/robberyConfig.js`). Replacing it with a differently-named
  four-button scheme would mean designing new win/loss mechanics and
  rebalancing the whole system from scratch — that's new feature/economy
  design work, not a completion of what's there, and risks exactly the kind
  of balance change the project's safety rules call out. The brief's flow
  diagram was treated as an illustration of the *feel* being asked for
  (multi-stage, reactive, alive), which the existing four-action design
  already delivers once the DM delivery bug is fixed.
- **Every other robbery balance number** — bet limits, base success chance,
  reputation/heat/streak tiers, cooldowns, steal percentages, witness/arrest
  odds — untouched. Only the two specific out-of-bounds edge cases above
  were adjusted, and only by clamping, not by changing any underlying odds
  or formulas.

## Economy Validation

Verified directly (not just by code inspection) via two test approaches:

**End-to-end simulation** — the full `/rob` execute() function run against a
mocked Discord interaction, covering all 4 victim responses, a timeout, and
a DMs-closed case. In every run: exactly one coherent final result, correct
coin transfer direction (loot subtracted from victim/added to robber on a
steal, reversed on a successful Defend), fines subtracted only from the
robber, cooldown/heat/streak persisted, log row written, victim DM attempted
and gracefully skipped when closed.

**Direct outcome-branch testing** — all 7 outcome branches
(`perfect`/`success`/`hidden_cash`/`wallet_empty`/`escaped`/`defended`/`arrested`)
fed through the embed builders and the exact coin-effect arithmetic
`rob.js` uses, confirming:
- Money is never duplicated or lost outside of intentional sinks (arrest
  fines correctly leave the two-player economy entirely — that's the
  intended "fine," not a leak).
- Failed robberies (`escaped`) award no coins to either side.
- Successful robberies transfer the exact `loot` amount, no more, no less.
- **Balances can no longer go negative** — confirmed by deliberately
  reproducing both bugs (low-balance victim hit by `hidden_cash`, 100-coin
  robber facing a max-heat witness-reported arrest) pre-fix, then
  re-running the same scenarios post-fix and confirming they land exactly
  at 0 instead of going negative.
- Cooldowns and heat/streak updates apply identically regardless of which
  bug-fix path was taken.

## Testing Performed

- `node --check` on every modified file — zero syntax errors.
- Full command-loader simulation (all 102 commands, all 4 events, all 225
  supporting modules) via the project's established `node:sqlite` shim
  workaround for the Windows-only `better-sqlite3` binary — zero load
  errors, zero name collisions, before and after every change.
- Full `/rob` execute() simulated against a mocked interaction/victim/channel,
  exercising Look Around, Run, Defend, Ignore, a DM timeout, and closed DMs.
- All 7 outcome branches tested directly through the embed layer and coin
  arithmetic, including two deliberately-constructed low-balance edge cases.
- Confirmed the real Windows `better-sqlite3` binary shipped in this
  delivery was never touched by any of the above (all testing happened in
  an isolated copy with a temporary shim swapped in).

## Documentation Updated

- `docs/CHANGELOG.md` — new entry for this sprint
- `docs/AI_CONTEXT.md` — robbery system moved from "not deeply audited" to
  "deeply verified"
- This file (`docs/updates/2026-07-29-robbery-audit.md`)

## Notes for Future Work

- The Fight/Surrender-style action set from the brief's example flow is a
  legitimate future feature idea, but it's genuinely new game design (new
  win/loss branches, new balance numbers to tune) rather than a bug fix or
  completion of the existing system. Worth a dedicated round if the goal is
  to expand the action set, not bundle it into a bug-fix sprint.
- `robbery_logs` is being written to every attempt but nothing currently
  reads it — same "write-only, waiting on a future feature" situation
  `docs/KNOWN_ISSUES.md` already documents for `activity_history`/
  `quest_history`. A `/rob history` or moderation-facing log viewer would be
  a natural next feature built on data that already exists.
