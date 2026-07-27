const LIMITS = {

    TITLE: 256,
    DESCRIPTION: 4096,
    FIELD_NAME: 256,
    FIELD_VALUE: 1024,
    FOOTER_TEXT: 2048,
    AUTHOR_NAME: 256,
    MAX_FIELDS: 25,
    TOTAL: 6000

};


function totalCharacters(draft) {

    let total = 0;

    total += (draft.title || "").length;
    total += (draft.description || "").length;
    total += (draft.footer.text || "").length;
    total += (draft.author.name || "").length;

    for (const field of draft.fields) {
        total += (field.name || "").length;
        total += (field.value || "").length;
    }

    return total;

}


// Basic format validation — this can't confirm the URL is *reachable*,
// but it catches the common mistakes (typos, non-http links, plain text).
function isValidUrl(url) {

    if (!url) return true; // empty/optional is fine

    try {

        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";

    } catch (err) {

        return false;

    }

}


function isValidHexColor(color) {

    if (!color) return true;

    return /^#?[0-9A-Fa-f]{6}$/.test(color);

}


// Returns { valid, errors[] }. Errors are written to be shown to the user
// directly — friendly, specific, and actionable.
function validateDraft(draft) {

    const errors = [];

    const isEmpty =
        !draft.title &&
        !draft.description &&
        !draft.fields.length &&
        !draft.image &&
        !draft.thumbnail &&
        !draft.author.name;

    if (isEmpty) {
        errors.push("This embed is completely empty — add a title, description, field, author, or image first.");
        return { valid: false, errors };
    }

    if (draft.title && draft.title.length > LIMITS.TITLE) {
        errors.push(`Title is too long (${draft.title.length}/${LIMITS.TITLE} characters).`);
    }

    if (draft.description && draft.description.length > LIMITS.DESCRIPTION) {
        errors.push(`Description is too long (${draft.description.length}/${LIMITS.DESCRIPTION} characters).`);
    }

    if (draft.author.name && draft.author.name.length > LIMITS.AUTHOR_NAME) {
        errors.push(`Author name is too long (${draft.author.name.length}/${LIMITS.AUTHOR_NAME} characters).`);
    }

    if (draft.footer.text && draft.footer.text.length > LIMITS.FOOTER_TEXT) {
        errors.push(`Footer text is too long (${draft.footer.text.length}/${LIMITS.FOOTER_TEXT} characters).`);
    }

    if (draft.fields.length > LIMITS.MAX_FIELDS) {
        errors.push(`Too many fields (${draft.fields.length}/${LIMITS.MAX_FIELDS} max).`);
    }

    draft.fields.forEach((field, i) => {

        if (!field.name || !field.value) {
            errors.push(`Field ${i + 1} is missing a name or value.`);
            return;
        }

        if (field.name.length > LIMITS.FIELD_NAME) {
            errors.push(`Field ${i + 1} name is too long (${field.name.length}/${LIMITS.FIELD_NAME}).`);
        }

        if (field.value.length > LIMITS.FIELD_VALUE) {
            errors.push(`Field ${i + 1} value is too long (${field.value.length}/${LIMITS.FIELD_VALUE}).`);
        }

    });

    if (!isValidUrl(draft.thumbnail)) errors.push("Thumbnail URL doesn't look valid — it must start with http:// or https://.");
    if (!isValidUrl(draft.image)) errors.push("Image URL doesn't look valid — it must start with http:// or https://.");
    if (!isValidUrl(draft.author.iconURL)) errors.push("Author icon URL doesn't look valid.");
    if (!isValidUrl(draft.author.url)) errors.push("Author link URL doesn't look valid.");
    if (!isValidUrl(draft.footer.iconURL)) errors.push("Footer icon URL doesn't look valid.");

    if (!isValidHexColor(draft.color)) errors.push("Color must be a valid hex code, e.g. #5865F2.");

    const total = totalCharacters(draft);

    if (total > LIMITS.TOTAL) {
        errors.push(`This embed is too large overall (${total}/${LIMITS.TOTAL} total characters across all text).`);
    }

    return { valid: errors.length === 0, errors };

}


module.exports = {

    LIMITS,
    totalCharacters,
    isValidUrl,
    isValidHexColor,
    validateDraft

};
