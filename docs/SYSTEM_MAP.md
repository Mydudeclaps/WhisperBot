# 🗺️ WhisperBot System Map

## User Interaction Flow (general)

```
Discord User
      |
      v
Discord Interaction Event
      |
      v
events/interactionCreate.js  ---- is it a prefix-matched button? ---> local handler
      |                                (lore_*, casino_*, tic_accept_*/                 (e.g. loreInteractionHandler.js)
      | (chat input OR user context menu)  tic_decline_*/tic_pvp_move_*)
      v
client.commands.get(interaction.commandName)
      |
      v
command.execute(interaction)
      |
      v
Service layer (casinoService, questService, loreService, activityService, etc.)
      |
      v
database/database.js (whisperbot.db)
      |
      v
Response embed (utils/embedFactory.js)
```

---

## Casino Session Flow

```
/blackjack (or /dice, /highlow, /horse, /roulette, /poker, /tic, /slots, /memory)
 |
 v
casinoService.checkCooldown(userId, gameType) --- on cooldown? ---> blocked embed, stop
 |
 v
Setup screen (bet select, difficulty, etc.) via casinoSessionUI.js
 |
 v
Session loop: up to 5 plays, ONE message edited in place
 |         |
 |         +--> each play: casinoStatsService.recordBet()
 |         |               casinoService.awardGameXP()
 |         |               casinoService.logGameResult()
 |         |               jackpotService.contribute() (+ rare roll)
 |         |               casinoNpcService (NPC dialogue)
 |
 v
5 plays used --> casinoService.getRandomCooldown() --> startCooldown() (persistent)
 |
 v
Session ends (Leave / idle timeout) --> casinoSessionSummaryEmbed
```

### Tic Tac Toe PvP (the one exception)

```
/tic opponent:@user amount:N
 |
 v
ticService.createChallenge() --> tic_challenges table (status: pending)
 |
 v
Challenge message posted with Accept/Decline buttons
 |
 v
events/interactionCreate.js routes tic_accept_*/tic_decline_* -->
    utils/ticPvpInteractionHandler.js
 |
 v
Accepted --> board persisted in tic_challenges, alternating players click
             the SAME message across SEPARATE interaction events
 |
 v
Each move: ticPvpInteractionHandler reads challenge by message.id,
           applies move, checks winner, persists, re-renders
 |
 v
Game over --> settles both players' coins/XP/stats/history in one pass
```

---

## Activity System Flow

```
/mine (or /chop, /dig, /farm, /build, /nether, /end)
 |
 v
activityService.checkCooldown(userId, activityId)  --- on cooldown? ---> blocked
 |
 v
activityService.executeActivity()
 |    |
 |    +--> getWeightedOutcome() (from data/activities.js)
 |    +--> coinService.addCoins() + xpService.addXP() (real leveling, not a bypass)
 |    +--> startCooldown() (persistent, random duration)
 |    +--> recordHistory() --> activity_history table
 |
 v
Result embed (10% chance of NPC flavor line)
```

⚠️ 6 of the 13 files in `commands/activities/` (hunt, magic, monster, museum, shipwreck, treasure) hit this flow's very first step and immediately fail at `getActivity(activityId)` returning null — there's no matching entry in `data/activities.js`. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

---

## NPC Dialogue Flow (Casino)

```
Any casino game's result
 |
 v
services/casinoNpcService.js
 |    npcLineForGame(game, "win"/"lose"/"catchphrase")
 |    frankPokerLine(stage)      <- poker-specific, richer stage dialogue
 |    lucyMemoryLine(stage)      <- memory-specific, richer stage dialogue
 |
 v
data/casinoNpcs.js  (Frank, Luca, Old Tom, Silas, Lucy — each tagged with
                      which games they appear in)
 |
 v
Formatted dialogue line appended to the result embed
```

---

## Quest System Flow

```
/quest hub
 |
 v
questService.getActiveQuests() / getAvailableQuests()
 |
 v
Paginated Quest Board (5 per page) --> select a quest --> details view
 |
 v
Start Quest --> questService.startQuest() --> user_quests table
 |
 v
Progress tracked via services/events/messagePipeline.js (message-driven)
                and services/events/emojiReactionService.js (reaction-driven)
 |
 v
Quest complete --> questRewardService.js grants rewards
```

---

## Lore System Flow

```
/lore submit
 |
 v
loreService.submitEntry() --> lore table (approved: false)
 |
 v
Moderator runs /lore approve --> button-based approve/reject
 |    (routed through events/interactionCreate.js's lore_* prefix
 |     --> utils/loreInteractionHandler.js)
 |
 v
Approved entries become visible via /lore random, /lore latest, etc.
 |
 v
schedulers/loreBroadcast.js (node-cron, twice daily)
    --> picks a random approved entry --> posts to a permission-checked channel
    --> 2% chance marks it "legendary" for that broadcast
```

---

## System Relationships

| System | Depends On | Used By |
|---|---|---|
| `casinoService` | `database/database.js`, `settingsService` (jackpot/lucky number via `bot_settings`) | Every casino game command |
| `casinoStatsService` | `database/database.js` (`casino_stats` table — column names built dynamically per game) | Every casino game, `/casino passport`/`stats`/`leaderboard` |
| `jackpotService` | `settingsService` | Every casino game (1% contribution per bet) |
| `casinoNpcService` | `data/casinoNpcs.js` | Every casino game |
| Social Engine (`social-engine/`) | `database/database.js` (`social_stats`, `social_history`, `active_combos`) | All 30 social commands + 21 context menu commands |
| `activityService` | `data/activities.js`, `coinService`, `xpService` | All 13 activity commands (7 working, 6 unconfigured) |
| `loreService` | `database/database.js` (`lore` table) | `/lore`, `loreBroadcast.js` scheduler |
| `questService` | `database/database.js` (`quests`, `user_quests`, `quest_history`) | `/quest`, `/quests` |
| `ticService` | `database/database.js` (`tic_challenges`) | `/tic` PvP mode only — house mode is self-contained in `tic.js` |
| `shop-engine/` | `data/merchants.json`, `items.json`, `categories.json` | `/shop` |
| `embedFactory.js` | `config/constants.js` (COLORS) | Casino, lore, quests, activities — the vast majority of the bot's embeds |
