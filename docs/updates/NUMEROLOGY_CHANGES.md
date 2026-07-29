# 🔢 Numerology — The Chaos Engine

## Deploy first
New command (`/numerology admin`), so run `node deploy-commands.js` after
unzipping, then restart the bot.

## Setup required
Confirm channel ID `1526621924141301820` is actually your counting
channel — it's hardcoded in `config/numerologyConfig.js` as
`CHANNEL_ID`, per the spec. If it's wrong, every message in that
(possibly-wrong) channel will be treated as a counting attempt, deleted
if it doesn't match, and DM'd. Double-check before going live.

---

## What this actually does, in one paragraph
Every message in the configured channel gets checked against the
expected next number. Get it right: reactions only, no bot message,
real coin/XP reward, and a chance of a milestone/chaos/NPC moment. Get
it wrong: the message is deleted and you get a funny DM explaining
exactly how wrong you were — no public shaming unless the dice
(10% chance) say otherwise. Six chaos event types can strike at any
correct count (2-5% chance) and genuinely change the rules for a while.
Everything is DB-backed, including anti-spam — no in-memory state that
resets on a bot restart.

---

## A few deviations from the design doc, and why

### File locations don't exactly match the spec
- `config/numerologyConfig.js`, not `data/numerologyConfig.js` — this
  codebase's real convention is `config/` for tunable behavior
  (`gameConfig.js`, `dailyConfig.js` live there) and `data/` for content.
  Numerology's config (modes, formulas, thresholds) is tunable behavior,
  so it followed that instead of the spec's suggested path.
- `utils/numerologyEmbeds.js`, not `services/numerologyEmbeds.js` —
  every other embed builder in this codebase (`embedFactory.js`,
  `kingdomEmbeds.js`, the whole `embedBuilder/` admin tool) lives in
  `utils/`. Matched that instead.
- No separate `events/numerologyListener.js`. The event loader
  (`handlers/eventHandler.js`) registers every file in `events/` by
  `client.on(name, ...)`, and `events/messageCreate.js` already exists
  handling every message. A second file also named `"messageCreate"`
  would register a **second, independent** listener for the same event
  — technically works, but duplicates the existing bot/webhook/system
  filtering and makes message-handling logic split confusingly across
  two files for no benefit. Numerology's channel check was added
  directly into the existing `messageCreate.js` instead (one added
  branch, returns early for that channel, everything else unchanged) —
  with the actual game orchestration living in a new
  `utils/numerologyMessageHandler.js`, following this codebase's
  established `utils/xInteractionHandler.js` pattern (same shape as
  `loreInteractionHandler.js`, `ticPvpInteractionHandler.js`) for
  Discord-side-effect orchestration that doesn't belong inside a
  Discord-object-free service.
- Admin command lives in `commands/admin/numerology.js`, not
  `commands/numerology/`, matching where every other admin-only tool in
  this codebase actually lives.

### A 6th database table, beyond the spec's 5
Added `numerology_mistakes` for anti-spam rate tracking. The spec's 5
tables don't have anywhere to durably store "how many mistakes has this
user made in the last 5 minutes" — an in-memory `Map` would work until
the bot restarts mid-window, which is exactly the mistake this
codebase's cooldown systems have already made and fixed twice before
(see `docs/AI_CONTEXT.md`'s "hard-won lessons"). Learned that lesson
without needing to relearn it here.

### Numerology messages bypass the quest/XP pipeline entirely
A message in the counting channel doesn't also grant chat XP or quest
credit. Reasoning: granting quest credit for a message that might get
deleted a moment later (because it turned out to be wrong) would be
inconsistent, and a dedicated counting channel double-purposing as a
quest-progress channel wasn't asked for. If this isn't the right call,
it's a one-line change (remove the early `return` in `messageCreate.js`'s
numerology branch).

---

## Design decisions on the genuinely ambiguous parts of the spec

- **"Ghost Number"** — implemented as: the bot posts a decoy number that
  is deliberately NOT the real next expected number. The real expected
  number is completely unaffected — if someone posts the ghost's value,
  it's simply wrong (handled exactly like any other incorrect attempt).
  If someone posts the real next number instead, the game continues
  normally and the ghost is forgotten. This is a literal "trap or
  ignore it" mechanic, not a second parallel counting track.
- **"Counter's Curse — double stakes"** — interpreted as: the next
  correct count pays double coins/XP. There's no existing punitive coin
  cost on a wrong count to double (per the explicit "never punish honest
  mistakes" requirement), so "double stakes" only meaningfully applies
  to the upside.
- **Milestone-crossing detection for non-Classic formulas** —
  `numerologyService.attemptCount()` returns the exact number the count
  was at immediately before this one, so a formula that jumps by more
  than 1 (Fibonacci-style, multiply, a Count Shifts chaos event) still
  correctly detects any milestone/divine-number it crossed over, not
  just one it landed exactly on.

---

## Testing performed
Same standard as every round in this project — ran real code, not just
read it, and given this feature deletes real user messages and DMs real
users, tested the core validator especially hard before building
anything on top of it:

- **Strict Classic-mode validation tested against every single example
  the spec gave**, both valid and invalid (`42` ✅, `42 hi`/`42!`/`42😂`/
  `0042`/`forty-two` ❌) — all 10 cases pass exactly, plus additional
  edge cases (negative numbers, decimals, leading-zero variants).
- **Race-condition safety directly verified**, not just assumed from
  "it's synchronous": simulated two different users submitting the same
  correct number back-to-back and confirmed only the first claims it —
  the second gets a normal "incorrect" result instead of both somehow
  succeeding.
- **The Fibonacci-style formula's output checked against the spec's own
  example sequence** (10→20→30→50→80→130) — exact match.
- **All 6 chaos event types forced to fire** and their state effects
  (count jump, warp formula swap + tick-down + restore, divine window
  tick-down, curse consume-once, full count reset) verified directly,
  not just "it compiled."
- **Anti-spam escalation tested against the spec's exact tier table** —
  simulated 12 consecutive mistakes for one user and confirmed the
  tier transitions land exactly where specified (1-3: none, 4: warning,
  5-9: lockout, 10+: abuse/mod-log).
- **Full end-to-end tests through the actual message handler** with
  mocked Discord message objects — correct count (reactions given, no
  deletion), incorrect count (message deleted, DM sent with a real
  embed), non-numeric message (fully ignored, zero side effects),
  milestone crossing (embed sent, lore entry auto-created and
  auto-approved, correct achievements unlocked).
- **Confirmed zero regression** on the existing quest/XP pipeline for
  every other channel, and confirmed bot messages are still fully
  ignored — ran the real `messageCreate.js` handler against both a
  regular-channel message and a bot message.
- Full 102-command loader + Discord API JSON serialization check — zero
  collisions, zero errors, confirmed `/numerology` registers correctly.
- Full project syntax sweep, zero failures.
