const fs = require("fs");
const path = require("path");

const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

const { COLORS } = require("../config/constants");

const { getKingdomList } = require("../services/kingdomService");

const { progressBar, riskLabel } = require("./robberyUtils");

const ShopManager = require("../shop-engine/engine/ShopManager");

const kingdoms = getKingdomList();


// ---------------------------------------------------------------------
// Automatic command thumbnails
//
// Drop an image into assets/images/ named after a slash command (e.g.
// "rob.gif" or "profile.png") and it will automatically be attached as
// that command's embed thumbnail — no per-command wiring needed.
// ---------------------------------------------------------------------

const IMAGES_DIR = path.join(__dirname, "..", "assets", "images");

// Checked in this order for a given command name; first match wins.
const THUMBNAIL_EXTENSIONS = [".gif", ".png", ".jpg", ".webp"];


// Looks in assets/images/ for a file named "<commandName>.<ext>" (gif >
// png > jpg > webp), falling back to "default.png" if nothing matches.
// Returns a named AttachmentBuilder (so it can be referenced via
// "attachment://<name>" in an embed) or null if no image is available —
// including no default.png — so callers can skip the thumbnail cleanly.
function getCommandThumbnail(commandName) {

    for (const ext of THUMBNAIL_EXTENSIONS) {

        const fileName = `${commandName}${ext}`;
        const filePath = path.join(IMAGES_DIR, fileName);

        if (fs.existsSync(filePath)) {
            return new AttachmentBuilder(filePath, { name: fileName });
        }

    }

    const defaultPath = path.join(IMAGES_DIR, "default.png");

    if (fs.existsSync(defaultPath)) {
        return new AttachmentBuilder(defaultPath, { name: "default.png" });
    }

    return null;

}


// Attaches the command's image as a normal embed thumbnail (top-right).
// Returns { embed, files } — files is [] when no image was found, so it
// can always be spread straight into interaction.reply/editReply.
function withThumbnail(embed, commandName) {

    const thumb = getCommandThumbnail(commandName);

    if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

    return { embed, files: thumb ? [thumb] : [] };

}


// For embeds that use the same image for both thumbnail and large image
function withThumbnailAndImage(embed, commandName) {

    const thumb = getCommandThumbnail(commandName);
    
    if (thumb) {
        embed.setThumbnail(`attachment://${thumb.name}`);
        embed.setImage(`attachment://${thumb.name}`);
    }
    
    return { embed, files: thumb ? [thumb] : [] };
}

// For embeds that use a separate thumbnail and large image, e.g. /bet

function withThumbnailAndImageSeparate(embed, thumbName, imageName) {
    const thumb = getCommandThumbnail(thumbName);
    const image = getCommandThumbnail(imageName);
    const files = [];
    
    if (thumb) {
        embed.setThumbnail(`attachment://${thumb.name}`);
        files.push(thumb);
    }
    
    if (image) {
        embed.setImage(`attachment://${image.name}`);
        files.push(image);
    }
    
    return { embed, files };
}

// Adds BOTH a thumbnail AND a banner image to any embed
// Uses: commandName.png for thumbnail, commandName_banner.png for banner
function withThumbnailAndBanner(embed, commandName) {
    const thumb = getCommandThumbnail(commandName);
    const banner = getCommandThumbnail(`${commandName}_banner`);
    const files = [];
    
    if (thumb) {
        embed.setThumbnail(`attachment://${thumb.name}`);
        files.push(thumb);
    }
    
    if (banner) {
        embed.setImage(`attachment://${banner.name}`);
        files.push(banner);
    }
    
    return { embed, files };
}

// For embeds that already use the thumbnail slot for the player's avatar
// — the command image goes into the large embed image slot at the
// bottom instead, so neither one gets bumped.
function withImage(embed, commandName) {

    const thumb = getCommandThumbnail(commandName);

    if (thumb) embed.setImage(`attachment://${thumb.name}`);

    return { embed, files: thumb ? [thumb] : [] };

}

// ANSI color codes usable inside Discord ```ansi code blocks
const ANSI = {
    GRAY: "30",
    RED: "31",
    GREEN: "32",
    YELLOW: "33",
    BLUE: "34",
    PINK: "35",
    CYAN: "36",
    WHITE: "37"
};

// Wraps a single value in a Discord ansi code block so it renders in its
// own color, distinct from the (plain/bold) field label next to it.
function colorText(text, colorCode, bold = true) {
    return "```ansi\n" + `\u001b[${bold ? 1 : 0};${colorCode}m${text}\u001b[0m` + "\n```";
}

// Wraps a progress bar in a Discord ansi code block so it renders in color
// (red/yellow/green depending on completion). Falls back gracefully to
// plain monospace text on clients that don't support ansi code blocks.
function coloredBar(bar, percent) {

    let colorCode = ANSI.GREEN;

    if (percent < 0.34) colorCode = ANSI.RED;
    else if (percent < 0.67) colorCode = ANSI.YELLOW;

    return colorText(bar, colorCode);

}

// Kingdom name -> ansi color pulled from data/kingdoms.js, so a player's
// kingdom field matches their kingdom's identity everywhere it shows up.


function baseEmbed(title, description, color = COLORS.INFO) {

    return new EmbedBuilder()

        .setTitle(title)

        .setDescription(description)

        .setColor(color)

        .setFooter({
            text: "WhisperBot • WhisperSMP"
        })

        .setTimestamp();

}



function successEmbed(message) {

    return baseEmbed(
        "✅ Success",
        message,
        COLORS.SUCCESS
    );

}



function errorEmbed(message) {

    return baseEmbed(
        "❌ Error",
        message,
        COLORS.ERROR
    );

}



function infoEmbed(title, message) {

    return baseEmbed(
        title,
        message,
        COLORS.INFO
    );

}



function profileEmbed(user, rank, title, bar, neededXP, avatarURL) {

    const kingdomInfo = kingdoms[user.kingdom];

    const kingdomColor = kingdomInfo ? kingdomInfo.color : COLORS.INFO;

    const kingdomAnsi = kingdomInfo ? kingdomInfo.ansi : ANSI.GRAY;

    const kingdomDisplay = kingdomInfo
        ? colorText(`${kingdomInfo.icon} ${kingdomInfo.name}`, kingdomAnsi)
        : colorText("None", ANSI.GRAY);

    const percent = neededXP > 0 ? user.xp / neededXP : 0;

    const embed = new EmbedBuilder()

        .setAuthor({
            name: `${user.username}'s Profile`,
            iconURL: avatarURL
        })

        .setColor(kingdomColor)

        .addFields(

            {
                name: "🏆 Server Rank",
                value: colorText(`#${rank}`, ANSI.CYAN),
                inline: true
            },

            {
                name: "🏷️ Title",
                value: colorText(title, ANSI.PINK),
                inline: true
            },

            {
                name: "⭐ Level",
                value: colorText(`${user.level}`, ANSI.YELLOW),
                inline: true
            },

            {
                name: "✨ Experience",
                value: `**${user.xp} / ${neededXP} XP**\n${coloredBar(bar, percent)}`,
                inline: false
            },

            {
                name: "💰 Coins",
                value: colorText(user.coins.toLocaleString(), ANSI.GREEN),
                inline: true
            },

            {
                name: "🏰 Kingdom",
                value: kingdomDisplay,
                inline: true
            },

            {
                name: "📅 Joined",
                value: colorText(user.joined, ANSI.BLUE),
                inline: true
            }

        )

        .setThumbnail(avatarURL)

        .setFooter({
            text: "WhisperBot • WhisperSMP"
        })

        .setTimestamp();

      // 🔥 Only add the banner as a large image - don't touch the thumbnail
    const banner = getCommandThumbnail("profile_banner");
    const files = [];

    if (banner) {
        embed.setImage(`attachment://${banner.name}`);
        files.push(banner);
    }

    return { embed, files };
}

function fishResultEmbed(username, text, payout, newBalance, avatarURL) {

    const embed = new EmbedBuilder()
        .setTitle("🎣 Fishing")
        .setDescription(`**${username}**\n\n${text}`)
        .setColor(payout > 0 ? COLORS.SUCCESS : COLORS.INFO)
        .setFooter({
            text: "WhisperBot • Fishing"
        })
        .setTimestamp();

    if (payout > 0) {
        embed.addFields(
            {
                name: "💰 Payout",
                value: colorText(`+${payout.toLocaleString()} Coins`, ANSI.GREEN),
                inline: true
            },
            {
                name: "💵 Balance",
                value: colorText(newBalance.toLocaleString(), ANSI.CYAN),
                inline: true
            }
        );
    }

    if (avatarURL) embed.setThumbnail(avatarURL);

    return withThumbnailAndImageSeparate(embed, "fish", "fish_banner");

}


function levelUpEmbed(username, level, reward) {


    return new EmbedBuilder()

        .setTitle("🎉 Level Up!")

        .setColor(COLORS.SUCCESS)

        .setDescription(

            `**${username}** reached **Level ${level}!**`

        )

        .addFields(

            {
                name: "⭐ New Level",
                value: colorText(`${level}`, ANSI.YELLOW),
                inline: true
            },

            {
                name: "💰 Reward",
                value: colorText(`+${reward} Coins`, ANSI.GREEN),
                inline: true
            }

        )

        .setFooter({

            text:
            "WhisperBot • WhisperSMP"

        })

        .setTimestamp();

}

function achievementEmbed(achievement) {

    return new EmbedBuilder()

        .setTitle("🏆 Achievement Unlocked!")

        .setColor(COLORS.WARNING)

        .setDescription(

            `**${achievement.name}**\n\n` +

            `*${achievement.description}*`

        )

        .addFields(

            {
                name: "💰 Reward",
                value: colorText(`+${achievement.rewardCoins} Coins`, ANSI.GREEN),
                inline: true
            },

            {
                name: "⭐ Bonus XP",
                value: colorText(`+${achievement.rewardXP}`, ANSI.YELLOW),
                inline: true
            }

        )

        .setFooter({

            text: "WhisperBot • Achievements"

        })

        .setTimestamp();

}

function dailyMissionCompleteEmbed(mission, reward) {
    return new EmbedBuilder()
        .setTitle("🎉 Daily Mission Complete!")
        .setDescription(
            `**${mission.name}**\n\n` +
            `*${mission.description}*`
        )
        .addFields(
            {
                name: "✨ XP",
                value: colorText(`+${reward.rewardXP}`, ANSI.YELLOW),
                inline: true
            },
            {
                name: "💰 Coins",
                value: colorText(`+${reward.rewardCoins}`, ANSI.GREEN),
                inline: true
            },
            {
                name: "🏰 Reputation",
                value: colorText(`+${reward.rewardRep}`, ANSI.CYAN),
                inline: true
            }
        )
        .setColor(COLORS.SUCCESS)
        .setFooter({
            text: "WhisperBot • Daily Missions"
        })
        .setTimestamp();
}

function dailyMissionEmbed(username, missions, missionData, avatarURL) {

    const fields = [];

    let totalPercent = 0;
    let count = 0;

    for (const mission of missions) {
        const info = missionData[mission.mission_id];
        if (!info) continue;

        const percent = Math.min(mission.progress / info.goal, 1);
        totalPercent += percent;
        count++;

        const filled = Math.round(percent * 10);
        const bar = "█".repeat(filled) + "░".repeat(10 - filled);

        const status = percent >= 1 ? "✅" : "🎯";

        fields.push({
            name: `${status} ${info.name}`,
            value:
                `*${info.description}*\n` +
                coloredBar(bar, percent).replace(
                    "\n```",
                    ` ${mission.progress}/${info.goal}\n\`\`\``
                ) +
                `✨ **${info.rewardXP} XP**  •  💰 **${info.rewardCoins} Coins**  •  🏰 **${info.rewardRep} Rep**`,
            inline: false
        });
    }

    // Accent color reflects overall completion: red -> yellow -> green
    const overallPercent = count > 0 ? totalPercent / count : 0;

    let embedColor = COLORS.ERROR;
    if (overallPercent >= 1) embedColor = COLORS.SUCCESS;
    else if (overallPercent >= 0.34) embedColor = COLORS.WARNING;

    const embed = new EmbedBuilder()
        .setTitle("🌅 WhisperBot Daily Missions")
        .setColor(embedColor)
        .addFields(fields)
        .setFooter({
            text: `${username}'s Daily Missions`
        })
        .setTimestamp();

    if (avatarURL) embed.setThumbnail(avatarURL);

    return withThumbnailAndImageSeparate(embed, "daily", "daily_banner");    
}



// The /bet hub — shows available games and the player's balance
function betMenuEmbed(username, balance) {

    const embed = new EmbedBuilder()
        .setTitle("🎰 WhisperBot Gambling Hall")
        .setDescription("Place your bets and try your luck!")
        .setColor(COLORS.GOLD)
        .addFields(
            {
                name: "💰 Your Balance",
                value: colorText(`${balance.toLocaleString()} coins`, ANSI.CYAN),
                inline: false
            },
            {
                name: "🎯 High/Low (vs Bot)",
                value: "Guess whether your card beats the dealer's.\nUse `/highlow amount` to play.",
                inline: false
            },
            {
                name: "🏆 Daily Race (vs Player)",
                value: "Bet a friend on who finishes more daily missions.\nUse `/racebet @user amount` to challenge.",
                inline: false
            },
            {
                name: "🎲 Dice Roll",
                value: "Bet on the total of two dice — over, under, or exactly 7.\nUse `/dice amount guess` to play.",
                inline: false
            },
            {
                name: "🃏 Blackjack",
                value: "Classic blackjack against the dealer. Hit or Stand to reach 21.\nUse `/blackjack amount` to play.",
                inline: false
            }
        )
        .setFooter({
            text: `Gamble responsibly • ${username}, you must have coins to play`
        })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "bet", "bet_banner");

}


// Shown after the dealer card is drawn, before the player picks HIGH/LOW
function highlowDealEmbed(username, bet, dealerCard) {

    const embed = new EmbedBuilder()
        .setTitle("🎯 High/Low")
        .setColor(COLORS.HIGHLOW)
        .setDescription(`**${username}** bets ${bet.toLocaleString()} coins`)
        .addFields({
            name: "Dealer Card",
            value: `## ${dealerCard.label} ${dealerCard.suit}`,
            inline: false
        })
        .setFooter({ text: "Will your card be higher or lower?" });

    return withThumbnailAndImageSeparate(embed, "highlow", "highlow_banner");

}


// Final result of a High/Low round
function highlowResultEmbed(username, bet, dealerCard, playerCard, outcome, newBalance, npcLine = null) {

    const titles = {
        win: "✅ You Win!",
        lose: "❌ You Lose",
        push: "🤝 Push — Tie!"
    };

    const colors = {
        win: COLORS.SUCCESS,
        lose: COLORS.ERROR,
        push: COLORS.TIE
    };

    const embed = new EmbedBuilder()
        .setTitle(titles[outcome])
        .setColor(colors[outcome])
        .setDescription(`**${username}**`)
        .addFields(
            {
                name: "Dealer Card",
                value: `${dealerCard.label} ${dealerCard.suit}`,
                inline: true
            },
            {
                name: "Your Card",
                value: `${playerCard.label} ${playerCard.suit}`,
                inline: true
            }
        )
        .setFooter({ text: "🎯 WhisperBot High/Low" })
        .setTimestamp();

    if (outcome === "win") {
        embed.addFields({
            name: "💰 Result",
            value: `You bet ${bet.toLocaleString()} and won ${(bet * 2).toLocaleString()} coins (+${bet.toLocaleString()} profit)`,
            inline: false
        });
    } else if (outcome === "lose") {
        embed.addFields({
            name: "💸 Result",
            value: `You lost your ${bet.toLocaleString()} coin bet.`,
            inline: false
        });
    } else {
        embed.addFields({
            name: "🤝 Result",
            value: `Same value — your ${bet.toLocaleString()} coin bet was returned.`,
            inline: false
        });
    }

    embed.addFields({
        name: "💵 Balance",
        value: colorText(newBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnailAndImageSeparate(embed, "highlow", "highlow_banner");

}


// Sent to the challenged player when someone starts a /racebet
function raceChallengeEmbed(challengerName, betAmount) {

    const embed = new EmbedBuilder()
        .setTitle("🏆 Daily Race Challenge!")
        .setColor(COLORS.RACE)
        .setDescription(
            `**${challengerName}** has challenged you to a Daily Race for **${betAmount.toLocaleString()} coins**!\n\n` +
            "Whoever completes more daily missions before reset wins the pot.\n\n" +
            "Use `/raceaccept` to accept or `/racedecline` to decline.\nThis challenge expires in 5 minutes."
        )
        .setFooter({ text: "🏆 WhisperBot Daily Race" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "races", "races_banner");

}


// Confirms a race is on, shown to whoever ran the accept/decline/bet command
function raceStatusEmbed(title, description, color = COLORS.RACE) {

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(description)
        .setFooter({ text: "🏆 WhisperBot Daily Race" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "races", "races_banner");

}


// Result embed once a race resolves at daily reset
function raceResultEmbed(player1Name, player2Name, p1Completed, p2Completed, winnerId, player1Id, pot) {

    let title = "🤝 Daily Race — It's a Tie!";
    let description = "Neither player completed more missions. Coins returned.";
    let color = COLORS.TIE;

    if (winnerId) {
        const winnerName = winnerId === player1Id ? player1Name : player2Name;
        title = `🏆 ${winnerName} wins the Daily Race!`;
        description = `Pot of **${pot.toLocaleString()} coins** awarded.`;
        color = COLORS.SUCCESS;
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(description)
        .addFields(
            { name: player1Name, value: `${p1Completed} missions completed`, inline: true },
            { name: player2Name, value: `${p2Completed} missions completed`, inline: true }
        )
        .setFooter({ text: "🏆 WhisperBot Daily Race" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "races", "races_banner");

}


// List of pending/active races for /races
function racesListEmbed(races, resolveNames) {

    const embed = new EmbedBuilder()
        .setTitle("🏆 Active Daily Races")
        .setColor(COLORS.RACE)
        .setTimestamp();

    if (!races.length) {
        embed.setDescription("No pending or active races right now. Use `/racebet @user amount` to start one!");
        return withThumbnailAndImageSeparate(embed, "races", "races_banner");
    }

    embed.setDescription(
        races.map(race => {
            const p1 = resolveNames[race.player1_id] || race.player1_id;
            const p2 = resolveNames[race.player2_id] || race.player2_id;
            const statusLabel = race.status === "pending" ? "⏳ Pending" : "🏁 Active";
            return `${statusLabel} — **${p1}** vs **${p2}** for ${race.bet_amount.toLocaleString()} coins`;
        }).join("\n")
    );

    return withThumbnailAndImageSeparate(embed, "races", "races_banner");

}



// Full quest catalog for /quests
function questListEmbed(quests) {

    const embed = new EmbedBuilder()
        .setTitle("📜 WhisperBot Quests")
        .setDescription("Long-term goals you can work toward at your own pace. Use `/quest start` to begin one!")
        .setColor(COLORS.INFO)
        .setFooter({ text: "WhisperBot • Quests" })
        .setTimestamp();

    for (const quest of quests) {

        embed.addFields({
            name: `${quest.name}`,
            value:
                `*${quest.description}*\n` +
                `🎯 Goal: **${quest.goal.toLocaleString()}**  •  ` +
                `✨ **${quest.rewardXP.toLocaleString()} XP**  •  ` +
                `💰 **${quest.rewardCoins.toLocaleString()} Coins**  •  ` +
                `🏰 **${quest.rewardRep.toLocaleString()} Rep**`,
            inline: false
        });

    }

    return withThumbnailAndImageSeparate(embed, "quests", "quests_banner");

}


// Confirmation shown when a quest is started via /quest start
function questStartedEmbed(quest) {

    const embed = new EmbedBuilder()
        .setTitle("📜 Quest Started!")
        .setDescription(`**${quest.name}**\n*${quest.description}*`)
        .setColor(COLORS.SUCCESS)
        .addFields(
            {
                name: "🎯 Goal",
                value: colorText(quest.goal.toLocaleString(), ANSI.CYAN),
                inline: true
            },
            {
                name: "Rewards",
                value:
                    `✨ ${quest.rewardXP.toLocaleString()} XP\n` +
                    `💰 ${quest.rewardCoins.toLocaleString()} Coins\n` +
                    `🏰 ${quest.rewardRep.toLocaleString()} Rep`,
                inline: true
            }
        )
        .setFooter({ text: "WhisperBot • Quests" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "quest", "quest_banner");

}


// A user's in-progress quests, with progress bars, for /quest active
function activeQuestsEmbed(username, activeQuests, questData, avatarURL) {

    const embed = new EmbedBuilder()
        .setTitle(`📜 ${username}'s Active Quests`)
        .setColor(COLORS.INFO)
        .setFooter({ text: "WhisperBot • Quests" })
        .setTimestamp();

    if (avatarURL) embed.setThumbnail(avatarURL);

    if (!activeQuests.length) {
        embed.setDescription("No active quests right now. Use `/quest start` to begin one!");
        return withThumbnailAndImageSeparate(embed, "quest", "quest_banner");
    }

    for (const userQuest of activeQuests) {

        const info = questData[userQuest.quest_id];
        if (!info) continue;

        const percent = Math.min(userQuest.progress / info.goal, 1);
        const filled = Math.round(percent * 10);
        const bar = "█".repeat(filled) + "░".repeat(10 - filled);

        embed.addFields({
            name: `🎯 ${info.name}`,
            value:
                `*${info.description}*\n` +
                coloredBar(bar, percent).replace(
                    "\n```",
                    ` ${userQuest.progress}/${info.goal}\n\`\`\``
                ),
            inline: false
        });

    }

    return withThumbnailAndImageSeparate(embed, "quest", "quest_banner");

}




// /inventory

function inventoryEmbed(username, items, avatarURL) {
    const embed = new EmbedBuilder()
        .setTitle(`🎒 ${username}'s Inventory`)
        .setColor(COLORS.INFO)
        .setFooter({ text: "WhisperBot • WhisperSMP" })
        .setTimestamp();

    if (avatarURL) embed.setThumbnail(avatarURL);

    if (!items.length) {
        embed.setDescription("Your inventory is empty.");
        return withThumbnailAndImageSeparate(embed, "inventory", "inventory_banner");
    }

    // Format each item with its emoji inline
    const description = items.map(inventoryItem => {
        const fullItem = ShopManager.getItem(inventoryItem.item);
        const emoji = fullItem?.emoji || '📦';
        const name = fullItem?.name || inventoryItem.item;
        return `${emoji} **${name}** x${inventoryItem.amount}`;
    }).join("\n");

    embed.setDescription(description);

    // 🔥 USE THE BANNER IMAGE ONLY - no item image
    return withThumbnailAndImageSeparate(embed, "inventory", "inventory_banner");
}


// /help
function helpEmbed() {

    const embed = new EmbedBuilder()
        .setTitle("🤖 WhisperBot Commands")
        .setColor(COLORS.INFO)
        .addFields(
            {
                name: "📌 General",
                value:
                    "🏓 `/ping` — Check bot status\n" +
                    "❓ `/help` — Show this menu\n" +
                    "👤 `/profile` — View your profile\n" +
                    "📊 `/stats` — View your statistics\n" +
                    "🏆 `/leaderboard` — View server leaderboards",
                inline: false
            },
            {
                name: "🏰 Kingdoms",
                value:
                    "👑 `/kingdom` — Manage your kingdom\n" +
                    "🗺️ `/kingdoms` — View all kingdoms",
                inline: false
            },
            {
                name: "📜 Daily & Quests",
                value:
                    "📅 `/daily` — View your daily missions\n" +
                    "📜 `/quests` — View the quest catalog\n" +
                    "✅ `/quest start` — Start a quest\n" +
                    "🎯 `/quest active` — View active quests",
                inline: false
            },
            {
                name: "💰 Economy & Games",
                value:
                    "🎒 `/inventory` — View your inventory\n" +
                    "🎣 `/fish` — Go fishing\n" +
                    "🎰 `/bet` — Open the Gambling Hall\n" +
                    "🎯 `/highlow amount` — Bet against the dealer\n" +
                    "🏆 `/racebet @user amount` — Challenge a daily mission race\n" +
                    "🏁 `/raceaccept` / `/racedecline` — Respond to a race challenge\n" +
                    "📋 `/races` — View active races",
                inline: false
            }
        )
        .setFooter({ text: "WhisperBot • WhisperSMP" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "help", "help_banner");

}


// Result of a successful /here check-in
function dailyCheckinEmbed(username, result, avatarURL) {

    const {
        streak,
        totalCheckins,
        bonusApplied,
        multiplier,
        coins,
        xp,
        rep
    } = result;

    const embed = new EmbedBuilder()
        .setTitle("📍 Daily Check-In Complete!")
        .setColor(bonusApplied ? COLORS.WARNING : COLORS.SUCCESS)
        .setDescription(
            bonusApplied
                ? `🎉 **Streak Bonus!** Rewards multiplied **${multiplier}x** for hitting a ${streak}-day streak!`
                : `Come back tomorrow to keep your streak going.`
        )
        .addFields(
            {
                name: "🔥 Current Streak",
                value: `${streak} Day${streak === 1 ? "" : "s"}`,
                inline: true
            },
            {
                name: "📅 Total Check-Ins",
                value: `${totalCheckins}`,
                inline: true
            },
            {
                name: "🎁 Rewards",
                value:
                    `💰 +${coins.toLocaleString()} Coins\n` +
                    `⭐ +${xp.toLocaleString()} XP\n` +
                    `🏰 +${rep.toLocaleString()} Rep`,
                inline: false
            }
        )
        .setFooter({ text: "WhisperBot • Daily Check-In" })
        .setTimestamp();

    if (avatarURL)
        embed.setAuthor({ name: username, iconURL: avatarURL });

    return withThumbnailAndImageSeparate(embed, "here", "here_banner");

}


// Shown when a player tries /here before their cooldown has expired
function dailyCheckinCooldownEmbed(msUntilNext) {

    const totalMinutes = Math.ceil(msUntilNext / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const timeLeft = hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

    const embed = new EmbedBuilder()
        .setTitle("⏳ Already Checked In")
        .setDescription(`You've already checked in today. Come back in **${timeLeft}**!`)
        .setColor(COLORS.WARNING)
        .setFooter({ text: "WhisperBot • Daily Check-In" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "here", "here_banner");

}


// Result of a /dice roll
function diceResultEmbed(username, bet, guess, roll, won, multiplier, newBalance, npcLine = null) {

    const guessLabels = {
        over: "Over 7",
        under: "Under 7",
        exact: "Exactly 7"
    };

    const embed = new EmbedBuilder()
        .setTitle(won ? "✅ You Win! 🎉" : "❌ You Lose")
        .setColor(won ? COLORS.SUCCESS : COLORS.ERROR)
        .setDescription(`**${username}** bet ${bet.toLocaleString()} coins on **${guessLabels[guess]}**`)
        .addFields(
            {
                name: "🎲 Roll",
                value: `${roll.die1} + ${roll.die2} = **${roll.total}**`,
                inline: true
            }
        )
        .setFooter({ text: "🎲 WhisperBot Dice Roll" })
        .setTimestamp();

    if (won) {

        const payout = bet * multiplier;

        embed.addFields({
            name: "💰 Payout",
            value: `${payout.toLocaleString()} coins (+${(payout - bet).toLocaleString()} profit, ${multiplier}x)`,
            inline: false
        });

    } else {

        embed.addFields({
            name: "💸 Result",
            value: `You lost your ${bet.toLocaleString()} coin bet.`,
            inline: false
        });

    }

    embed.addFields({
        name: "💵 Balance",
        value: colorText(newBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnailAndImageSeparate(embed, "dice", "dice_banner");

}


// Shown mid-hand while the player is deciding Hit/Stand — dealer's second
// card stays hidden.
function blackjackHandEmbed(username, bet, playerHand, dealerHand, playerTotal) {

    const embed = new EmbedBuilder()
        .setTitle("🃏 Blackjack")
        .setColor(COLORS.INFO)
        .setDescription(`**${username}** bets ${bet.toLocaleString()} coins`)
        .addFields(
            {
                name: "Your Hand",
                value: `${playerHand.map(formatCardLike).join("  ")}  (**${playerTotal}**)`,
                inline: false
            },
            {
                name: "Dealer Hand",
                value: `${formatCardLike(dealerHand[0])}  🃏 Hidden`,
                inline: false
            }
        )
        .setFooter({ text: "Hit to draw another card, or Stand to hold" });

    return withThumbnailAndImageSeparate(embed, "blackjack", "blackjack_banner");

}


// Local formatter matching cardService.formatCard's "🃏 9 ♥️" shape, kept
// here so embedFactory doesn't need to depend on cardService directly.
function formatCardLike(card) {
    return `🃏 ${card.label} ${card.suit}`;
}


// Final result of a blackjack round
function blackjackResultEmbed(username, bet, playerHand, dealerHand, playerTotal, dealerTotal, outcome, newBalance, npcLine = null) {

    const titles = {
        player_blackjack: "🃏 Blackjack! You Win!",
        win: "✅ You Win!",
        lose: "❌ You Lose",
        push: "🤝 Push — Tie!"
    };

    const colors = {
        player_blackjack: COLORS.SUCCESS,
        win: COLORS.SUCCESS,
        lose: COLORS.ERROR,
        push: COLORS.TIE
    };

    const embed = new EmbedBuilder()
        .setTitle(titles[outcome])
        .setColor(colors[outcome])
        .setDescription(`**${username}**`)
        .addFields(
            {
                name: "Your Hand",
                value: `${playerHand.map(formatCardLike).join("  ")}  (**${playerTotal}**)`,
                inline: false
            },
            {
                name: "Dealer Hand",
                value: `${dealerHand.map(formatCardLike).join("  ")}  (**${dealerTotal}**)`,
                inline: false
            }
        )
        .setFooter({ text: "🃏 WhisperBot Blackjack" })
        .setTimestamp();

    if (outcome === "player_blackjack") {

        const payout = Math.round(bet * 2.5);

        embed.addFields({
            name: "💰 Payout",
            value: `${payout.toLocaleString()} coins (+${(payout - bet).toLocaleString()} profit, 3:2)`,
            inline: false
        });

    } else if (outcome === "win") {

        const payout = bet * 2;

        embed.addFields({
            name: "💰 Payout",
            value: `${payout.toLocaleString()} coins (+${(payout - bet).toLocaleString()} profit)`,
            inline: false
        });

    } else if (outcome === "lose") {

        embed.addFields({
            name: "💸 Result",
            value: `You lost your ${bet.toLocaleString()} coin bet.`,
            inline: false
        });

    } else {

        embed.addFields({
            name: "🤝 Result",
            value: `Push — your ${bet.toLocaleString()} coin bet was returned.`,
            inline: false
        });

    }

    embed.addFields({
        name: "💵 Balance",
        value: colorText(newBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnailAndImageSeparate(embed, "blackjack", "blackjack_banner");

}


// /casino stats — a single player's casino performance
function casinoStatsEmbed(username, stats, avatarURL) {

    const net = stats.total_won - stats.total_lost;

    const embed = new EmbedBuilder()
        .setTitle(`🎰 ${username}'s Casino Stats`)
        .setColor(net >= 0 ? COLORS.SUCCESS : COLORS.ERROR)
        .addFields(
            {
                name: "💰 Total Bets",
                value: `${stats.total_bets.toLocaleString()}`,
                inline: true
            },
            {
                name: "📊 Total Wagered",
                value: `${stats.total_wagered.toLocaleString()} Coins`,
                inline: true
            },
            {
                name: net >= 0 ? "📈 Net Profit" : "📉 Net Loss",
                value: colorText(
                    `${net >= 0 ? "+" : ""}${net.toLocaleString()} Coins`,
                    net >= 0 ? ANSI.GREEN : ANSI.RED
                ),
                inline: true
            },
            {
                name: "🏆 Total Won",
                value: `${stats.total_won.toLocaleString()} Coins`,
                inline: true
            },
            {
                name: "💀 Total Lost",
                value: `${stats.total_lost.toLocaleString()} Coins`,
                inline: true
            },
            {
                name: "🌟 Biggest Win",
                value: `${stats.biggest_win.toLocaleString()} Coins`,
                inline: true
            },
            {
                name: "🎲 Dice Roll",
                value: `${stats.dice_games.toLocaleString()} games (${stats.dice_wins.toLocaleString()} wins)`,
                inline: false
            },
            {
                name: "🃏 Blackjack",
                value: `${stats.blackjack_games.toLocaleString()} games (${stats.blackjack_wins.toLocaleString()} wins)`,
                inline: false
            }
        )
        .setFooter({ text: "WhisperBot • Casino" })
        .setTimestamp();

    if (avatarURL)
        embed.setAuthor({ name: username, iconURL: avatarURL });

    return withThumbnailAndImageSeparate(embed, "casino", "casino_banner");

}


// /casino leaderboard — top players by net profit
function casinoLeaderboardEmbed(rows) {

    const medals = ["🥇", "🥈", "🥉"];

    let description = "";

    if (rows.length === 0) {

        description = "No one has placed a casino bet yet — be the first!";

    } else {

        rows.forEach((row, index) => {

            const place = medals[index] || `#${index + 1}`;
            const name = row.username || "Unknown";
            const net = row.net;

            description +=
                `${place} **${name}** — ${net >= 0 ? "+" : ""}${net.toLocaleString()} Coins ` +
                `(${row.total_bets.toLocaleString()} bets)\n`;

        });

    }

    const embed = new EmbedBuilder()
        .setTitle("🏆 Casino Leaderboard")
        .setDescription(description)
        .setColor(COLORS.GOLD)
        .setFooter({ text: "Ranked by net profit • WhisperBot Casino" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "casino", "casino_banner");

}


// Scan phase — brief animated progress bar before the estimate is shown
function robberyScanEmbed(victimUsername, percent) {

    const embed = new EmbedBuilder()
        .setTitle("🔎 Scanning Target...")
        .setColor(COLORS.INFO)
        .setDescription(`Casing **${victimUsername}**...\n\n${progressBar(percent)}`)
        .setFooter({ text: "WhisperBot • Robbery" });

    return withThumbnailAndImageSeparate(embed, "rob", "rob_banner");

}


// Estimate + Proceed/Cancel decision phase
function robberyEstimateEmbed(victimUsername, successChance, lootRange, bet) {

    const percent = Math.round(successChance * 100);

    const embed = new EmbedBuilder()
        .setTitle("🕵️ Target Analysis Complete")
        .setColor(percent >= 60 ? COLORS.SUCCESS : percent >= 40 ? COLORS.WARNING : COLORS.ERROR)
        .setDescription(`Ready to make a move on **${victimUsername}**? You're risking **${bet.toLocaleString()}** coins.`)
        .addFields(
            {
                name: "Estimated Success Chance",
                value: `${riskEmoji(percent)} ${percent}%`,
                inline: true
            },
            {
                name: "Estimated Loot Range",
                value: `${lootRange.min.toLocaleString()} - ${lootRange.max.toLocaleString()} coins`,
                inline: true
            },
            {
                name: "Estimated Risk",
                value: riskLabel(successChance),
                inline: true
            }
        )
        .setFooter({ text: "These are estimates only — the real outcome is calculated when you commit." });

    return withThumbnailAndImageSeparate(embed, "rob", "rob_banner");

}


function riskEmoji(percent) {
    if (percent >= 60) return "🟢";
    if (percent >= 40) return "🟡";
    return "🔴";
}


// Execution suspense phase, shown after the robber hits Proceed
function robberyExecutionEmbed(victimUsername) {

    const embed = new EmbedBuilder()
        .setTitle("🥷 Moving In...")
        .setColor(COLORS.INFO)
        .setDescription(`You quietly begin following **${victimUsername}**...\n\nLooking for an opportunity...`)
        .setFooter({ text: "WhisperBot • Robbery" });

    return withThumbnailAndImageSeparate(embed, "rob", "rob_banner");

}


// Sent to the victim in DMs
function robberyVictimDMEmbed(robberUsername) {

    const embed = new EmbedBuilder()
        .setTitle("🚨 Someone Is Trying to Rob You!")
        .setColor(COLORS.ERROR)
        .setDescription(`Someone nearby is attempting to rob you. React quickly — you have **10 seconds**!`)
        .addFields({
            name: "Your Options",
            value:
                "👀 **Look Around** — try to spot them (lowers their odds a bit)\n" +
                "🏃 **Run** — attempt to escape immediately\n" +
                "🛡 **Defend** — fight back (biggest odds reduction, but riskier if it fails)\n" +
                "🙈 **Ignore** — do nothing",
            inline: false
        })
        .setFooter({ text: `From: ${robberUsername}'s server` });

    return withThumbnailAndImageSeparate(embed, "rob", "rob_banner");

}


// Shown in the origin channel pointing the victim to their DMs
function robberyChannelPingEmbed(victimUsername) {

    const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setDescription(`🚨 **${victimUsername}**, check your DMs — something's happening!`);

    return withThumbnailAndImageSeparate(embed, "rob", "rob_banner");

}


// Shown if the victim doesn't respond in time
function robberyTimeoutNote() {
    return "🙈 They didn't notice anything... the robbery continues unnoticed.";
}


// Brief suspense beat shown in the origin channel between the victim's
// response coming in and the outcome being revealed — keeps the reveal
// from feeling like an instant cut from "DM sent" to "here's the result."
function robberyRollingEmbed(victimUsername) {

    const embed = new EmbedBuilder()
        .setTitle("🎲 Rolling the Outcome...")
        .setColor(COLORS.INFO)
        .setDescription(`The dust settles between you and **${victimUsername}**...`)
        .setFooter({ text: "WhisperBot • Robbery" });

    return withThumbnailAndImageSeparate(embed, "rob", "rob_banner");

}


// Final result, sent as a DM follow-up to the victim once the robbery
// resolves — mirrors robberyResultEmbed's content but written from the
// victim's point of view (their own balance, not the robber's) since it's
// their DM. Without this, the only thing a victim ever saw in their DMs
// was "Response received" with no idea how the robbery actually went.
function robberyVictimResultDMEmbed(robberUsername, victimUsername, outcomeMeta, result, newVictimBalance) {

    const { outcome, loot, successChance } = result;

    const colorMap = {
        perfect: COLORS.ERROR,
        success: COLORS.ERROR,
        hidden_cash: COLORS.ERROR,
        wallet_empty: COLORS.ERROR,
        escaped: COLORS.WARNING,
        defended: COLORS.SUCCESS,
        arrested: COLORS.SUCCESS
    };

    const embed = new EmbedBuilder()
        .setTitle(outcomeMeta.victimTitle || outcomeMeta.title)
        .setColor(colorMap[outcome] || COLORS.INFO)
        .setDescription(`**${robberUsername}** targeted you.\n\n${outcomeMeta.victimDescription || outcomeMeta.description}`)
        .addFields({
            name: "🎲 Their Success Chance",
            value: `${Math.round(successChance * 100)}%`,
            inline: true
        })
        .setFooter({ text: "WhisperBot • Robbery" })
        .setTimestamp();

    if (["perfect", "success", "hidden_cash", "wallet_empty"].includes(outcome)) {

        embed.addFields({
            name: "💸 Stolen From You",
            value: `-${loot.toLocaleString()} coins`,
            inline: true
        });

    } else if (outcome === "defended") {

        embed.addFields({
            name: "💰 Recovered From Them",
            value: `+${Math.abs(loot).toLocaleString()} coins`,
            inline: true
        });

    }

    embed.addFields({
        name: "💵 Your Balance",
        value: colorText(newVictimBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    return withThumbnailAndImageSeparate(embed, "rob", "rob_banner");

}



function robberyResultEmbed(robberUsername, victimUsername, outcomeMeta, result, newRobberBalance) {

    const { outcome, loot, fine, successChance } = result;

    const colorMap = {
        perfect: COLORS.SUCCESS,
        success: COLORS.SUCCESS,
        hidden_cash: COLORS.SUCCESS,
        wallet_empty: COLORS.SUCCESS,
        escaped: COLORS.WARNING,
        defended: COLORS.ERROR,
        arrested: COLORS.ERROR
    };

    const embed = new EmbedBuilder()
        .setTitle(outcomeMeta.title)
        .setColor(colorMap[outcome] || COLORS.INFO)
        .setDescription(`**${robberUsername}** targeted **${victimUsername}**\n\n${outcomeMeta.description}`)
        .addFields({
            name: "🎲 Success Chance",
            value: `${Math.round(successChance * 100)}%`,
            inline: true
        })
        .setFooter({ text: "WhisperBot • Robbery" })
        .setTimestamp();

    if (["perfect", "success", "hidden_cash", "wallet_empty"].includes(outcome)) {

        embed.addFields({
            name: "💰 Loot Stolen",
            value: `+${loot.toLocaleString()} coins`,
            inline: true
        });

    } else if (outcome === "defended") {

        embed.addFields({
            name: "💸 Lost to Victim",
            value: `${Math.abs(loot).toLocaleString()} coins`,
            inline: true
        });

    } else if (outcome === "arrested") {

        embed.addFields({
            name: "🚔 Fine Paid",
            value: `${fine.toLocaleString()} coins`,
            inline: true
        });

    }

    embed.addFields({
        name: "💵 Your Balance",
        value: colorText(newRobberBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    return withThumbnailAndImageSeparate(embed, "rob", "rob_banner");

}


// ---------------------------------------------------------------------
// Whispers Casino expansion — hub, horse racing, slots, roulette,
// poker, passport, VIP, and server announcements.
// ---------------------------------------------------------------------

// The casino hub (/casino menu). Shows balance, the progressive jackpot,
// and today's lucky number, with buttons handled in interactionCreate.js.
function casinoMenuEmbed(username, balance, jackpot, luckyNumber) {

    const embed = new EmbedBuilder()
        .setTitle("🎰 Whispers Casino")
        .setColor(COLORS.GOLD)
        .setDescription(`Welcome, **${username}**. Pick a table below, or check your stats.`)
        .addFields(
            {
                name: "💵 Your Balance",
                value: colorText(balance.toLocaleString(), ANSI.CYAN),
                inline: true
            },
            {
                name: "🎉 Progressive Jackpot",
                value: colorText(`${jackpot.toLocaleString()} coins`, ANSI.YELLOW),
                inline: true
            },
            {
                name: "🎯 Today's Lucky Number",
                value: colorText(String(luckyNumber), ANSI.GREEN),
                inline: true
            },
            {
                name: "🃏 Card Tables",
                value: "`/blackjack` • `/highlow` • `/poker`",
                inline: false
            },
            {
                name: "🎲 Games of Chance",
                value: "`/dice` • `/slots` • `/roulette` • `/horse`",
                inline: false
            }
        )
        .setFooter({ text: "🔥 1% of every bet feeds the jackpot. Match the lucky number in any game for a bonus!" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "casino", "casino_banner");

}


// /horse — shows the drawn race field with odds, before betting closes.
function horseFieldEmbed(field) {

    const lines = field
        .map(h => `🏇 **${h.name}** — ${h.odds}x`)
        .join("\n");

    const embed = new EmbedBuilder()
        .setTitle("🐎 WHISPERS DERBY")
        .setColor(COLORS.INFO)
        .setDescription(`━━━━━━━━━━━━━━━━━━━━━━━━\n\n${lines}\n\n━━━━━━━━━━━━━━━━━━━━━━━━`)
        .setFooter({ text: "Pick your horse below before the gate opens." });

    return withThumbnail(embed, "horse");

}


// /horse result — race field plus the winner and payout.
function horseResultEmbed(username, bet, field, winner, chosenHorse, won, payout, newBalance, npcLine = null) {

    const bars = field.map(h => {
        const isWinner = h.id === winner.id;
        const pct = isWinner ? 100 : Math.floor(Math.random() * 60) + 20;
        const filled = Math.round(pct / 10);
        const bar = "█".repeat(filled) + "░".repeat(10 - filled);
        return `🐎 ${h.name}\n${bar} ${pct}%${isWinner ? "  🏆" : ""}`;
    }).join("\n\n");

    const embed = new EmbedBuilder()
        .setTitle(won ? "🏆 Your Horse Wins!" : "🏁 Race Over")
        .setColor(won ? COLORS.SUCCESS : COLORS.ERROR)
        .setDescription(`**${username}** bet ${bet.toLocaleString()} coins on **${chosenHorse.name}**\n\n${bars}`)
        .addFields({
            name: "🏆 Winner",
            value: `**${winner.name}** (${winner.odds}x)`,
            inline: false
        })
        .setFooter({ text: "🐎 Whispers Derby" })
        .setTimestamp();

    if (won) {
        embed.addFields({
            name: "💰 Payout",
            value: `${payout.toLocaleString()} coins (+${(payout - bet).toLocaleString()} profit, ${chosenHorse.odds}x)`,
            inline: false
        });
    } else {
        embed.addFields({
            name: "💸 Result",
            value: `You lost your ${bet.toLocaleString()} coin bet.`,
            inline: false
        });
    }

    embed.addFields({
        name: "💵 Balance",
        value: colorText(newBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "horse");

}


// /slots result
function slotsResultEmbed(username, variantLabel, cost, reels, result, newBalance, npcLine = null) {

    const embed = new EmbedBuilder()
        .setTitle(result.won ? "✅ You Win!" : "❌ No Match")
        .setColor(result.won ? COLORS.SUCCESS : COLORS.ERROR)
        .setDescription(`**${username}** spun ${variantLabel}\n\n[ ${reels.join(" ] [ ")} ]`)
        .setFooter({ text: variantLabel })
        .setTimestamp();

    if (result.won) {

        const payout = cost * result.multiplier;

        embed.addFields({
            name: "💰 Payout",
            value: `${payout.toLocaleString()} coins (+${(payout - cost).toLocaleString()} profit, ${result.multiplier}x)` +
                (result.kingdomBonus ? "\n👑 Kingdom match bonus applied!" : ""),
            inline: false
        });

    } else {

        embed.addFields({
            name: "💸 Result",
            value: `No match — you lost your ${cost.toLocaleString()} coin spin.`,
            inline: false
        });

    }

    embed.addFields({
        name: "💵 Balance",
        value: colorText(newBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "slots");

}


// /roulette result
function rouletteResultEmbed(username, bet, betType, betValue, number, color, result, newBalance, npcLine = null) {

    const colorEmoji = { red: "🔴", black: "⚫", green: "🟢" }[color];

    const betLabels = {
        color: betValue === "red" ? "🔴 Red" : "⚫ Black",
        parity: betValue === "even" ? "Even" : "Odd",
        dozen: betValue,
        number: `Number ${betValue}`
    };

    const embed = new EmbedBuilder()
        .setTitle(result.won ? "✅ You Win!" : "❌ You Lose")
        .setColor(result.won ? COLORS.SUCCESS : COLORS.ERROR)
        .setDescription(`**${username}** bet ${bet.toLocaleString()} coins on **${betLabels[betType]}**`)
        .addFields({
            name: "🔄 Result",
            value: `${colorEmoji} **${number}**`,
            inline: false
        })
        .setFooter({ text: "🔴 Whispers Roulette" })
        .setTimestamp();

    if (result.won) {

        const payout = bet * result.multiplier;

        embed.addFields({
            name: "💰 Payout",
            value: `${payout.toLocaleString()} coins (+${(payout - bet).toLocaleString()} profit, ${result.multiplier}x)`,
            inline: false
        });

    } else {

        embed.addFields({
            name: "💸 Result",
            value: `You lost your ${bet.toLocaleString()} coin bet.`,
            inline: false
        });

    }

    embed.addFields({
        name: "💵 Balance",
        value: colorText(newBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "roulette");

}


// /poker — cards dealt, awaiting Play/Fold
// Progressive 3-Card Poker (commands/casino/poker.js) — one embed
// function covers every stage (ante/first/second/third card reveals and
// showdown); the command decides what to pass in for each. playerLine
// and dealerLine are pre-formatted card display strings so this function
// doesn't need to know about hidden-card logic itself.
// ---------------------------------------------------------------------
// Gambling Tic Tac Toe (/tic) — house mode + PvP challenges.
// ---------------------------------------------------------------------

function formatTicBoard(board) {

    const cellDisplay = (v) => v === "X" ? "❌" : v === "O" ? "⭕" : "➖";
    const rows = [];

    for (let r = 0; r < 3; r++) {
        rows.push(board.slice(r * 3, r * 3 + 3).map(cellDisplay).join(" | "));
    }

    return rows.join("\n---------\n");

}


// House mode — one embed covers the setup hub, active play, and result,
// same shape as every other game's session embed.
function ticHouseEmbed({
    stage, // "hub" | "bet" | "playing" | "result"
    roundNumber,
    bet,
    balance,
    gamesLeft,
    maxGames,
    board,
    resultLine = null,
    npcLine = null,
    color = COLORS.INFO,
    cooldown = null
}) {

    const embed = new EmbedBuilder()
        .setTitle("❌⭕ TIC TAC TOE — Dealer Frank")
        .setColor(color)
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    if (stage === "hub") {

        embed.setDescription("━━━━━━━━━━━━━━━━━━━━━━━━\n\nChoose your opponent:\n\n🏦 Play The House\n👤 Challenge a Player (`/tic opponent:@user amount:<bet>`)");
        return withThumbnail(embed, "casino");

    }

    if (stage === "bet") {

        embed.setDescription("━━━━━━━━━━━━━━━━━━━━━━━━\n\nChoose your bet, then Start Playing.");
        return withThumbnail(embed, "casino");

    }

    embed.setDescription(
        `Round #${roundNumber}\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${formatTicBoard(board)}` +
        (stage === "playing" ? "\n\nYour turn (❌)" : "")
    );

    embed.addFields(
        { name: "🎯 Bet", value: `${bet.toLocaleString()} coins`, inline: true },
        { name: "💵 Balance", value: colorText(balance.toLocaleString(), ANSI.CYAN), inline: true }
    );

    if (resultLine) {
        embed.addFields({ name: "Result", value: resultLine, inline: false });
    }

    if (cooldown) {
        embed.addFields({ name: `⏳ Cooldown (${cooldown.label})`, value: `Refreshes <t:${cooldown.untilUnix}:R>`, inline: false });
    } else {
        embed.addFields({ name: "🎮 Games Left", value: `${gamesLeft} / ${maxGames}`, inline: false });
    }

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "casino");

}


// PvP — challenge invite, shown to the opponent with Accept/Decline.
function ticChallengeEmbed(challengerName, betAmount) {

    const embed = new EmbedBuilder()
        .setTitle("❌⭕ TIC CHALLENGE")
        .setColor(COLORS.WARNING)
        .setDescription(
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**${challengerName}** has challenged you!\n\n` +
            `Bet: ${betAmount.toLocaleString()} coins\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setFooter({ text: "🎰 Whispers Casino" });

    return withThumbnail(embed, "casino");

}


// PvP — the live shared board, edited in place as both players move.
// ---------------------------------------------------------------------
// Memory Vault (/memory)
// ---------------------------------------------------------------------

function formatMemoryGrid(grid, revealed, size) {

    const rows = [];

    for (let r = 0; r < size; r++) {

        const cells = [];

        for (let c = 0; c < size; c++) {

            const i = r * size + c;
            const symbol = grid[i];

            if (revealed[i]) {
                cells.push(symbol === "BONUS" ? "🎁" : symbol);
            } else {
                cells.push("❓");
            }

        }

        rows.push(cells.join(" "));

    }

    return rows.join("\n");

}


function memoryHubEmbed(difficultyLabels) {

    const embed = new EmbedBuilder()
        .setTitle("🧠 MEMORY VAULT — Dealer Lucy")
        .setColor(COLORS.INFO)
        .setDescription(
            "━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
            "Choose difficulty:\n\n" +
            difficultyLabels.join("\n") +
            "\n\n━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        .setFooter({ text: "🎰 Whispers Casino" });

    return withThumbnail(embed, "casino");

}


function memoryGameEmbed({
    difficultyLabel,
    size,
    bet,
    balance,
    attemptsUsed,
    maxAttempts,
    matchedPairs,
    totalPairs,
    grid,
    revealed,
    resultLine = null,
    npcLine = null,
    color = COLORS.INFO,
    cooldown = null
}) {

    const embed = new EmbedBuilder()
        .setTitle("🧠 MEMORY VAULT — Dealer Lucy")
        .setColor(color)
        .setDescription(
            `Difficulty: ${difficultyLabel}\n` +
            `Bet: ${bet.toLocaleString()} coins\n` +
            `Attempts: ${attemptsUsed}/${maxAttempts}\n` +
            `Pairs Found: ${matchedPairs}/${totalPairs}\n\n` +
            `${formatMemoryGrid(grid, revealed, size)}`
        )
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    embed.addFields({
        name: "💵 Balance",
        value: colorText(balance.toLocaleString(), ANSI.CYAN),
        inline: true
    });

    if (resultLine) {
        embed.addFields({ name: "Result", value: resultLine, inline: false });
    }

    if (cooldown) {
        embed.addFields({ name: `⏳ Cooldown (${cooldown.label})`, value: `Refreshes <t:${cooldown.untilUnix}:R>`, inline: false });
    }

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "casino");

}


function ticMatchEmbed({ player1Name, player2Name, board, turnName, betAmount, resultLine = null, color = COLORS.INFO }) {

    const embed = new EmbedBuilder()
        .setTitle("❌⭕ TIC TAC TOE")
        .setColor(color)
        .setDescription(
            `**${player1Name}** (❌) vs **${player2Name}** (⭕)\n` +
            `Bet: ${betAmount.toLocaleString()} coins each\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n${formatTicBoard(board)}\n\n` +
            (resultLine ? resultLine : `Turn: **${turnName}**`)
        )
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    return withThumbnail(embed, "casino");

}


function pokerProgressiveEmbed({
    handNumber,
    ante,
    currentBet,
    balance,
    handsLeft,
    maxHands,
    stageLabel,
    playerLine,
    dealerLine,
    npcLine = null,
    resultLine = null,
    color = COLORS.INFO,
    cooldown = null
}) {

    const embed = new EmbedBuilder()
        .setTitle(`♠️ PROGRESSIVE 3-CARD POKER — Dealer Frank`)
        .setColor(color)
        .setDescription(
            `${stageLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Your Cards:\n${playerLine}\n\n` +
            `Dealer:\n${dealerLine}`
        )
        .setFooter({ text: "♠️ Whispers Casino" })
        .setTimestamp();

    embed.addFields(
        {
            name: "Hand",
            value: `#${handNumber}`,
            inline: true
        },
        {
            name: "Ante | Current Bet",
            value: `${ante.toLocaleString()} | ${currentBet.toLocaleString()} coins`,
            inline: true
        },
        {
            name: "💵 Balance",
            value: colorText(balance.toLocaleString(), ANSI.CYAN),
            inline: true
        }
    );

    if (resultLine) {

        embed.addFields({
            name: "📊 Result",
            value: resultLine,
            inline: false
        });

    }

    if (cooldown) {

        embed.addFields({
            name: `⏳ Cooldown (${cooldown.label})`,
            value: `Refreshes <t:${cooldown.untilUnix}:R>`,
            inline: false
        });

    } else {

        embed.addFields({
            name: "🃏 Hands Left",
            value: `${handsLeft} / ${maxHands}`,
            inline: false
        });

    }

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "poker");

}


function pokerHandEmbed(username, ante, hand) {

    const embed = new EmbedBuilder()
        .setTitle("♠️ Three Card Poker ♠️")
        .setColor(COLORS.INFO)
        .setDescription(
            `**${username}** antes ${ante.toLocaleString()} coins\n\n` +
            `Your Cards:\n${hand.map(formatCardLike).join("  ")}`
        )
        .setFooter({ text: "Play to reveal your hand, or Fold to get half your ante back." });

    return withThumbnail(embed, "poker");

}


// /poker result
function pokerResultEmbed(username, ante, hand, evaluation, folded, netChange, newBalance, npcLine = null) {

    const won = netChange > 0;

    const embed = new EmbedBuilder()
        .setTitle(folded ? "🚪 Folded" : (won ? "✅ You Win!" : (netChange === 0 ? "🤝 Push" : "❌ You Lose")))
        .setColor(folded ? COLORS.WARNING : (won ? COLORS.SUCCESS : (netChange === 0 ? COLORS.TIE : COLORS.ERROR)))
        .setDescription(`**${username}**\n\nYour Cards:\n${hand.map(formatCardLike).join("  ")}`)
        .setFooter({ text: "♠️ Whispers Three Card Poker" })
        .setTimestamp();

    if (folded) {

        embed.addFields({
            name: "🚪 Result",
            value: `You folded — half your ${ante.toLocaleString()} coin ante was returned.`,
            inline: false
        });

    } else {

        embed.addFields({
            name: "🃏 Hand",
            value: evaluation.label,
            inline: true
        });

        if (netChange > 0) {

            embed.addFields({
                name: "💰 Payout",
                value: `${(ante * evaluation.multiplier).toLocaleString()} coins (+${netChange.toLocaleString()} profit, ${evaluation.multiplier}x)`,
                inline: false
            });

        } else if (netChange === 0) {

            embed.addFields({
                name: "🤝 Result",
                value: `Push — your ${ante.toLocaleString()} coin ante was returned.`,
                inline: false
            });

        } else {

            embed.addFields({
                name: "💸 Result",
                value: `You lost your ${ante.toLocaleString()} coin ante.`,
                inline: false
            });

        }

    }

    embed.addFields({
        name: "💵 Balance",
        value: colorText(newBalance.toLocaleString(), ANSI.CYAN),
        inline: false
    });

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "poker");

}


// /casino vip
function casinoVipEmbed(username, totalWagered, vipRank, nextRank, avatarURL) {

    const embed = new EmbedBuilder()
        .setTitle(`👑 ${username}'s VIP Status`)
        .setColor(COLORS.GOLD)
        .addFields({
            name: "📊 Total Wagered",
            value: `${totalWagered.toLocaleString()} Coins`,
            inline: false
        })
        .setFooter({ text: "WhisperBot • Casino VIP" })
        .setTimestamp();

    if (vipRank) {

        embed.addFields({
            name: "🏆 Current Rank",
            value: vipRank.label + (vipRank.dailyBonus > 0 ? `\n+${Math.round(vipRank.dailyBonus * 100)}% daily bonus` : ""),
            inline: false
        });

    } else {

        embed.addFields({
            name: "🏆 Current Rank",
            value: "Unranked — place casino bets to start climbing!",
            inline: false
        });

    }

    if (nextRank) {

        embed.addFields({
            name: "📈 Next Rank",
            value: `${nextRank.label} — wager ${nextRank.remaining.toLocaleString()} more coins to unlock`,
            inline: false
        });

    } else {

        embed.addFields({
            name: "📈 Next Rank",
            value: "You've reached the top VIP rank. 👑",
            inline: false
        });

    }

    if (avatarURL)
        embed.setAuthor({ name: username, iconURL: avatarURL });

    return withThumbnailAndImageSeparate(embed, "casino", "casino_banner");

}


// /casino passport
function casinoPassportEmbed(username, stats, rank, ownedHorses, casinoAchievementCount, favoriteGame, avatarURL) {

    const net = stats.total_won - stats.total_lost;

    const totalGames =
        (stats.blackjack_games || 0) + (stats.dice_games || 0) + (stats.highlow_games || 0) +
        (stats.horse_games || 0) + (stats.slots_games || 0) + (stats.roulette_games || 0) + (stats.poker_games || 0);

    const gameLines = [
        `🃏 Blackjack: ${stats.blackjack_games.toLocaleString()} games (${stats.blackjack_wins.toLocaleString()} wins)`,
        `🎲 Dice: ${stats.dice_games.toLocaleString()} games (${stats.dice_wins.toLocaleString()} wins)`,
        `🎯 High/Low: ${(stats.highlow_games || 0).toLocaleString()} games (${(stats.highlow_wins || 0).toLocaleString()} wins)`,
        `🐎 Horse Racing: ${(stats.horse_games || 0).toLocaleString()} games (${(stats.horse_wins || 0).toLocaleString()} wins)`,
        `🎰 Slots: ${(stats.slots_games || 0).toLocaleString()} games (${(stats.slots_wins || 0).toLocaleString()} wins)`,
        `🔴 Roulette: ${(stats.roulette_games || 0).toLocaleString()} games (${(stats.roulette_wins || 0).toLocaleString()} wins)`,
        `♠️ Poker: ${(stats.poker_games || 0).toLocaleString()} games (${(stats.poker_wins || 0).toLocaleString()} wins)`
    ].join("\n");

    const horseLines = ownedHorses.length
        ? ownedHorses.map(h => {
            const winRate = h.races > 0 ? Math.round((h.wins / h.races) * 100) : 0;
            return `${h.horse_id} (Win Rate: ${winRate}%)`;
        }).join("\n")
        : "None yet — visit `/horse` to buy one.";

    const embed = new EmbedBuilder()
        .setTitle(`🎰 ${username}'s Whispers Casino Passport`)
        .setColor(net >= 0 ? COLORS.SUCCESS : COLORS.ERROR)
        .addFields(
            {
                name: "🏆 Casino Rank",
                value: rank ? rank.label : "🎲 Visitor",
                inline: true
            },
            {
                name: "🎮 Total Games",
                value: `${totalGames.toLocaleString()}`,
                inline: true
            },
            {
                name: "⭐ Favorite Game",
                value: favoriteGame || "—",
                inline: true
            },
            {
                name: net >= 0 ? "📈 Net Profit" : "📉 Net Loss",
                value: colorText(`${net >= 0 ? "+" : ""}${net.toLocaleString()} Coins`, net >= 0 ? ANSI.GREEN : ANSI.RED),
                inline: true
            },
            {
                name: "🎉 Jackpots Won",
                value: `${(stats.jackpots_won || 0).toLocaleString()}`,
                inline: true
            },
            {
                name: "🏆 Casino Achievements",
                value: `${casinoAchievementCount} unlocked`,
                inline: true
            },
            {
                name: "📊 Statistics",
                value: gameLines,
                inline: false
            },
            {
                name: "🔥 Daily Bonus Streak",
                value: `${(stats.daily_bonus_streak || 0).toLocaleString()} days`,
                inline: true
            },
            {
                name: "🐎 Horses Owned",
                value: horseLines,
                inline: false
            }
        )
        .setFooter({ text: "WhisperBot • Whispers Casino Passport" })
        .setTimestamp();

    if (avatarURL)
        embed.setAuthor({ name: username, iconURL: avatarURL });

    return withThumbnailAndImageSeparate(embed, "casino", "casino_banner");

}


// Server-wide big-win announcement (services/casinoAnnouncerService.js)
function casinoAnnouncementEmbed({ game, username, netWin, jackpot }) {

    const gameLabels = {
        dice: "Dice", blackjack: "Blackjack", highlow: "High/Low",
        horse: "Horse Racing", slots: "Slots", roulette: "Roulette", poker: "Three Card Poker"
    };

    const embed = new EmbedBuilder()
        .setTitle(jackpot ? "🎉 JACKPOT WON! 🎉" : "📢 CASINO NEWS")
        .setColor(COLORS.GOLD)
        .setDescription(
            `**${username}** just won\n` +
            `**${netWin.toLocaleString()} coins**\n` +
            `on ${gameLabels[game] || game}!\n\n` +
            `Can YOU beat it?`
        )
        .setFooter({ text: "WhisperBot • Whispers Casino" })
        .setTimestamp();

    return withThumbnailAndImageSeparate(embed, "casino", "casino_banner");

}


// ---------------------------------------------------------------------
// Interactive slot machine sessions (/slots) — machine + bet setup,
// the persistent in-session embed that gets edited on every spin, and
// the leave summary.
// ---------------------------------------------------------------------

// Setup screen: choose machine, then bet amount.
function slotsSetupEmbed(chosenMachineLabel = null, chosenBetAmount = null) {

    const embed = new EmbedBuilder()
        .setTitle("🎰 CHOOSE YOUR MACHINE")
        .setColor(COLORS.GOLD)
        .setDescription("━━━━━━━━━━━━━━━━━━━━━━━━")
        .addFields(
            {
                name: "Machine",
                value: chosenMachineLabel || "*Not selected yet*",
                inline: true
            },
            {
                name: "Bet Amount",
                value: chosenBetAmount ? `${chosenBetAmount.toLocaleString()} coins` : "*Not selected yet*",
                inline: true
            }
        )
        .setFooter({ text: "Pick a machine and a bet amount, then Start Playing." });

    return withThumbnail(embed, "slots");

}


// The persistent session embed — edited in place on every spin, on
// cooldown, and while idle. `result` is null (idle/first load), "win",
// "lose", or "jackpot". `cooldownUntilUnix` is a unix-seconds timestamp
// (or null) so Discord renders a live-updating countdown client-side via
// <t:...:R> — no need for the bot to keep re-editing every second.
// Formats a slot result's flat symbol array for display, based on the
// machine's shape. "row" (default) is the original 3-reel single-line
// display; "5reel" renders a 3x5 grid; "3x3" renders a 3x3 grid.
function formatSlotGrid(symbols, layout = "row") {

    if (layout === "5reel") {

        const rows = [];
        for (let r = 0; r < 3; r++) {
            rows.push(symbols.slice(r * 5, r * 5 + 5).join(" | "));
        }
        return rows.join("\n");

    }

    if (layout === "3x3") {

        const rows = [];
        for (let r = 0; r < 3; r++) {
            rows.push(symbols.slice(r * 3, r * 3 + 3).join(" | "));
        }
        return rows.join("\n");

    }

    return `[ ${symbols.join(" ] [ ")} ]`;

}


function slotMachineEmbed({
    slotType,
    variantLabel,
    betAmount,
    balance,
    spinsLeft,
    maxSpins,
    result = null,
    symbols,
    winAmount = 0,
    cooldownUntilUnix = null,
    npcLine = null,
    layout = "row",
    winningLines = null
}) {

    const resultTitles = {
        win: "✅ You Win!",
        jackpot: "🎉 JACKPOT! 🎉",
        lose: "✖ No Match"
    };

    const title = result ? resultTitles[result] : variantLabel;

    const color =
        result === "jackpot" ? COLORS.GOLD :
        result === "win" ? COLORS.SUCCESS :
        result === "lose" ? COLORS.ERROR :
        COLORS.INFO;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(`${variantLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${formatSlotGrid(symbols, layout)}`)
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    if (result === "win" || result === "jackpot") {

        embed.addFields({
            name: "💰 Win",
            value: `${winAmount.toLocaleString()} coins!` +
                (winningLines && winningLines.length > 1 ? `\n(${winningLines.length} winning lines)` : ""),
            inline: false
        });

    } else if (result === "lose") {

        embed.addFields({
            name: "💸 Result",
            value: `You lost ${betAmount.toLocaleString()} coins.`,
            inline: false
        });

    }

    embed.addFields(
        {
            name: "🎯 Bet",
            value: `${betAmount.toLocaleString()} coins`,
            inline: true
        },
        {
            name: "💵 Balance",
            value: colorText(balance.toLocaleString(), ANSI.CYAN),
            inline: true
        }
    );

    if (cooldownUntilUnix) {

        embed.addFields({
            name: "⏳ Cooldown",
            value: `Spins refresh <t:${cooldownUntilUnix}:R>`,
            inline: false
        });

    } else {

        embed.addFields({
            name: "🎰 Spins Left",
            value: `${spinsLeft} / ${maxSpins}`,
            inline: false
        });

    }

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "slots");

}


// Shown after clicking Leave — session totals.
function slotsLeaveSummaryEmbed(variantLabel, sessionStats) {

    const net = sessionStats.net;

    const embed = new EmbedBuilder()
        .setTitle(`${variantLabel} — Session Ended`)
        .setColor(net >= 0 ? COLORS.SUCCESS : COLORS.ERROR)
        .setDescription("You left the slot machine.")
        .addFields(
            {
                name: "🎰 Spins Played",
                value: `${sessionStats.spins}`,
                inline: true
            },
            {
                name: "📊 Total Wagered",
                value: `${sessionStats.wagered.toLocaleString()} coins`,
                inline: true
            },
            {
                name: "🏆 Total Won",
                value: `${sessionStats.won.toLocaleString()} coins`,
                inline: true
            },
            {
                name: net >= 0 ? "📈 Net Profit" : "📉 Net Loss",
                value: colorText(`${net >= 0 ? "+" : ""}${net.toLocaleString()} Coins`, net >= 0 ? ANSI.GREEN : ANSI.RED),
                inline: false
            }
        )
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    return withThumbnail(embed, "casino");

}


// ---------------------------------------------------------------------
// Generic "sit down and play" session embeds, shared by roulette, horse,
// blackjack, dice, highlow, and poker. Slots has its own near-identical
// set (slotsSetupEmbed / slotMachineEmbed / slotsLeaveSummaryEmbed)
// since it shipped first and its 3-reel display doesn't fit this shape
// as cleanly — kept separate rather than forced into this one.
// ---------------------------------------------------------------------

// Generic setup screen. `choices` is an ordered array of
// { label, value } — value is null/undefined until the player picks it.
// e.g. [{ label: "Bet Type", value: "🔴 Red" }, { label: "Bet Amount", value: "1,000 coins" }]
// ---------------------------------------------------------------------
// Side activities (/mine, /chop, /dig, /farm, /build, /nether, /end)
// ---------------------------------------------------------------------

function activityResultEmbed(username, activityName, result) {

    const embed = new EmbedBuilder()
        .setTitle(`${result.emoji} ${result.outcome.text}`)
        .setColor(result.coins >= 500 ? COLORS.GOLD : COLORS.INFO)
        .setDescription(
            `**${username}** — ${activityName}\n\n` +
            `+${result.coins.toLocaleString()} coins • +${result.xp.toLocaleString()} XP\n\n` +
            `⏳ Refreshes <t:${result.cooldownUntilUnix}:R>`
        )
        .setFooter({ text: "🎮 Side Activity • WhisperBot" })
        .setTimestamp();

    if (result.npcLine) {

        embed.addFields({
            name: "👻 A Familiar Face Appears...",
            value: `*"${result.npcLine}"*`,
            inline: false
        });

    }

    if (result.leveledUp) {

        embed.addFields({
            name: "🎉 Level Up!",
            value: `You reached **Level ${result.newLevel}**!`,
            inline: false
        });

    }

    return withThumbnail(embed, "quest");

}


// ---------------------------------------------------------------------
// Quest Journal Hub (/quest hub) — see commands/quests/quest.js.
// ---------------------------------------------------------------------

const QUEST_DIFFICULTY_LABELS = {
    easy: "🟢 Easy",
    medium: "🟡 Medium",
    hard: "🔴 Hard",
    legend: "👑 Legendary"
};

const QUEST_CATEGORY_LABELS = {
    social: "💬 Social",
    voice: "🎙 Voice",
    community: "🤝 Community",
    exploration: "🗺 Exploration",
    events: "🎉 Events",
    special: "⭐ Special"
};


function questHubEmbed(username, activeCount, maxActive, availableCount) {

    const embed = new EmbedBuilder()
        .setTitle("📜 Whisper Quest Journal")
        .setColor(COLORS.INFO)
        .setDescription(`Welcome, **${username}**.\n\nYour adventures await.`)
        .addFields(
            {
                name: "📋 Quest Board",
                value: `Available Quests: ${availableCount}\nActive Quests: ${activeCount}/${maxActive}`,
                inline: false
            },
            {
                name: "🎮 Side Activities",
                value: "Quick activities with random rewards.\nMine. Chop. Dig. Farm. Build. Explore.",
                inline: false
            },
            {
                name: "🏆 Bounties",
                value: "Daily and weekly challenges.\n*Coming Soon...*",
                inline: false
            },
            {
                name: "📖 History",
                value: "Completed quests and achievements.\n*Coming Soon...*",
                inline: false
            }
        )
        .setFooter({ text: "Your adventure awaits." })
        .setTimestamp();

    return withThumbnail(embed, "quest");

}


function questBoardEmbed(pageQuests, page, totalPages) {

    const embed = new EmbedBuilder()
        .setTitle(`📜 Quest Board — Page ${page + 1}/${Math.max(totalPages, 1)}`)
        .setColor(COLORS.INFO)
        .setFooter({ text: "Select a quest below to view details." });

    if (!pageQuests.length) {

        embed.setDescription("No quests available right now — check back later!");
        return withThumbnail(embed, "quest");

    }

    for (const quest of pageQuests) {

        embed.addFields({
            name: `${quest.emoji || "📜"} ${quest.name.replace(/^\S+\s/, "")}`,
            value:
                `${quest.description}\n` +
                `Reward: ${quest.rewardCoins.toLocaleString()} Coins • ${quest.rewardXP.toLocaleString()} XP` +
                (quest.rewardRep ? ` • ${quest.rewardRep} Rep` : "") +
                `\n${QUEST_DIFFICULTY_LABELS[quest.difficulty] || quest.difficulty || "Normal"} • ` +
                `${QUEST_CATEGORY_LABELS[quest.category] || quest.category || "General"}`,
            inline: false
        });

    }

    return withThumbnail(embed, "quest");

}


function questDetailsEmbed(quest) {

    const embed = new EmbedBuilder()
        .setTitle("📜 QUEST DETAILS")
        .setColor(COLORS.INFO)
        .addFields(
            {
                name: quest.name,
                value: quest.description,
                inline: false
            },
            {
                name: "📊 Requirements",
                value: `Goal: ${quest.goal.toLocaleString()}\nType: ${quest.type}`,
                inline: true
            },
            {
                name: "🏷️ Info",
                value:
                    `${QUEST_DIFFICULTY_LABELS[quest.difficulty] || quest.difficulty || "Normal"}\n` +
                    `${QUEST_CATEGORY_LABELS[quest.category] || quest.category || "General"}`,
                inline: true
            },
            {
                name: "🎁 Rewards",
                value:
                    `💰 ${quest.rewardCoins.toLocaleString()} Coins\n` +
                    `⭐ ${quest.rewardXP.toLocaleString()} XP` +
                    (quest.rewardRep ? `\n🏰 ${quest.rewardRep} Reputation` : ""),
                inline: false
            }
        )
        .setFooter({ text: "📜 Whisper Quest Journal" });

    return withThumbnail(embed, "quest");

}


function activitiesListEmbed(activityList) {

    const lines = activityList
        .map(a => `${a.emoji} **${a.name}** — ${a.description} (\`/${a.id}\`)`)
        .join("\n");

    const embed = new EmbedBuilder()
        .setTitle("🎮 Side Activities")
        .setColor(COLORS.INFO)
        .setDescription(
            `Quick activities with random rewards — no quest to start, just run the command.\n\n` +
            `${lines}\n` +
            `🎣 **Fishing** — Go fishing and try your luck (\`/fish\`)\n\n` +
            `⏳ Cooldowns are random per activity (roughly 1-5 minutes) and persist even if you restart the bot.`
        )
        .setFooter({ text: "📜 Whisper Quest Journal" });

    return withThumbnail(embed, "quest");

}


function activityCooldownEmbed(activityName, message, untilUnix) {

    const embed = new EmbedBuilder()
        .setTitle("⏳ Not Yet...")
        .setColor(COLORS.WARNING)
        .setDescription(
            `${message}\n\n` +
            (untilUnix ? `Ready <t:${untilUnix}:R>` : "")
        )
        .setFooter({ text: `${activityName} • WhisperBot` });

    return withThumbnail(embed, "quest");

}


// Shown when a player tries to start a game they're still on a
// persistent (database-backed) cooldown for.
function casinoCooldownBlockedEmbed(gameLabel, untilUnix) {

    const embed = new EmbedBuilder()
        .setTitle("⏳ COOLDOWN ACTIVE")
        .setColor(COLORS.WARNING)
        .setDescription(
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `You're on cooldown for **${gameLabel}**.\n\n` +
            `Refreshes <t:${untilUnix}:R>\n\n` +
            `Please wait before playing again.\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setFooter({ text: "🎰 Whispers Casino" });

    return withThumbnail(embed, "casino");

}


function casinoSetupEmbed(gameTitle, choices) {

    const embed = new EmbedBuilder()
        .setTitle(gameTitle)
        .setColor(COLORS.GOLD)
        .setDescription("━━━━━━━━━━━━━━━━━━━━━━━━")
        .addFields(choices.map(c => ({
            name: c.label,
            value: c.value || "*Not selected yet*",
            inline: true
        })))
        .setFooter({ text: "Make your selections, then Start Playing." });

    return withThumbnail(embed, "casino");

}


// The persistent in-session embed — edited in place on setup completion,
// every play, and while on cooldown.
//
// opts:
//   title        "🃏 BLACKJACK — Dealer Frank"
//   roundLabel   "Hand #3"
//   betLine      "1,000 coins (Over 7)"
//   balance
//   playsLeft, maxPlays, playsLabel  ("Hands Left" / "Rolls Left" / ...)
//   bodyLines    string[] — the game's own visual (cards, dice, race bars...)
//   resultLine   string|null — win/lose/push message, omitted while idle
//   color
//   cooldown     { seconds, label, untilUnix } | null
//   npcLine      string|null
function casinoSessionEmbed({
    title,
    roundLabel,
    betLine,
    balance,
    playsLeft,
    maxPlays,
    playsLabel = "Plays Left",
    bodyLines = [],
    resultLine = null,
    color = COLORS.INFO,
    cooldown = null,
    npcLine = null
}) {

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(
            `${roundLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            bodyLines.join("\n")
        )
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    embed.addFields(
        {
            name: "🎯 Bet",
            value: betLine,
            inline: true
        },
        {
            name: "💵 Balance",
            value: colorText(balance.toLocaleString(), ANSI.CYAN),
            inline: true
        }
    );

    if (resultLine) {

        embed.addFields({
            name: "Result",
            value: resultLine,
            inline: false
        });

    }

    if (cooldown) {

        embed.addFields({
            name: `⏳ Cooldown (${cooldown.label})`,
            value: `Refreshes <t:${cooldown.untilUnix}:R>`,
            inline: false
        });

    } else {

        embed.addFields({
            name: `🎰 ${playsLabel}`,
            value: `${playsLeft} / ${maxPlays}`,
            inline: false
        });

    }

    if (npcLine) {
        embed.addFields({ name: "\u200b", value: npcLine, inline: false });
    }

    return withThumbnail(embed, "casino");

}


// Shown after Leave — same shape for every game.
function casinoSessionSummaryEmbed(gameLabel, stats) {

    const net = stats.net;

    const embed = new EmbedBuilder()
        .setTitle("🎰 SESSION SUMMARY")
        .setColor(net >= 0 ? COLORS.SUCCESS : COLORS.ERROR)
        .setDescription("━━━━━━━━━━━━━━━━━━━━━━━━")
        .addFields(
            {
                name: "🎮 Game",
                value: gameLabel,
                inline: true
            },
            {
                name: "🎲 Plays",
                value: `${stats.plays}`,
                inline: true
            },
            {
                name: "📊 Total Wagered",
                value: `${stats.wagered.toLocaleString()} coins`,
                inline: false
            },
            {
                name: "🏆 Total Won",
                value: `${stats.won.toLocaleString()} coins`,
                inline: false
            },
            {
                name: net >= 0 ? "📈 Net Profit" : "📉 Net Loss",
                value: colorText(`${net >= 0 ? "+" : ""}${net.toLocaleString()} Coins`, net >= 0 ? ANSI.GREEN : ANSI.RED),
                inline: false
            }
        )
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    return withThumbnail(embed, "casino");

}


// ---------------------------------------------------------------------
// Casino XP/rank display, game history, and achievements list.
// ---------------------------------------------------------------------

// /casino vip (now rank-based — see CASINO_CHANGES.md for why the old
// wagered-threshold VIP display was replaced by this).
function casinoRankEmbed(username, xp, rank, nextRank, avatarURL) {

    const embed = new EmbedBuilder()
        .setTitle(`🏆 ${username}'s Casino Rank`)
        .setColor(COLORS.GOLD)
        .addFields({
            name: "Current Rank",
            value: `${rank.label}`,
            inline: false
        });

    if (nextRank) {

        const progress = Math.min(1, xp / nextRank.xp);
        const filled = Math.round(progress * 10);
        const bar = "█".repeat(filled) + "░".repeat(10 - filled);

        embed.addFields(
            {
                name: "XP",
                value: `${xp.toLocaleString()} / ${nextRank.xp.toLocaleString()}`,
                inline: true
            },
            {
                name: "Progress",
                value: colorText(`${bar} ${Math.round(progress * 100)}%`, ANSI.GREEN),
                inline: true
            },
            {
                name: "Next Rank",
                value: `${nextRank.label} — ${nextRank.remaining.toLocaleString()} XP to go`,
                inline: false
            }
        );

    } else {

        embed.addFields({
            name: "XP",
            value: `${xp.toLocaleString()} (max rank reached 🏆)`,
            inline: false
        });

    }

    embed.setFooter({ text: "Earn XP by playing any casino game — bigger wins earn more." }).setTimestamp();

    if (avatarURL) embed.setAuthor({ name: username, iconURL: avatarURL });

    return withThumbnailAndImageSeparate(embed, "casino", "casino_banner");

}


// /casino history — last N plays from casino_history.
function casinoHistoryEmbed(username, games) {

    const gameEmojis = {
        blackjack: "🃏", dice: "🎲", highlow: "🎯",
        horse: "🐎", slots: "🎰", roulette: "🔴", poker: "♠️"
    };

    if (!games.length) {

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${username}'s Casino History`)
            .setColor(COLORS.INFO)
            .setDescription("No games played yet — visit `/casino menu` to get started!");

        return withThumbnail(embed, "casino");

    }

    const lines = games.map((g, i) => {
        const emoji = gameEmojis[g.game_type] || "🎮";
        const label = g.game_type.charAt(0).toUpperCase() + g.game_type.slice(1);
        const amount = g.result === "win" ? `+${g.win_amount.toLocaleString()}` :
            g.result === "push" ? "±0" : `-${g.bet_amount.toLocaleString()}`;
        const resultLabel = g.result === "win" ? "Win" : g.result === "push" ? "Push" : "Loss";
        const when = timeAgo(g.played_at);
        return `${i + 1}. ${emoji} ${label.padEnd(10)} ${amount.padStart(10)}  (${resultLabel})  ${when}`;
    });

    let totalNet = 0;
    let wins = 0;

    for (const g of games) {
        totalNet += g.result === "win" ? g.win_amount - g.bet_amount : (g.result === "push" ? 0 : -g.bet_amount);
        if (g.result === "win") wins++;
    }

    const winRate = Math.round((wins / games.length) * 100);

    const embed = new EmbedBuilder()
        .setTitle(`📜 ${username}'s Casino History`)
        .setColor(totalNet >= 0 ? COLORS.SUCCESS : COLORS.ERROR)
        .setDescription(`Last ${games.length} Games:\n\n\`\`\`\n${lines.join("\n")}\n\`\`\``)
        .addFields({
            name: "Summary",
            value: `Total: ${totalNet >= 0 ? "+" : ""}${totalNet.toLocaleString()} coins over ${games.length} games\nWin Rate: ${winRate}%`,
            inline: false
        })
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    return withThumbnail(embed, "casino");

}


function timeAgo(isoDate) {

    const diffMs = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diffMs / 60000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;

    return `${Math.floor(hours / 24)}d ago`;

}


// /casino achievements — casino-prefixed achievements from the shared
// achievements system (data/achievements.js + services/achievementService.js),
// not a separate table — see CASINO_CHANGES.md.
function casinoAchievementsEmbed(username, allCasinoAchievements, unlockedIds) {

    const lines = allCasinoAchievements.map(a => {
        const unlocked = unlockedIds.includes(a.id);
        return `${unlocked ? "✅" : "🔒"} ${a.name} — ${a.description}`;
    });

    const unlockedCount = allCasinoAchievements.filter(a => unlockedIds.includes(a.id)).length;
    const totalRewards = allCasinoAchievements
        .filter(a => unlockedIds.includes(a.id))
        .reduce((sum, a) => sum + a.rewardCoins, 0);

    const embed = new EmbedBuilder()
        .setTitle(`🏆 ${username}'s Casino Achievements`)
        .setColor(COLORS.GOLD)
        .setDescription(lines.join("\n"))
        .addFields({
            name: "Progress",
            value: `${unlockedCount}/${allCasinoAchievements.length} achievements\nTotal Rewards: ${totalRewards.toLocaleString()} coins`,
            inline: false
        })
        .setFooter({ text: "🎰 Whispers Casino" })
        .setTimestamp();

    return withThumbnail(embed, "casino");

}


module.exports = {

    getCommandThumbnail,

    withThumbnail,

    withThumbnailAndImage,
    
    withThumbnailAndImageSeparate,

    withThumbnailAndBanner,

    withImage,

    baseEmbed,

    successEmbed,

    errorEmbed,

    infoEmbed,

    profileEmbed,

    betMenuEmbed,

    highlowDealEmbed,

    highlowResultEmbed,

    raceChallengeEmbed,

    raceStatusEmbed,

    raceResultEmbed,

    racesListEmbed,

    questListEmbed,

    questStartedEmbed,

    activeQuestsEmbed,

    inventoryEmbed,

    helpEmbed,

    fishResultEmbed,

    levelUpEmbed,

    achievementEmbed,

    dailyMissionCompleteEmbed,

    dailyMissionEmbed,

    dailyCheckinEmbed,

    dailyCheckinCooldownEmbed,

    diceResultEmbed,

    blackjackHandEmbed,

    blackjackResultEmbed,

    casinoStatsEmbed,

    casinoLeaderboardEmbed,

    robberyScanEmbed,

    robberyEstimateEmbed,

    robberyExecutionEmbed,

    robberyVictimDMEmbed,

    robberyChannelPingEmbed,

    robberyTimeoutNote,

    robberyResultEmbed,

    robberyRollingEmbed,

    robberyVictimResultDMEmbed,

    colorText,

    coloredBar,

    casinoMenuEmbed,

    horseFieldEmbed,

    horseResultEmbed,

    slotsResultEmbed,

    slotsSetupEmbed,

    slotMachineEmbed,

    slotsLeaveSummaryEmbed,

    casinoSetupEmbed,

    casinoCooldownBlockedEmbed,

    activityResultEmbed,

    activityCooldownEmbed,

    questHubEmbed,

    questBoardEmbed,

    questDetailsEmbed,

    activitiesListEmbed,

    casinoSessionEmbed,

    casinoSessionSummaryEmbed,

    rouletteResultEmbed,

    pokerProgressiveEmbed,

    ticHouseEmbed,

    ticChallengeEmbed,

    ticMatchEmbed,

    memoryHubEmbed,

    memoryGameEmbed,

    pokerHandEmbed,

    pokerResultEmbed,

    casinoVipEmbed,

    casinoPassportEmbed,

    casinoRankEmbed,

    casinoHistoryEmbed,

    casinoAchievementsEmbed,

    casinoAnnouncementEmbed,

    ANSI

};