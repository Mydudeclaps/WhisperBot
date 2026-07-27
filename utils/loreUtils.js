const { EmbedBuilder } = require('discord.js');

const CATEGORIES = {
    history: '📜 History',
    battle: '⚔️ Battle',
    kingdom: '👑 Kingdom',
    wilderness: '🌲 Wilderness',
    tavern_tale: '🍺 Tavern Tale',
    rumor: '👻 Rumor',
    prophecy: '🔮 Prophecy',
    creature: '🐉 Creature',
    romance: '❤️ Romance',
    humor: '😂 Humor',
    mystery: '🌙 Mystery',
    discovery: '🏛 Discovery',
    legend: '🧙 Legend'
};

const ARCHIVE_COLOR = 0x2C2F33;
const LEGENDARY_COLOR = 0xFFD700;
const PENDING_COLOR = 0xFFA500;

function formatDate(date) {
    const now = new Date();
    const then = new Date(date);
    const diff = now - then;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
}

function categoryLabel(category) {
    return CATEGORIES[category] || 'History';
}

// Escapes text that will be embedded inside a Markdown blockquote/description
// so a submitted entry can't break embed formatting or inject extra fields.
function sanitizeForEmbed(text) {
    return text.replace(/```/g, '\u200b`\u200b`\u200b`').slice(0, 2000);
}

function buildLoreEmbed(entry) {
    const isLegendary = !!entry.legendary;
    const title = isLegendary ? '✨ A Forgotten Page Has Surfaced...' : '📜 A Page From The Archives';
    const safeText = sanitizeForEmbed(entry.text);

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(
            `*"${safeText}"*\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📖 Archive Entry #${entry.archive_number}\n` +
            `🗂️ Category: ${categoryLabel(entry.category)}\n` +
            `🕰️ Archived ${formatDate(entry.submitted_at)}\n\n` +
            `*"The Archives remember..."*`
        )
        .setColor(isLegendary ? LEGENDARY_COLOR : ARCHIVE_COLOR)
        .setFooter({ text: isLegendary ? 'Some stories are not meant to be forgotten.' : 'The Archives remember...' })
        .setTimestamp();

    return embed;
}

module.exports = {
    CATEGORIES,
    ARCHIVE_COLOR,
    LEGENDARY_COLOR,
    PENDING_COLOR,
    formatDate,
    categoryLabel,
    sanitizeForEmbed,
    buildLoreEmbed
};
