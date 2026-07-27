require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

// --- Context menu command limit -------------------------------------
// Discord caps USER-type context menu commands (right-click -> Apps ->
// ...) at 15 per guild/app — see
// https://docs.discord.com/developers/interactions/application-commands#user-commands
// This project defines 21 context commands in commands/context/ (all 21
// are fully built and work correctly), which is more than fit. Pushing
// all 21 in one bulk overwrite would make Discord reject the ENTIRE
// request — including your regular slash commands in the same payload —
// not just silently drop the extras past #15.
//
// Edit CONTEXT_COMMAND_ALLOWLIST below to control exactly which 15 (or
// fewer) actually get registered. Anything left out is NOT lost — it
// still works perfectly as its original slash command (e.g. /hug), it
// just won't additionally show up in the right-click menu.
//
// Current default (edit freely): all 11 "Priority 1" commands + all 3
// "Priority 3" commands (Ship With / Rate Rizz / Check Aura, distinct
// enough from the physical-action set to be worth keeping) + 1 pick from
// "Priority 2" to round out to 15. This is an arbitrary starting point,
// not a judgment call about which commands matter most to your server —
// swap freely.
// User-confirmed final selection (15/15 — at Discord's exact limit):
// Hug, Slap, Bonk, Highfive, Boop, Poke, Kiss, Handshake, Fish Slap, Pie,
// Ship With, Rate Rizz, Cheer, Applaud, Compliment.
// Excluded, kept in commands/context/ for future use if the selection
// changes later: Punch, Throw Potato, Throw Snowball, Fight, Bestie,
// Check Aura. All 6 still work fine as their original slash commands
// (/punch, /throwpotato, etc.) — only the right-click convenience is
// unavailable while excluded here.
const CONTEXT_COMMAND_ALLOWLIST = [
    "hug", "slap", "bonk", "highfive", "boop", "poke",
    "kiss", "handshake", "fishslap", "pie",
    "shipwith", "raterizz",
    "cheer", "applaud", "compliment"
];

const commands = [];

const commandFolders = fs.readdirSync("./commands");

for (const folder of commandFolders) {

    const folderPath = path.join("./commands", folder);

    if (!fs.statSync(folderPath).isDirectory())
        continue;

    const commandFiles = fs.readdirSync(folderPath)
        .filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {

        const filePath = path.join(folderPath, file);

        // Context menu commands are filtered against the allowlist above
        // — every other folder (casino, social, economy, etc.) deploys
        // exactly as it always has, unaffected by this limit.
        if (folder === "context") {

            const commandName = path.basename(file, ".js");

            if (!CONTEXT_COMMAND_ALLOWLIST.includes(commandName)) {

                // A few context files are named for clarity (checkaura.js,
                // raterizz.js, shipwith.js) rather than matching their
                // underlying slash command's actual name (aura, rizz, ship)
                // — map those three explicitly so this hint is accurate.
                const slashNameOverrides = { checkaura: "aura", raterizz: "rizz", shipwith: "ship" };
                const slashName = slashNameOverrides[commandName] || commandName;

                console.log(`⏭️  Skipping (not in CONTEXT_COMMAND_ALLOWLIST, still works as /${slashName}):`, filePath);
                continue;

            }

        }

        console.log("Loading:", filePath);

        const command = require(path.resolve(filePath));

        if (!command.data) {

            console.log("❌ Missing data:", filePath);

            continue;

        }

        commands.push(command.data.toJSON());

        console.log(
            `Found command: ${command.data.name}`
        );

    }

}

const contextCommandCount = commands.filter(c => c.type === 2).length;

console.log("CLIENT ID:", process.env.CLIENT_ID);
console.log("GUILD ID:", process.env.GUILD_ID);
console.log("COMMAND COUNT:", commands.length);
console.log(`USER (context menu) COMMAND COUNT: ${contextCommandCount} / 15 max`);

if (contextCommandCount > 15) {

    console.error(
        `❌ ${contextCommandCount} USER commands exceeds Discord's 15-per-guild limit — ` +
        `the deploy below will fail. Trim CONTEXT_COMMAND_ALLOWLIST at the top of this file.`
    );

    process.exit(1);

}

const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {

    try {

        console.log("Refreshing slash commands...");

        await rest.put(

            Routes.applicationGuildCommands(

                process.env.CLIENT_ID,
                process.env.GUILD_ID

            ),

            {

                body: commands

            }

        );

        console.log("✅ Slash commands registered!");

    } catch (error) {

        console.error(error);

    }

}

deployCommands();