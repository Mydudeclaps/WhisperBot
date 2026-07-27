const fs = require("fs");
const path = require("path");

function loadCommands(client) {

    client.commands = new Map();

    const commandFolders = fs.readdirSync("./commands");

    for (const folder of commandFolders) {

        const folderPath = path.join("./commands", folder);

        if (!fs.statSync(folderPath).isDirectory()) continue;


        const commandFiles = fs.readdirSync(folderPath)
            .filter(file => file.endsWith(".js"));


        for (const file of commandFiles) {

            const command = require(`../commands/${folder}/${file}`);
            
            client.commands.set(
                command.data.name,
                command
            );

            console.log(
                `Loaded command: ${command.data.name}`
            );

        }

    }

}

module.exports = { loadCommands };