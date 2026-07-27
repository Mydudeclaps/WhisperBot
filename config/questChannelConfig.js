const {
    getSetting,
    setSetting
} = require("../services/settingsService");


// Key used in the bot_settings table.
const SETTING_KEY = "quest_excluded_channels";

// Used only if nothing has been configured yet.
const DEFAULT_EXCLUDED_CHANNELS = [];


function normalize(entry) {

    return String(entry)
        .trim()
        .toLowerCase()
        .replace(/^#/, "");

}


// Returns the raw list of excluded channel identifiers (IDs and/or names)
// as configured via /settings or setExcludedChannels().
function getExcludedChannels() {

    const raw = getSetting(SETTING_KEY);

    if (!raw)
        return DEFAULT_EXCLUDED_CHANNELS;

    try {

        const parsed = JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed
            : DEFAULT_EXCLUDED_CHANNELS;

    } catch (e) {

        return DEFAULT_EXCLUDED_CHANNELS;

    }

}


// Overwrites the excluded channel list. Accepts channel IDs and/or channel
// names (with or without a leading '#').
function setExcludedChannels(list) {

    const clean = Array.isArray(list)
        ? list.map(entry => String(entry).trim()).filter(Boolean)
        : [];

    setSetting(
        SETTING_KEY,
        JSON.stringify(clean)
    );

    return clean;

}


function addExcludedChannel(entry) {

    const current = getExcludedChannels();

    const normalized = normalize(entry);

    if (current.some(c => normalize(c) === normalized))
        return current;

    const updated = [...current, entry];

    setExcludedChannels(updated);

    return updated;

}


function removeExcludedChannel(entry) {

    const normalized = normalize(entry);

    const updated = getExcludedChannels()
        .filter(c => normalize(c) !== normalized);

    setExcludedChannels(updated);

    return updated;

}


// Checks a discord.js Channel (or channel-like object with id/name) against
// the excluded list, matching on either channel ID or channel name.
function isChannelExcluded(channel) {

    if (!channel)
        return false;

    const excluded = getExcludedChannels();

    if (excluded.length === 0)
        return false;

    const id = channel.id;
    const name = normalize(channel.name || "");

    return excluded.some(entry => {

        const normalized = normalize(entry);

        return normalized === id || normalized === name;

    });

}


module.exports = {

    getExcludedChannels,
    setExcludedChannels,
    addExcludedChannel,
    removeExcludedChannel,
    isChannelExcluded

};
