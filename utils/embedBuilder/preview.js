const { EmbedBuilder } = require("discord.js");

const { LIMITS, totalCharacters, isValidHexColor } = require("./validation");


const PLACEHOLDER_COLOR = 0x2B2D31;


function isDraftEmpty(draft) {

    return (
        !draft.title &&
        !draft.description &&
        !draft.fields.length &&
        !draft.image &&
        !draft.thumbnail &&
        !draft.author.name &&
        !draft.footer.text
    );

}


// Builds the embed the staff member is actually creating — used both for
// the live preview and (once validated) the real message sent to a channel.
function buildDraftEmbed(draft) {

    const embed = new EmbedBuilder();

    if (draft.title) embed.setTitle(draft.title.slice(0, LIMITS.TITLE));
    if (draft.description) embed.setDescription(draft.description.slice(0, LIMITS.DESCRIPTION));

    if (draft.color && isValidHexColor(draft.color)) {
        const hex = draft.color.startsWith("#") ? draft.color : `#${draft.color}`;
        embed.setColor(hex);
    } else {
        embed.setColor(PLACEHOLDER_COLOR);
    }

    if (draft.timestamp) embed.setTimestamp();

    if (draft.author.name) {

        embed.setAuthor({
            name: draft.author.name.slice(0, LIMITS.AUTHOR_NAME),
            iconURL: draft.author.iconURL || undefined,
            url: draft.author.url || undefined
        });

    }

    if (draft.thumbnail) embed.setThumbnail(draft.thumbnail);
    if (draft.image) embed.setImage(draft.image);

    if (draft.footer.text) {

        embed.setFooter({
            text: draft.footer.text.slice(0, LIMITS.FOOTER_TEXT),
            iconURL: draft.footer.iconURL || undefined
        });

    }

    for (const field of draft.fields) {

        embed.addFields({
            name: (field.name || "\u200b").slice(0, LIMITS.FIELD_NAME),
            value: (field.value || "\u200b").slice(0, LIMITS.FIELD_VALUE),
            inline: !!field.inline
        });

    }

    return embed;

}


function usageIcon(value, max) {

    if (value > max) return "🔴";
    if (value >= max * 0.9) return "🟡";
    return "🟢";

}


function buildCharCounterText(draft) {

    const titleLen = (draft.title || "").length;
    const descLen = (draft.description || "").length;
    const footerLen = (draft.footer.text || "").length;
    const total = totalCharacters(draft);

    return (
        `${usageIcon(titleLen, LIMITS.TITLE)} Title: ${titleLen}/${LIMITS.TITLE}  •  ` +
        `${usageIcon(descLen, LIMITS.DESCRIPTION)} Description: ${descLen}/${LIMITS.DESCRIPTION}\n` +
        `${usageIcon(draft.fields.length, LIMITS.MAX_FIELDS)} Fields: ${draft.fields.length}/${LIMITS.MAX_FIELDS}  •  ` +
        `${usageIcon(footerLen, LIMITS.FOOTER_TEXT)} Footer: ${footerLen}/${LIMITS.FOOTER_TEXT}\n` +
        `${usageIcon(total, LIMITS.TOTAL)} Total: ${total}/${LIMITS.TOTAL}`
    );

}


// The panel embed shown *inside the builder itself* — the real draft embed
// plus a live character-usage readout appended as an extra field, so it's
// never an empty/invalid embed even before the staff member adds anything.
function buildPreviewPanelEmbed(draft) {

    const embed = isDraftEmpty(draft)
        ? new EmbedBuilder()
            .setColor(PLACEHOLDER_COLOR)
            .setTitle("🧱 Embed Builder")
            .setDescription("*Nothing here yet — use the menu below to start building your embed.*")
        : buildDraftEmbed(draft);

    embed.addFields({
        name: "───────────────",
        value: buildCharCounterText(draft),
        inline: false
    });

    return embed;

}


module.exports = {

    isDraftEmpty,
    buildDraftEmbed,
    buildCharCounterText,
    buildPreviewPanelEmbed

};
