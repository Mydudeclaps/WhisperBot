const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const RARITY_EMOJI = {
    common: '⭐',
    uncommon: '🌟',
    rare: '✨',
    epic: '👑',
    legendary: '🔮',
    divine: '☀️'
};

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'divine'];

function getRarityEmoji(rarity) {
    return RARITY_EMOJI[rarity] || '⭐';
}

function formatCoins(amount) {
    return `${amount.toLocaleString()} coins`;
}

/** e.g. 3725 -> "1h 2m", 45 -> "45s" */
function formatDuration(seconds) {
    if (seconds == null) return null;
    if (seconds <= 0) return 'now';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function stockLine(item) {
    if (item.unlimited_stock) {
        return 'Stock: Unlimited';
    }
    if (item.current_stock > 0) {
        return `Stock: ${item.current_stock}/${item.max_stock}`;
    }
    const restock = formatDuration(item.secondsUntilRestock);
    return restock ? `❌ Out of Stock • restocks in ${restock}` : '❌ Out of Stock';
}

/**
 * Builds a Discord AttachmentBuilder for an item's local image file.
 * Checks assets/icons/ first, then assets/images/, for "<item.image>.png".
 * Returns null — never throws — if the item, its image field, or the file
 * itself is missing, so callers can always skip the thumbnail/image
 * cleanly instead of crashing.
 */
function getItemImageAttachment(item) {

    if (!item || !item.image) return null;

    const possiblePaths = [
        path.join(__dirname, '../../assets/icons', `${item.image}.png`),
        path.join(__dirname, '../../assets/images', `${item.image}.png`)
    ];

    for (const imagePath of possiblePaths) {

        try {

            if (fs.existsSync(imagePath)) {
                return new AttachmentBuilder(imagePath, { name: `${item.image}.png` });
            }

        } catch (error) {
            console.warn(`[ImageHelper] Error checking path ${imagePath}:`, error.message);
        }

    }

    console.warn(`[ImageHelper] Missing icon for: ${item.image}`);
    return null;

}

function sortByRarity(items) {
    return [...items].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
}

module.exports = {
    RARITY_EMOJI,
    RARITY_ORDER,
    getRarityEmoji,
    formatCoins,
    formatDuration,
    stockLine,
    sortByRarity,
    getItemImageAttachment
};
