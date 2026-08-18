const fs = require("fs");

function loadDiscordToken() {
    const directToken = process.env.DISCORD_TOKEN?.trim();
    if (directToken) return directToken;

    const tokenFile = process.env.DISCORD_TOKEN_FILE;
    if (!tokenFile) return null;

    const stat = fs.lstatSync(tokenFile);
    if (!stat.isFile()) {
        throw new Error("DISCORD_TOKEN_FILE must reference a regular file");
    }

    const values = fs.readFileSync(tokenFile, "utf8")
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean);

    if (values.length !== 1) {
        throw new Error("DISCORD_TOKEN_FILE must contain exactly one non-empty line");
    }

    return values[0];
}

module.exports = {
    loadDiscordToken
};
