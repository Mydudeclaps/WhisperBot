# 🎮 WhisperBot Command Encyclopedia

Generated directly from every file under `commands/` (103 files, 12 folders) — not from a plan or spec. Command names, subcommands, and descriptions below were extracted from the actual `SlashCommandBuilder`/`ContextMenuCommandBuilder` calls in each file.

A note on how commands actually register: **the folder a file lives in is purely organizational.** `handlers/commandHandler.js` and `deploy-commands.js` both recursively scan every subfolder of `commands/` and register whatever `data.name` each file exports — nothing about the folder name itself is meaningful to Discord. So "Casino commands live in `commands/casino/`" is a convention this codebase follows, not a rule Discord enforces.

---

## 🎰 Casino (`commands/casino/`) — 10 files

All 7 "table games" (blackjack, dice, highlow, horse, roulette, poker, tic) plus slots and memory share the same session architecture: **setup screen → up to 5 plays → random-duration cooldown → optional next session.** See [FEATURES.md](FEATURES.md#casino-system) for the full mechanics.

| Command | Purpose | Notes |
|---|---|---|
| `/casino` | Hub — `menu`, `stats`, `leaderboard`, `vip`, `passport`, `daily`, `history`, `achievements` subcommands | Can't be a bare command (Discord doesn't allow subcommands + bare invocation together) — use `/casino menu` for the button-driven hub |
| `/blackjack` | Session-based blackjack vs. the house (Dealer Frank) | Real Hit/Stand/Double, 3:2 blackjack payout |
| `/dice` | Session-based over/under/exact dice betting (Dealer Old Tom) | |
| `/highlow` | Session-based higher/lower card guessing (Dealer Old Tom) | Fixed 2 rounds ago: dealer card is now shown fresh every round, not just round 1 |
| `/horse` | `race` (session-based betting), `buy` (own a horse, +5% win/+10% payout when it races), `stable` (view owned horses) | Race field of 5 drawn from a 10-horse roster, fixed per session |
| `/roulette` | Session-based color/parity/dozen/number betting (Dealer Lucy) | Specific-number bets use a modal (37 numbers exceeds Discord's 25-option select limit) |
| `/poker` | Progressive 3-Card Poker vs. a real dealt dealer hand (Dealer Frank) | ⚠️ See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — payout table needs rebalancing before wide use |
| `/slots` | 5 machines: Classic, Treasure, Kingdom (3-reel), Fortune Reels (5-reel), Mega Slots (3×3 grid) | Fortune Reels/Mega Slots payouts were rebalanced after simulation caught a severe EV bug — see CHANGELOG |
| `/tic` | House mode (session-based vs. AI) or `opponent:@user amount:N` for a real PvP wager | AI has 40% random-move chance + 50% chance the house opens, to avoid a fully deterministic/exploitable AI |
| `/memory` | Difficulty-based (`easy`/`medium`/`hard`) memory-match vault (Dealer Lucy) | Button-based grid, width matches board size; Hard mode paginates (36 cells > Discord's component limits) |

---

## ❌⭕ Tic Tac Toe PvP note
`/tic opponent:@user amount:N` sends a challenge with Accept/Decline buttons. Once accepted, both players click the same shared board message — this is the **only** casino game where two different users' interactions coordinate through persisted state (`tic_challenges` table), since every other game runs entirely within one player's single command execution.

---

## 🎮 Context Menu Commands (`commands/context/`) — 21 files, 15 deployed

Right-click a user → Apps → WhisperBot. All 21 files exist and work correctly; only 15 are actually registered with Discord (`deploy-commands.js`'s `CONTEXT_COMMAND_ALLOWLIST`), because **Discord caps USER-type context commands at 15 per guild.**

**Currently deployed (15):** Hug, Slap, Bonk, Highfive, Boop, Poke, Kiss, Handshake, Fish Slap, Pie, Ship With, Rate Rizz, Cheer, Applaud, Compliment

**Built but not deployed (6)** — still fully work as their original slash command, just no right-click shortcut: Punch (`/punch`), Throw Potato (`/throwpotato`), Throw Snowball (`/throwsnowball`), Fight (`/fight`), Bestie (`/bestie`), Check Aura (`/aura`)

Every context command reuses its underlying slash command's exact logic via a shared runner function (`runTargetInteraction`, `runSimpleResponseInteraction`, or `runShipInteraction` — see [ARCHITECTURE.md](ARCHITECTURE.md#social-engine)) — none of it is duplicated.

---

## 🤝 Social (`commands/social/`) — 30 files

Built on the **Social Engine** (`social-engine/`) — a 3-stage cinematic interaction system with rarity tiers, combo tracking, NPC interruptions, and achievements. Three sub-patterns:

**Target-based (18)** — `buildTargetCommand`, 3-stage story + rarity + combo: `hug`, `slap`, `bonk`, `highfive`, `boop`, `poke`, `kiss`, `handshake`, `cheer`, `applaud`, `compliment`, `fishslap`, `pie`, `punch`, `throwpotato`, `throwsnowball`, `fight`, `bestie`

**Simple-response (5)** — `buildSimpleResponseCommand`, 2-stage "thinking → reveal": `8ball` (requires a question), `coinflip`, `wouldyourather` (all `targetMode: "none"`); `rizz`, `aura` (`targetMode: "optional"`, defaults to self)

**Bespoke (1)** — `ship`: takes two separate target options, checks compatibility between them (not a repeated user↔target interaction, so no combo tracking)

**Read-only / leaderboard (6)** — no target needed: `halloffame`, `history`, `replay`, `sociallb`, `topmoments`

**Not in any prompt's list, exists anyway:** `yeet.js` — a 22nd interactive social command that was never accounted for when the context-menu commands were scoped. Worth knowing it's there.

---

## 📜 Lore (`commands/lore/`) — 1 file

| Command | Subcommands |
|---|---|
| `/lore` | `submit`, `random`, `latest`, `oldest`, `search`, `stats`, `hall`, `approve` (mod-only, needs Manage Messages) |

The Whisper Archives — a community-written mythology engine. Submissions are anonymous by design (never shows who submitted what) and require mod approval before becoming visible. A `node-cron` scheduler (`schedulers/loreBroadcast.js`) posts a random approved entry to the server twice daily, with a rare "legendary" variant.

---

## 🗺️ Quests (`commands/quests/`) — 2 files

| Command | Subcommands |
|---|---|
| `/quest` | `hub` (paginated Quest Board + Activities list + History placeholder), `start`, `active`, `leave`, `abandon` |
| `/quests` | Flat list of all available quests (no subcommands) |

`/quest` can't be bare (same Discord subcommand restriction as `/casino`) — `/quest hub` is the menu-driven entry point. 14 quests exist across social/voice/community/exploration categories.

---

## ⛏️ Activities (`commands/activities/`) — 13 files

Run-anytime, no-objective commands with random rewards and persistent (database-backed) cooldowns.

**Fully configured and working (7):** `/mine`, `/chop`, `/dig`, `/farm`, `/build`, `/nether`, `/end`

**⚠️ Commands exist, but have no config entry — currently non-functional (6):** `/hunt`, `/magic`, `/monster`, `/museum`, `/shipwreck`, `/treasure`. These load without crashing (graceful "Activity not found" error), but were added to `commands/activities/` without matching entries in `data/activities.js`. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

Fishing (`/fish`) is a separate, older, fully-built system in `commands/player/fish.js` — deliberately not folded into the activity system to avoid duplicating a feature that already works.

---

## 🏰 Kingdoms (`commands/kingdoms/`) — 2 files

| Command | Subcommands |
|---|---|
| `/kingdom` | `info`, `join`, `leave` |
| `/kingdoms` | (no subcommands — overview of all 4 kingdoms) |

Four kingdoms (North/East/South/West), each with its own color scheme and lore identity, referenced throughout the economy and casino (e.g. Kingdom Slots' bonus payout for matching your own kingdom's symbol).

---

## 💰 Economy (`commands/economy/`) — 6 files

| Command | Purpose |
|---|---|
| `/shop` | Visit the Whisper Marketplace (see `shop-engine/` — merchants, items, categories) |
| `/crate view` / `/crate open` | View Discord crate keys and published odds, or consume one key for a WhisperBot reward |
| `/racebet` | Challenge another player to a **daily-mission race** (NOT the casino's `/horse` — a completely separate system, kept deliberately separate per an earlier explicit requirement) |
| `/raceaccept` / `/racedecline` | Respond to a race challenge |
| `/races` | View active daily-mission races |

---

## 🧑 Player (`commands/player/`) — 7 files

| Command | Purpose |
|---|---|
| `/profile` | View a player's overall profile |
| `/stats` | View detailed stats |
| `/inventory` | View owned items |
| `/leaderboard` | Server-wide leaderboard(s) |
| `/daily` | View daily missions (different from `/here` below — this is quest-mission-tracking, not a check-in) |
| `/fish` | Full fishing minigame with its own flavor/treasure system — not part of the newer activity system |
| `/rob` | Attempt to rob another player — has its own heat/streak/cooldown persistence (`robbery_stats`, `robbery_logs` tables) |

---

## 📍 Daily (`commands/daily/`) — 1 file

| Command | Purpose |
|---|---|
| `/here` | Daily check-in with streak bonus — distinct from `/daily` (missions) above. Two different "daily" systems exist in this codebase; this is a real naming overlap worth being aware of, not a typo. |

---

## 🛠️ Admin (`commands/admin/`) — 7 files

| Command | Purpose |
|---|---|
| `/admin` | Unified tool: `coins` (add/remove/set/view), `inventory` (give/remove/clear/view), `stats` (view/reset), `reset` (coins/inventory/stats/all — all destructive actions require an explicit `confirm:true` option) |
| `/addxp` | Directly grant XP (dev/testing tool) |
| `/embedbuilder` | Interactive admin-only embed creation tool with live preview, modal editing, template save/load |
| `/questchannels` | Configure which channels quest progress tracks in |
| `/resetdaily` | Manually trigger the daily reset cycle |
| `/testvoice` | Voice XP testing tool — has permission checks now (previously a known gap, since fixed) |
| `/testxp` | XP testing tool — same permission-check fix applied |

---

## 🔧 Utility (`commands/utility/`) — 2 files

| Command | Purpose |
|---|---|
| `/help` | Shows available commands |
| `/ping` | Checks WhisperBot latency |
