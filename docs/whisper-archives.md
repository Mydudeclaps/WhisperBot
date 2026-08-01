# The Whisper Archives — Setup

## 1. Install dependencies
```bash
npm install node-cron
```

## 2. Copy files
Drop the folders (`commands/lore`, `services`, `models`, `schedulers`, `utils`) into your bot's root, merging with your existing structure.

## 3. Register the command
In your command loader, register `commands/lore/lore.js` the same way you register your other slash commands (it exports `data` + `execute`, matching the standard discord.js pattern).

## 4. Wire up the approve/reject buttons
```js
const handleLoreButton = require('./utils/loreInteractionHandler');

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith('lore_')) {
        return handleLoreButton(interaction);
    }
    // ...your existing interaction routing
});
```

## 5. Start the broadcast scheduler
```js
const LoreBroadcast = require('./schedulers/loreBroadcast');
new LoreBroadcast(client);
```

## 6. Deploy the command
Push `lore.js`'s `data` through your usual slash-command deployment script.

---

## What changed from the original spec, and why

- **One command file, not nine.** discord.js registers *subcommands* under a single top-level command, so `/lore submit`, `/lore random`, etc. all have to live in one `data`/`execute` export — that's `commands/lore/lore.js`. Splitting it into `submit.js`, `random.js`, ... as separate registered commands would create nine top-level slash commands instead of one `/lore` with subcommands.
- **Fixed a schema bug:** `archiveNumber` had `unique: true` globally, but numbers are assigned per-guild (`archiveNumber = lastEntry.archiveNumber + 1` scoped to `guildId`). Two different guilds would both mint archive #1 and the second insert would throw a duplicate-key error. Changed to a compound unique index on `{ guildId, archiveNumber }`.
- **Fixed the broadcast channel picker:** `guild.channels.cache.find(c => c.type === 0)` picks the first text channel regardless of whether the bot can actually post there, causing silent `Missing Access` failures. `findBroadcastChannel()` now checks `ViewChannel` + `SendMessages` permissions first. For real production use, swap this for a stored per-guild channel ID (e.g. via a `/lore setchannel` admin command) rather than guessing — I left a note in the code for that.

  **Update, 2026-07-29:** that note was acted on. `findBroadcastChannel()`'s `guild.systemChannel`-guessing was removed entirely — it had been silently landing every scheduled Lore Archive post in WhisperSMP's Welcome channel (that channel happened to be the guild's configured system channel). Broadcasts now go through `utils/notificationRouter.js` to a fixed, correctly-configured `LORE_ARCHIVE_CHANNEL_ID` in `config/notificationConfig.js`. See `docs/updates/2026-07-29-notification-routing-audit.md`.
- **Removed the broken thumbnail:** `cdn.discordapp.com/emojis/⭐.png` isn't a real emoji CDN URL and would just fail to load. Dropped `setThumbnail` for legendary entries; the gold color + title change already carries that signal. Swap in a real custom emoji/asset ID if you have one.
- **Made `/lore submit` and `/lore approve` ephemeral** (`flags: 64`) — submission confirmations and moderation review are private by design, matching the "author is intentionally unknown" philosophy; only approved entries should ever become visible to the server.
- **Implemented the approve/reject flow** the original left as "could implement button-based approval system here." `/lore approve` now posts each pending entry with Approve/Reject buttons; `utils/loreInteractionHandler.js` handles the clicks and calls the existing `approveEntry`/`deleteEntry` service methods.
- **Basic embed sanitization:** submitted text can contain backticks or get long; `sanitizeForEmbed()` neutralizes stray ``` sequences (which would otherwise break embed code-block formatting) and caps length.

## Not implemented (left as-is per "optional future enhancements")
AI auto-categorization, lore quests, themed weeks, and the lore map are still open — the service layer (`loreService.js`) is structured so those can hook in without touching the command layer.
