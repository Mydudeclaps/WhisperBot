const path = require("path");


// Loads social-engine/data/commands/<name>.json for a given command name.
// This is the ONLY thing a new social command needs to supply — drop a
// JSON file here following the same shape as hug.json and a command file
// that requires it via this loader is fully wired into the engine.
function loadCommandData(commandName) {

    const filePath = path.join(__dirname, "..", "data", "commands", `${commandName}.json`);

    try {

        // require() is fine here (not fs.readFile) — it's cached after
        // the first load, and these files only change at deploy time.
        return require(filePath);

    } catch (err) {

        throw new Error(
            `Social Engine: no content file found for "${commandName}" ` +
            `(expected social-engine/data/commands/${commandName}.json)`
        );

    }

}


module.exports = { loadCommandData };
