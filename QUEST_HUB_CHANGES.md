# 📜 Quest Hub & Side Activities — What's New

## Deploy first
This adds new slash commands, so run `node deploy-commands.js` after
unzipping, then restart the bot.

## New commands
- **`/quest hub`** — the new Quest Journal. Shows active/available quest
  counts, then buttons into:
  - **📋 Quest Board** — paginated (5 per page), select a quest from a
    dropdown to see full details, then **Start Quest**.
  - **🎮 Activities** — lists all 7 new side activities plus the existing
    `/fish`, with their commands.
  - **📖 History** — disabled placeholder, per the spec ("do NOT implement
    bounties/history yet, just the menu placeholder"). `activity_history`
    and `quest_history` tables are already being written to, though, so
    whenever History gets built there's real data waiting for it.
  - 🏆 Bounties is shown as a "Coming Soon" field on the hub itself
    (not a button, since there's nothing to click into yet).
- **`/mine`, `/chop`, `/dig`, `/farm`, `/build`, `/nether`, `/end`** — 7
  new side activities. Run anytime, no objective, random coins/XP reward,
  persistent per-activity cooldown (~1-5 min, randomized).

## Untouched, exactly as requested
- **`/quest start`, `/quest active`, `/quest leave`, `/quest abandon`** —
  same subcommands, same `questService.js` functions, same behavior.
  Verified by testing every pre-existing function after the changes:
  `getQuest`, `startQuest`, `getActiveUserQuest`, `abandonQuest` all
  produce identical results to before.
- **`/quests`** (plural, the flat quest list) — completely untouched.
- **`/fish`** — completely untouched. See the conflict note below.
- All 14 existing quests keep every original field (`goal`, `type`,
  `rewardXP`, `rewardCoins`, `rewardRep`) exactly as they were — only new
  optional fields (`category`, `difficulty`, `emoji`) were added.

## Two conflicts I resolved instead of guessing

### `/quest` can't be a bare "open the hub" command
Same Discord API rule that came up with `/casino`: a slash command that
has subcommands (`start`, `active`, `leave`, `abandon` — all pre-existing)
can't *also* be invoked bare. There's no way to make plain `/quest` open
the journal without either breaking those subcommands or fighting the
Discord API. **Fix:** added `/quest hub` as a new subcommand. Everything
else about `/quest` — command name, existing subcommands, their
behavior — is unchanged.

### The spec wanted a fishing activity, but `/fish` already exists
`commands/player/fish.js` is a complete, polished fishing command — its
own cooldown handling, flavor text pool (`data/fishOutcomes.js`), and a
rare treasure-chest outcome. Command names are just keys in a `Map`
(`commandHandler.js`), so a second file also registering `.setName("fish")`
would have **silently overwritten the existing one** the moment the bot
loaded commands — no error, no warning, just gone. I didn't build a
competing `/fish` activity. The Activities list in the hub (and
`data/activities.js`'s header comment) references the existing `/fish`
instead of duplicating it.

## A smaller thing worth knowing about
The spec's prose describes activities as `!mine`-style prefix commands,
but the code sample it provides registers them with `SlashCommandBuilder`
— and this bot has no prefix-command message handler anywhere
(`events/messageCreate.js` only does XP tracking). Building a whole new
`!command` parser just to match the prose, when the actual code sample
and the rest of the bot both point at slash commands, would have been a
real architecture addition nobody asked for. Built `/mine`, `/chop`,
etc. as slash commands instead, consistent with all 71 other commands in
the bot.

## What else changed under the hood
- **`services/questService.js`**: added `getActiveQuests(userId)` and
  `getAvailableQuests(userId)` as new, additive functions. Nothing
  existing was edited. "Available" means "no `user_quests` row exists at
  all for that player+quest" — quests in this bot are one-time
  (`startQuest`'s existing-row check doesn't filter by `completed`), so
  available and never-started are the same thing.
- **`services/activityService.js`**: written in this codebase's plain
  functional-exports style (not the class-based example in the spec, to
  match every other service file) and built on top of `coinService`/
  `xpService` rather than raw `UPDATE users SET ...` — so mining a
  diamond and leveling up as a result actually triggers the bot's normal
  level-up flow, the same as any other XP source.
- **Persistent cooldowns**: same fix as the casino cooldown bug from
  last round — `activity_cooldowns` is a real table, not a local
  variable, so cooldowns survive leaving/re-running the command and bot
  restarts.
- **`/quest hub`'s navigation** deliberately does *not* follow the
  spec's own example code, which creates a brand new
  `channel.createMessageComponentCollector` every time a player opens
  the Quest Board or Activities view — each one keeps running until its
  own timeout, so navigating back and forth a few times leaves several
  redundant listeners alive on the same channel. Built it as a single
  loop over one message instead (same pattern used throughout the
  casino system), switching between hub/board/details/activities "views"
  without ever creating more than one collector.
- **`DISPLAY_MAX_ACTIVE_QUESTS = 5`** in `commands/quests/quest.js`
  is cosmetic only — it's what the hub shows as "Active Quests: X/5",
  matching the spec's mockup. Nothing in `questService.js` actually
  enforces a 5-quest cap; I didn't want to silently add a new gameplay
  restriction (blocking a 6th active quest) that wasn't explicitly asked
  for. If you do want a real cap enforced, that's a small, contained
  change to `startQuest()`.

## Testing performed
Same approach as every round before this — actually ran the code via the
`node:sqlite` shim, not just read it:
- Full project syntax sweep, zero failures.
- Require-graph test of all 14 new/touched files.
- Full `commandHandler.js` loader + Discord API JSON serialization check
  — **72 unique commands, zero collisions** (up from 65 — 7 new
  activities, `/quest` modified in place not duplicated), confirmed
  `/fish` present and untouched, confirmed all 7 new activity commands
  present.
- Ran `executeActivity` 1,000 times for `/mine` alone and tabulated the
  outcome distribution — landed close to the configured 5/20/40/30/5%
  weights. Verified all 7 activities' outcome tables individually sum to
  exactly 1.0 (a bug here would silently under- or over-weight the rarest
  outcomes).
- Verified persistent activity cooldowns block a second run and give the
  correct remaining time, same test shape as the casino cooldown fix.
- Directly tested quest board pagination against the real 14-quest data:
  3 pages, correct 5/5/4 split, confirmed starting a quest removes it
  from the available list, confirmed abandoning it correctly returns it.
- Re-verified every pre-existing `questService.js` function
  (`getQuest`, `startQuest`, `getActiveUserQuest`, `abandonQuest`)
  produces identical output before and after this change.
