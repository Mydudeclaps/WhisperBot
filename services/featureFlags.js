// Generic feature flag system for instantly enabling/disabling beta
// features. config/features.json is deliberately plain JSON (not a .js
// config file like everything else in config/) so it can be hand-edited
// to instantly toggle a feature without touching code or restarting the
// bot — every check here reads the file fresh rather than caching it at
// require-time, specifically so an admin's edit takes effect on the very
// next command use, not just after a restart.
const fs = require("fs");
const path = require("path");

const FEATURES_PATH = path.join(__dirname, "..", "config", "features.json");

function loadFlags() {

    try {

        const raw = fs.readFileSync(FEATURES_PATH, "utf-8");
        return JSON.parse(raw);

    } catch (err) {

        // Missing/corrupt file should never crash a command that checks
        // a flag — fail closed (treat every flag as disabled) rather
        // than fail open, since "beta feature accidentally stays live"
        // is a worse failure mode than "beta feature accidentally looks
        // disabled."
        console.error("featureFlags: failed to read config/features.json, defaulting all flags to disabled:", err.message);
        return {};

    }

}

function isFeatureEnabled(flagName) {

    const flags = loadFlags();
    return flags[flagName] === true;

}

function getFlag(flagName) {

    const flags = loadFlags();
    return flags[flagName];

}

module.exports = { isFeatureEnabled, getFlag };
