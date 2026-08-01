# Notification Routing Audit & Fix — 2026-07-29

## Summary

Two reported routing bugs — Lore Archive posts landing in the Welcome
channel, and player-progression notifications having no fixed home at all —
plus a full audit of every automated (non-reply) announcement WhisperBot
sends, looking for the same class of problem elsewhere.

Both reported issues are fixed. The audit also turned up a third instance
of the exact bug pattern that caused the Lore Archive issue, in the casino
win announcer — documented but deliberately not changed, since no
destination was specified for it (see "Discovered, Not Fixed" below).

## Root Cause

**Lore Archive:** `schedulers/loreBroadcast.js` never had a configured
destination channel. Its `findBroadcastChannel()` guessed one at runtime:
prefer `guild.systemChannel`, otherwise the first text channel the bot can
post in. WhisperSMP's system channel is set to the Welcome channel, so
every scheduled broadcast landed there. The code even carried its own
warning about this (`// NOTE: for production use, store a per-guild
broadcastChannelId ... instead of guessing`) — this audit acted on that
note.

**Player Progression:** never had a routing bug in the sense of pointing at
a *wrong* channel ID — it had no fixed channel ID at all.
`events/messageCreate.js` posted level-up and level-based-achievement
embeds straight into `message.channel`, i.e. wherever the triggering chat
message happened to be sent. "Not routed correctly" in the request was
accurate: there was no routing, just ambient posting whichever channel a
player leveled up in.

## Files Inspected

Every place in the codebase that could plausibly post an unsolicited
message (searched for hardcoded channel IDs, `channel.send`, `systemChannel`,
achievement/level-up embed builders, and every service/scheduler/event
listed in the request):
- `schedulers/loreBroadcast.js`
- `services/loreService.js`, `commands/lore/lore.js` (confirmed the
  scheduler is the *only* place lore entries get auto-posted — `/lore`
  itself only ever replies to the invoking interaction)
- `events/messageCreate.js`
- `services/achievementService.js`, `social-engine/engine/AchievementTracker.js`
- `services/xpService.js`, `services/rewardService.js`
- `services/numerologyRewards.js`, `utils/numerologyMessageHandler.js`
  (achievement/milestone announcements scoped to the numerology channel
  itself — different system, left alone, see "Deliberately Not Changed")
- `commands/daily/here.js`, `commands/casino/{horse,slots,poker}.js`
  (achievement/level-up embeds shown as part of the command's own reply,
  not a broadcast — left alone, see "Deliberately Not Changed")
- `services/casinoAnnouncerService.js` (found via the "any additional
  notification routes" audit — see "Discovered, Not Fixed")
- `utils/adminLogger.js` (the existing config-driven channel-notifier
  pattern this fix follows)
- `config/*.js` (every existing config file, to confirm no channel ID
  duplication and to find the established convention for storing IDs)
- `.env` (confirmed WhisperBot's existing convention keeps channel IDs in
  `config/*.js` files, not environment variables — `DISCORD_TOKEN`,
  `CLIENT_ID`, `GUILD_ID` are the only `.env` values)

Full-project grep for every 17–19 digit number in any `.js` file, to catch
any hardcoded channel/ID that search terms might miss: found only
`adminConfig.js`'s `ADMIN_LOG_CHANNEL_ID`, `devConfig.js`'s developer ID,
and `numerologyConfig.js`'s `CHANNEL_ID` — none of which needed changes.

## Files Modified

- `schedulers/loreBroadcast.js` — removed `findBroadcastChannel()` and the
  `guild.systemChannel` guessing entirely; now posts via
  `announceLoreEntry()`
- `events/messageCreate.js` — level-up and level-achievement embeds now go
  through `announcePlayerProgression()` instead of `message.channel.send()`

## Files Created

- `config/notificationConfig.js` — `LORE_ARCHIVE_CHANNEL_ID`,
  `PLAYER_UPDATES_CHANNEL_ID`, `WELCOME_CHANNEL_ID` (reference only)
- `utils/notificationRouter.js` — `announceLoreEntry(client, embed)`,
  `announcePlayerProgression(client, embed)`

## Every Channel ID Involved

| Purpose | Channel ID | Before | After |
|---|---|---|---|
| Welcome channel (reference only — nothing should post here) | `1491498853998788800` | Lore Archive posts were landing here by accident | Nothing posts here |
| Lore Archive | `1520925678038683829` | Not used anywhere | Scheduled Lore Archive broadcasts |
| Player Updates | `1526546226890276905` | Not used anywhere | Level-ups + level-based achievement unlocks |

No other hardcoded channel IDs in the project needed to change —
`ADMIN_LOG_CHANNEL_ID`, `numerologyConfig.CHANNEL_ID`, and `devConfig`'s
developer ID are all correct, unrelated destinations that were already
centralized in their own config files.

## Configuration Improvements

- Channel IDs are no longer implicit/guessed for either fixed route — both
  now live in one file (`config/notificationConfig.js`), matching the
  request's own suggested naming (`WELCOME_CHANNEL_ID`,
  `LORE_ARCHIVE_CHANNEL_ID`, `PLAYER_UPDATES_CHANNEL_ID`) and the project's
  existing convention of per-domain config files (`adminConfig.js`,
  `numerologyConfig.js`, etc.) rather than introducing a new environment-variable
  pattern that nothing else in the project uses.
- `utils/notificationRouter.js` gives every future automated announcement a
  single, consistent way to reach its destination — fetch-by-ID with
  graceful failure — instead of each system reinventing its own channel
  lookup (which is exactly how the Lore Archive bug and the
  `casinoAnnouncerService.js` risk both happened independently). Adding a
  new announcement type is one new constant + one new function, not a new
  bespoke lookup.

## Deliberately Not Changed

- **Casino achievement unlocks shown inside a game's own result embed**
  (`commands/casino/{horse,slots,poker}.js`) and **`/here`'s level-up embed**
  (`commands/daily/here.js`) — these are inline confirmations within a
  command's own reply to the exact interaction that triggered them, not
  proactive server-wide announcements. Redirecting the achievement/level-up
  text out of a player's own game result and into a different channel
  would mean the player wouldn't see their own outcome in the message
  they're looking at — a real UX regression, not a routing fix. These
  weren't reported as broken and don't use any channel ID (correct or
  otherwise) today.
- **Numerology's own achievement/milestone announcements**
  (`utils/numerologyMessageHandler.js`) — scoped to the numerology counting
  channel itself (`config/numerologyConfig.js`'s already-correct
  `CHANNEL_ID`), which is the right destination for a numerology-specific
  event. Not part of the generic chat-XP progression system this audit was
  about.

## Discovered, Not Fixed

**`services/casinoAnnouncerService.js`** announces big casino wins using
`findAnnounceChannel()` — the identical `guild.systemChannel`-first,
first-postable-channel-fallback pattern that caused the Lore Archive bug.
This means casino win announcements are very likely *also* currently
landing in the Welcome channel, since it's the same guessed channel either
way.

This wasn't redirected as part of this fix because the request specified
exactly two destination channel IDs (Lore Archive, Player Updates) and
casino win announcements don't obviously belong in either — reassigning a
working, unrequested system's destination on a guess risked being wrong in
a different way. `config/notificationConfig.js` and
`utils/notificationRouter.js` are already built to make this a trivial
follow-up: add `CASINO_ANNOUNCER_CHANNEL_ID` to the config file, add
`announceCasinoWin()` to the router, swap `findAnnounceChannel()` out in
`casinoAnnouncerService.js` for the router call. Logged in
`docs/KNOWN_ISSUES.md` for visibility.

## Testing Performed

- `node --check` on every new/modified file — zero syntax errors.
- Full command/event/module load regression via the project's established
  `node:sqlite` shim workaround: 102 commands (zero collisions), 227 total
  modules (up from 225 — the two new files), zero load errors.
- `utils/notificationRouter.js` tested directly with a mocked
  `client.channels.fetch()`:
  - `announceLoreEntry()` → posts to `LORE_ARCHIVE_CHANNEL_ID`, confirmed
    it never touches `WELCOME_CHANNEL_ID`
  - `announcePlayerProgression()` → posts to `PLAYER_UPDATES_CHANNEL_ID`,
    same confirmation
  - Both tested against an unreachable channel (simulating a bad ID or a
    channel the bot can't see) — return `false`, log an error, never throw
- **Integration-level tests against the real modules, not just the
  router:**
  - Seeded a real `lore` row, ran `schedulers/loreBroadcast.js`'s actual
    `broadcastToGuild()` (cron itself stubbed out so only the broadcast
    logic ran) against a mocked client — confirmed the post landed on
    `LORE_ARCHIVE_CHANNEL_ID` and never on `WELCOME_CHANNEL_ID`.
  - Set a test user's XP to one point below a level-up threshold, ran
    `events/messageCreate.js`'s actual `execute()` against a mocked message
    (with `message.channel.send` deliberately rigged to throw if ever
    called, to prove nothing falls back to it) — confirmed both the
    level-up embed and the resulting level-based achievement embed posted
    to `PLAYER_UPDATES_CHANNEL_ID` and the rigged `message.channel` was
    never touched.

## Documentation Updated

- `docs/CHANGELOG.md` — new entry for this sprint
- `docs/KNOWN_ISSUES.md` — new entry for the discovered-but-unfixed
  `casinoAnnouncerService.js` risk
- `docs/ARCHITECTURE.md` — `config/` and `utils/` file-count listings
  corrected (both were already slightly stale before this sprint) and
  updated to include the two new files
- `docs/whisper-archives.md` — added a dated follow-up note to the existing
  "Fixed the broadcast channel picker" entry, since this sprint fully
  replaced that mechanism
- This file (`docs/updates/2026-07-29-notification-routing-audit.md`)

## Final Verification

- ✅ Lore Archive posts route to the Lore Archive channel (`1520925678038683829`).
- ✅ Level-up notifications route to the Player Updates channel (`1526546226890276905`).
- ✅ Achievement notifications route to the Player Updates channel (`1526546226890276905`).
- ✅ No WhisperBot system posts to the Welcome channel anymore (confirmed for
  both fixed routes; the one remaining risk — `casinoAnnouncerService.js` —
  is pre-existing, unchanged by this sprint, and clearly documented for a
  follow-up decision).
- ✅ Notification routing is centralized in `config/notificationConfig.js` +
  `utils/notificationRouter.js`, with zero channel ID duplication and a
  clear pattern for adding the next automated announcement type.
