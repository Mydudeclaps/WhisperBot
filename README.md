# 🕊️ WhisperBot

**A cinematic social & economy Discord bot built for immersive server experiences.**

![Version](https://img.shields.io/badge/version-1.0.0-blueviolet)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.x-339933?logo=node.js&logoColor=white)
![Status](https://img.shields.io/badge/status-online-brightgreen)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> *"We're not building commands. We're building experiences."* — WhisperBot Social Engine

---

## 📋 Table of Contents

- [Introduction](#-introduction)
- [Quick Start](#-quick-start)
- [Command Categories](#-command-categories)
  - [General](#general-commands)
  - [Economy & Gambling](#economy--gambling)
  - [Social](#social-commands-the-social-engine)
  - [Fishing](#fishing)
  - [Quests & Progression](#quests--progression)
  - [Daily Missions](#daily-missions)
  - [Kingdoms](#kingdoms)
  - [Leaderboards](#leaderboards)
  - [Inventory](#inventory)
  - [Miscellaneous](#miscellaneous)
- [The Social Engine — Deep Dive](#-the-social-engine--deep-dive)
- [Server Lore Integration](#-server-lore-integration)
- [Visual Features](#-visual-features)
- [Technical Information](#-technical-information)
- [FAQ](#-frequently-asked-questions)
- [Contributing](#-contributing)
- [Credits & Acknowledgments](#-credits--acknowledgments)

---

## 🌟 Introduction

**WhisperBot** is a story-driven Discord bot that turns everyday server interactions — hugs, bets, quests, kingdoms — into cinematic, replayable moments. Instead of a flat "you hugged @user" message, every social command unfolds in stages, rolls for rarity, tracks combos, and occasionally pulls in a cast of recurring NPCs tied to your server's lore.

**Key Features:**
- 🎭 **Cinematic 3-stage interactions** for social commands
- 🎰 **Full economy suite** — blackjack, high/low, dice, races
- 🌈 **Rarity system** with six tiers, from Common to Divine
- 🔥 **Combo tracking** that rewards repeated interactions
- 🏆 **30+ achievements** with unlockable cosmetic titles
- 👻 **NPC cameos** woven into your server's story
- 🏰 **Kingdom system** for group progression
- 🎣 **Fishing, quests, and daily missions**

**[Invite WhisperBot to your server →](#)** *(placeholder link)*

---

## 🚀 Quick Start

1. **[Click here to invite WhisperBot](#)** *(placeholder invite link)*
2. Grant the requested permissions during setup (see [Permissions Required](#permissions-required))
3. Run `/help` in your server to see all available commands
4. Run `/here` to claim your first daily check-in
5. Try `/hug @someone` to see the Social Engine in action!

No additional setup commands are required to get started — WhisperBot works out of the box.

---

## 📜 Command Categories

### General Commands

| Command | Description |
|---|---|
| `/ping` | Check bot latency *(shows thumbnail + banner)* |
| `/help` | View all commands |
| `/stats` | View your statistics *(shows thumbnail + banner)* |
| `/profile` | View your profile *(shows avatar + command image)* |

### Economy & Gambling

| Command | Description |
|---|---|
| `/bet` | Open the gambling hall *(shows thumbnail + banner)* |
| `/highlow` | Play High/Low against the dealer |
| `/blackjack` | Play Blackjack |
| `/dice` | Roll dice and bet |
| `/racebet` | Challenge someone to a daily race |
| `/raceaccept` | Accept a race challenge |
| `/racedecline` | Decline a race challenge |
| `/races` | View active races |

### Social Commands (The Social Engine)

| Command | Description |
|---|---|
| `/hug` | Hug another user *(3-stage cinematic flow)* |
| `/slap` | Slap another user *(3-stage cinematic flow)* |
| `/poke` | Poke another user *(3-stage cinematic flow)* |
| `/bonk` | Bonk another user *(3-stage cinematic flow)* |
| `/highfive` | High-five another user *(3-stage cinematic flow)* |
| `/compliment` | Compliment another user *(3-stage cinematic flow)* |
| `/8ball` | Ask the magic 8-ball *(2-stage flow)* |
| `/kiss` | Kiss another user |
| `/boop` | Boop another user |
| `/handshake` | Handshake another user |
| `/cheer` | Cheer for another user |
| `/applaud` | Applaud another user |
| `/ship` | Ship two users together |
| `/bestie` | Declare someone your bestie |
| `/rizz` | Rate your rizz (self or target) |
| `/aura` | Check your aura (self or target) |
| `/fight` | Fight another user (comedic) |
| `/throwpotato` | Throw a potato at someone |
| `/throwsnowball` | Throw a snowball at someone |
| `/pie` | Pie someone in the face |
| `/yeet` | Yeet someone |
| `/fishslap` | Slap someone with a fish |
| `/coinflip` | Flip a coin |
| `/wouldyourather` | Play Would You Rather |

### Fishing

| Command | Description |
|---|---|
| `/fish` | Go fishing *(shows avatar + command image)* |

### Quests & Progression

| Command | Description |
|---|---|
| `/quests` | View available quests |
| `/quest start` | Start a quest |
| `/quest active` | View your active quests |

### Daily Missions

| Command | Description |
|---|---|
| `/daily` | View your daily missions |
| `/here` | Daily check-in |

### Kingdoms

| Command | Description |
|---|---|
| `/kingdom` | Manage your kingdom |
| `/kingdoms` | View all kingdoms |

### Leaderboards

| Command | Description |
|---|---|
| `/leaderboard` | View server leaderboards |

### Inventory

| Command | Description |
|---|---|
| `/inventory` | View your inventory |

### Miscellaneous

| Command | Description |
|---|---|
| `/casino` | Casino stats and leaderboard |
| `/rob` | Rob another player *(with DM interaction)* |

---

## 🎬 The Social Engine — Deep Dive

The Social Engine is WhisperBot's signature system — it powers every social command with narrative structure, randomness, and long-term progression.

### How It Works

Every social command plays out in stages rather than resolving instantly:

1. **Intro** — a short setup line establishes the scene
2. **Action** — a 2–3 second delay builds anticipation before the action resolves
3. **Outcome** — a rich embed reveals the result, rarity, combo status, and any achievement progress

With hundreds of possible outcome variations per command, no two interactions feel quite the same.

### Rarity System

Every interaction rolls for a rarity tier, which determines the flavor of the outcome and its embed color:

| Rarity | Chance | Color | Emoji |
|---|---|---|---|
| Common | ~50% | `#808080` | ⭐ |
| Uncommon | ~25% | `#1E90FF` | 🌟 |
| Rare | ~15% | `#9B59B6` | ✨ |
| Epic | ~7% | `#F1C40F` | 👑 |
| Legendary | ~2.5% | `#E74C3C` | 🔮 |
| Divine | ~0.5% | `#FFD700` | ☀️ |

### Achievements & Titles

- **30+ achievements** to unlock across social, economy, and progression systems
- Achievements grant **cosmetic titles** displayed on your `/profile`
- Lifetime stats (total hugs, biggest bets, longest combo, etc.) are tracked automatically

### Combo System

- Repeated interactions with the same user build a **combo chain**
- Combos have a **5-minute window** — let it lapse and the chain resets
- Longer combo chains unlock **special bonus dialogue**
- Your highest combo streak is tracked on your profile

### NPC Cameos

There's a small chance any social command gets interrupted by a recurring NPC from the server's lore:

- **Cast includes:** Lucy, Old Tom, Tree of Life, Kingdom Messenger, Whisper Merchant, Nami
- **Trigger chance:** 2–5% per interaction
- NPC dialogue is **contextual** — it reacts to the specific command being used

### Plot Twists & Seasonal Events

- Rare **plot twist** outcomes occasionally subvert the expected result entirely
- **Seasonal events** (Halloween, Christmas, and others) temporarily reskin outcomes and rarity flavor text

---

### Example: `/hug`

```markdown
### /hug

**Description:** Give someone a warm hug
**Usage:** /hug @user
**Category:** Social
**Flags:** Target required, Self allowed
**Images:** Shows thumbnail + banner

**Interaction Flow:**
1. "Brandon opens their arms wide toward Steve..."
2. "Brandon wraps Steve in a warm embrace!"
3. [Embed with story, rarity, combo, achievements]

**Rarity Outcomes:**
- Common: "Steve feels the love!"
- Legendary: "Steve lost both shoes!"
- Divine: "The universe itself seemed to hug back!"

**Achievements:**
- First Hug → "Warm Heart" title
- Hug Champion (500 hugs) → "Master Hugger" title
```

*(This same documentation format applies to every command in the Social Commands table above — see the full command reference in-server via `/help <command>`.)*

---

## 📖 Server Lore Integration

WhisperBot isn't a generic bot skin — it's woven into your server's own story:

- **NPC cameos** pull directly from your server's cast of characters and their established personalities
- The **Kingdom system** ties player progression to your server's factions or regions
- Recurring figures like **Tree of Life**, **Lucy**, and **Old Tom** appear with dialogue that reflects their role in your lore

---

## 🎨 Visual Features

- **Command Thumbnails & Banners** — many commands display custom artwork alongside their embed
- **Consistent Embed Design** — a clean, unified visual style across all commands
- **Progress Bars** — colored bars visualize quest and mission completion
- **ANSI Color Codes** — colored text rendered inside code blocks for extra polish

---

## ⚙️ Technical Information

### Permissions Required

- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Use Slash Commands
- Add Reactions *(for auto-reactions)*

### Links

- **Bot Invite Link:** *(placeholder)*
- **Support Server:** *(placeholder)*
- **GitHub Repository:** *(placeholder)*

---

## ❓ Frequently Asked Questions

**How do I check my stats?**
Run `/stats` or `/profile` to see your interaction history, achievements, and titles.

**How do I get more coins?**
Play the economy games (`/bet`, `/blackjack`, `/highlow`, `/dice`), complete daily missions with `/daily`, and check in with `/here`.

**What are the daily missions?**
A rotating set of objectives shown via `/daily`. Completing them rewards coins and progress toward achievements.

**How does the Social Engine work?**
Every social command runs through a 3-stage cinematic flow, rolls for rarity, and can trigger combos, achievements, or NPC cameos. See [The Social Engine — Deep Dive](#-the-social-engine--deep-dive) above.

**What's the rarest outcome?**
**Divine**, at roughly a 0.5% chance per interaction.

**How do I unlock titles?**
Titles are earned by completing specific achievements — check your progress with `/profile`.

**What happens if an NPC appears?**
An NPC has a 2–5% chance of cameoing in any social interaction, adding unique contextual dialogue tied to your server's lore.

**Can I play with friends?**
Yes — most social and economy commands target another user directly, and races (`/racebet`) are built specifically for head-to-head play.

---

## 🤝 Contributing

- **Found a bug?** Open an issue on the [GitHub Repository](#) *(placeholder)* with steps to reproduce it.
- **Have a feature idea?** Suggest it in the [Support Server](#) *(placeholder)* or open a GitHub discussion.
- **Want to contribute code?** Fork the repository, create a feature branch, and submit a pull request — contribution guidelines are in `CONTRIBUTING.md` *(placeholder)*.

---

## 🙏 Credits & Acknowledgments

- **Developer:** *(placeholder)*
- **Contributors:** *(placeholder)*
- **Special Thanks:** To everyone in the community testing early builds of the Social Engine.

---

### Screenshots

*(Add real screenshots to a `screenshots/` folder and update the paths below.)*

```markdown
![Example of /hug command](screenshots/hug-example.png)
![Social Engine Embed](screenshots/social-embed.png)
![Rarity System](screenshots/rarity-system.png)
```

---

<p align="center"><i>Made with 🕊️ for immersive Discord communities.</i></p>
