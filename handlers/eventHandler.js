const fs = require("fs");

function loadEvents(client) {

    const eventFiles = fs.readdirSync("./events")
        .filter(file => file.endsWith(".js"));


    for (const file of eventFiles) {

        const event = require(`../events/${file}`);


        client.on(
            event.name,
            (...args) => event.execute(...args)
        );


        console.log(`Loaded event: ${event.name}`);

    }

}


module.exports = { loadEvents };