const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { COLORS } = require("../config/constants");

const kingdoms = require("../data/kingdoms");

const { colorText, ANSI, withThumbnail, withImage } = require("./embedFactory");


// A rough Discord ButtonStyle per kingdom. Discord only ships 4 button
// colors (blurple/gray/green/red) so this can't perfectly match every
// kingdom's circle color, but it keeps each button visually distinct.
const KINGDOM_BUTTON_STYLE = {
    North: ButtonStyle.Success,
    East: ButtonStyle.Primary,
    South: ButtonStyle.Secondary,
    West: ButtonStyle.Danger
};

// Exact emoji requested for the Kingdom Atlas nav row (distinct from the
// per-kingdom `icon` used elsewhere, e.g. /kingdoms and the join flow).
const ATLAS_EMOJI = {
    North: "🏔",
    East: "⚒",
    South: "📚",
    West: "🧪"
};


function formatJoinedDate(kingdomJoined) {

    if (!kingdomJoined) return "Unknown";

    const then = new Date(kingdomJoined);
    const days = Math.floor((Date.now() - then.getTime()) / 86400000);

    if (days < 1) return "Joined today";
    if (days === 1) return "Joined 1 day ago";
    if (days < 30) return `Joined ${days} days ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `Member for ${months} month${months === 1 ? "" : "s"}`;

    const years = Math.floor(months / 12);
    return `Member for ${years} year${years === 1 ? "" : "s"}`;

}


function tradesAndNpcsFields(info) {

    return (
        `**🛠️ Specialties**\n` +
        info.trades.map(t => `• ${t}`).join("\n") +
        `\n\n**🧑‍🌾 NPCs**\n` +
        info.npcs.map(n => `${n.emoji} ${n.name}`).join(" • ")
    );

}


function topList(rows, valueKey, suffix = "") {

    if (!rows.length) return "*No members yet*";

    return rows
        .map((row, i) => `**${i + 1}.** ${row.username} — ${row[valueKey].toLocaleString()}${suffix}`)
        .join("\n");

}


// A relative bar comparing this kingdom's reputation to the leading kingdom.
function comparisonBar(key, repTotals) {

    const values = Object.values(repTotals);
    const max = Math.max(...values, 1);
    const mine = repTotals[key] || 0;

    const percent = mine / max;
    const filled = Math.round(percent * 10);
    const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);

    const ranked = Object.entries(repTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

    const place = ranked.indexOf(key) + 1;

    return `${bar}  #${place} of ${ranked.length} kingdoms by reputation`;

}


// ---------------------------------------------------------------------
// /kingdom join flow
// ---------------------------------------------------------------------

function kingdomSelectEmbed() {

    const embed = new EmbedBuilder()
        .setTitle("🏰 Join a Kingdom")
        .setDescription(
            "Every kingdom specializes in different professions, NPCs, and playstyles.\n" +
            "Choose carefully—your kingdom determines your home, your merchants, and your role in the Whisper SMP world."
        )
        .setColor(COLORS.INFO)
        .setFooter({ text: "WhisperBot • WhisperSMP" });

    return withThumbnail(embed, "kingdom");

}

function kingdomSelectRow() {

    const row = new ActionRowBuilder();

    for (const key of Object.keys(kingdoms)) {

        const info = kingdoms[key];

        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`select_${key}`)
                .setLabel(info.name)
                .setEmoji(info.circle)
                .setStyle(KINGDOM_BUTTON_STYLE[key] || ButtonStyle.Secondary)
        );

    }

    return row;

}

function kingdomConfirmEmbed(key) {

    const info = kingdoms[key];

    const embed = new EmbedBuilder()
        .setTitle(`${info.circle} ${info.icon} Join ${info.name}?`)
        .setDescription(`Are you sure you want to join **${info.name}**?`)
        .setColor(info.color)
        .setFooter({ text: "WhisperBot • WhisperSMP" });

    return withThumbnail(embed, "kingdom");

}

function kingdomConfirmRow(key) {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`confirm_${key}`)
            .setLabel("Confirm")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("cancel")
            .setLabel("Cancel")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Secondary)
    );

}

function kingdomJoinSuccessEmbed(key) {

    const info = kingdoms[key];

    const embed = new EmbedBuilder()
        .setTitle(`${info.circle} ${info.icon} Welcome to ${info.name}!`)
        .setDescription(
            `*${info.lore}*\n\n` +
            "Your journey begins. Use `/kingdom info` any time to check your standing."
        )
        .setColor(info.color)
        .setFooter({ text: "WhisperBot • WhisperSMP" });

    return withThumbnail(embed, "kingdom");

}

function kingdomTimeoutEmbed() {

    const embed = new EmbedBuilder()
        .setTitle("⌛ Selection Expired")
        .setDescription("This kingdom selection timed out. Run `/kingdom join` again when you're ready.")
        .setColor(COLORS.WARNING)
        .setFooter({ text: "WhisperBot • WhisperSMP" });

    return withThumbnail(embed, "kingdom");

}

function kingdomLeaveEmbed() {

    const embed = new EmbedBuilder()
        .setTitle("🚪 Kingdom Left")
        .setDescription("You have left your kingdom. Use `/kingdom join` to pick a new one any time.")
        .setColor(COLORS.WARNING)
        .setFooter({ text: "WhisperBot • WhisperSMP" });

    return withThumbnail(embed, "kingdom");

}


// ---------------------------------------------------------------------
// Kingdom Atlas — /kingdom info
// ---------------------------------------------------------------------

// Shared nav row(s) used on every Atlas page. `activeKey` is one of
// "North" | "East" | "South" | "West" | "mykingdom" | "overview" — its
// matching button is disabled to show the player where they are.
function kingdomAtlasRows(activeKey) {

    const navRow = new ActionRowBuilder();

    for (const key of Object.keys(kingdoms)) {

        const info = kingdoms[key];

        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`atlas_${key}`)
                .setLabel(info.name)
                .setEmoji(ATLAS_EMOJI[key])
                .setStyle(KINGDOM_BUTTON_STYLE[key] || ButtonStyle.Secondary)
                .setDisabled(activeKey === key)
        );

    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId("atlas_mykingdom")
            .setLabel("My Kingdom")
            .setEmoji("🏠")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(activeKey === "mykingdom")
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("atlas_overview")
            .setLabel("Kingdom Atlas Overview")
            .setEmoji("🌎")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(activeKey === "overview")
    );

    return [navRow, backRow];

}


// Page 1 — WhisperSMP overview
function kingdomAtlasEmbed(serverStats) {

    const highest = serverStats.highestLevelPlayer;
    const richest = serverStats.richestPlayer;

    const embed = new EmbedBuilder()
        .setTitle("🌎 WhisperSMP Kingdom Atlas")
        .setDescription(
            "The four kingdoms are the major civilizations of WhisperSMP. " +
            "Join one to earn reputation, take part in kingdom events, and compete for the top spot on the leaderboards.\n\n" +
            "Use the buttons below to explore each kingdom, or check your own standing with **My Kingdom**."
        )
        .setColor(COLORS.INFO)
        .addFields(
            {
                name: "👥 Total Registered Players",
                value: colorText(serverStats.totalPlayers.toLocaleString(), ANSI.CYAN),
                inline: true
            },
            {
                name: "🏰 Total Kingdoms",
                value: colorText(serverStats.totalKingdoms.toLocaleString(), ANSI.CYAN),
                inline: true
            },
            {
                name: "🧑‍🤝‍🧑 Total Kingdom Members",
                value: colorText(serverStats.totalMembers.toLocaleString(), ANSI.CYAN),
                inline: true
            },
            {
                name: "🏆 Total Reputation Earned",
                value: colorText(serverStats.totalRep.toLocaleString(), ANSI.CYAN),
                inline: true
            },
            {
                name: "📈 Average Player Level",
                value: colorText(serverStats.avgLevel.toFixed(1), ANSI.CYAN),
                inline: true
            },
            {
                name: "⚔️ Highest Level Player",
                value: highest ? `${highest.username} — Level ${highest.level}` : "*Not yet available*",
                inline: true
            },
            {
                name: "💰 Richest Player",
                value: richest ? `${richest.username} — ${richest.coins.toLocaleString()} coins` : "*Not yet available*",
                inline: true
            }
        )
        .setFooter({ text: "WhisperBot • WhisperSMP" })
        .setTimestamp();

    return withThumbnail(embed, "kingdom");

}


// A kingdom's detail page
function kingdomDetailEmbed(key, stats, repTotals) {

    const info = kingdoms[key];

    const embed = new EmbedBuilder()
        .setTitle(`${info.circle} ${info.icon} ${info.name}`)
        .setDescription(
            `**${info.theme}**\n*${info.lore}*`
        )
        .setColor(info.color)
        .addFields(
            {
                name: "🧑‍🤝‍🧑 Members",
                value: colorText(stats.memberCount.toLocaleString(), info.ansi),
                inline: true
            },
            {
                name: "📈 Average Level",
                value: colorText(stats.avgLevel.toFixed(1), info.ansi),
                inline: true
            },
            {
                name: "🏆 Total Reputation",
                value: colorText(stats.totalRep.toLocaleString(), info.ansi),
                inline: true
            },
            {
                name: "💰 Richest Member",
                value: stats.richestMember
                    ? `${stats.richestMember.username} — ${stats.richestMember.coins.toLocaleString()} coins`
                    : "*No members yet*",
                inline: true
            },
            {
                name: "⚔️ Highest Level Member",
                value: stats.highestLevelMember
                    ? `${stats.highestLevelMember.username} — Level ${stats.highestLevelMember.level}`
                    : "*No members yet*",
                inline: true
            },
            {
                name: "✨ Newest Member",
                value: stats.newestMember
                    ? `${stats.newestMember.username} — ${formatJoinedDate(stats.newestMember.kingdom_joined)}`
                    : "*Unknown*",
                inline: true
            },
            {
                name: "\u200b",
                value: tradesAndNpcsFields(info),
                inline: false
            },
            {
                name: "🥇 Top 10 — XP",
                value: topList(stats.topByXP, "xp", " XP"),
                inline: true
            },
            {
                name: "🥇 Top 10 — Coins",
                value: topList(stats.topByCoins, "coins", " coins"),
                inline: true
            },
            {
                name: "🥇 Top 10 — Reputation",
                value: topList(stats.topByRep, "kingdom_rep", " rep"),
                inline: true
            },
            {
                name: "📊 Kingdom Standing",
                value: comparisonBar(key, repTotals),
                inline: false
            }
        )
        .setFooter({ text: "WhisperBot • WhisperSMP" })
        .setTimestamp();

    return withThumbnail(embed, "kingdom");

}


// My Kingdom page — player has joined a kingdom
function myKingdomEmbed(username, avatarURL, user, rank) {

    const info = kingdoms[user.kingdom];

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${username}'s Kingdom`,
            iconURL: avatarURL
        })
        .setTitle(`${info.circle} ${info.icon} ${info.name}`)
        .setDescription(
            `${colorText("▮".repeat(12), info.ansi, false)}\n*${info.lore}*`
        )
        .setColor(info.color)
        .addFields(
            {
                name: "⭐ Kingdom Rank",
                value: colorText(`#${rank}`, info.ansi),
                inline: true
            },
            {
                name: "🏆 Reputation",
                value: colorText(`${user.kingdom_rep}`, info.ansi),
                inline: true
            },
            {
                name: "📅 Membership",
                value: colorText(formatJoinedDate(user.kingdom_joined), info.ansi),
                inline: true
            },
            {
                name: "💰 Coins",
                value: colorText(user.coins.toLocaleString(), info.ansi),
                inline: true
            },
            {
                name: "📈 Level",
                value: colorText(`${user.level}`, info.ansi),
                inline: true
            },
            {
                name: "✨ XP",
                value: colorText(user.xp.toLocaleString(), info.ansi),
                inline: true
            },
            {
                name: "\u200b",
                value: tradesAndNpcsFields(info),
                inline: false
            }
        )
        .setThumbnail(avatarURL)
        .setFooter({ text: "WhisperBot • WhisperSMP" })
        .setTimestamp();

    return withImage(embed, "kingdom");

}


// My Kingdom page — player hasn't joined one yet
function myKingdomNoneEmbed() {

    const embed = new EmbedBuilder()
        .setTitle("🏠 No Kingdom Yet")
        .setDescription(
            "You haven't joined a kingdom yet! Pick one above to start earning reputation, " +
            "unlock kingdom perks, and compete on the leaderboards.\n\nUse `/kingdom join` to choose yours."
        )
        .setColor(COLORS.INFO)
        .setFooter({ text: "WhisperBot • WhisperSMP" });

    return withThumbnail(embed, "kingdom");

}


// ---------------------------------------------------------------------
// /kingdoms overview (static, non-interactive summary)
// ---------------------------------------------------------------------

function kingdomsOverviewEmbed() {

    const embed = new EmbedBuilder()
        .setTitle("🏰 The Four Kingdoms of WhisperSMP")
        .setDescription("Every kingdom has its own trades, NPCs, and playstyle. Use `/kingdom join` to pick yours, or `/kingdom info` to explore the full Kingdom Atlas.")
        .setColor(COLORS.INFO)
        .setFooter({ text: "WhisperBot • WhisperSMP" });

    for (const key of Object.keys(kingdoms)) {

        const info = kingdoms[key];

        embed.addFields({
            name: `${info.circle} ${info.icon} ${info.name}`,
            value:
                `**${info.theme}**\n` +
                `*${info.description}*\n\n` +
                info.trades.map(t => `• ${t}`).join("\n") +
                `\n${info.npcs.map(n => n.emoji).join(" ")}`,
            inline: false
        });

    }

    return withThumbnail(embed, "kingdoms");

}


module.exports = {

    kingdomSelectEmbed,
    kingdomSelectRow,
    kingdomConfirmEmbed,
    kingdomConfirmRow,
    kingdomJoinSuccessEmbed,
    kingdomTimeoutEmbed,
    kingdomLeaveEmbed,

    kingdomAtlasRows,
    kingdomAtlasEmbed,
    kingdomDetailEmbed,
    myKingdomEmbed,
    myKingdomNoneEmbed,

    kingdomsOverviewEmbed

};
