const db = require("./database");


try {


    db.prepare(`
        ALTER TABLE users
        ADD COLUMN kingdom TEXT DEFAULT 'None'
    `)
    .run();


    console.log("✅ Added kingdom column");


} catch(e) {

    console.log("Kingdom column already exists");

}



try {


    db.prepare(`
        ALTER TABLE users
        ADD COLUMN kingdom_rep INTEGER DEFAULT 0
    `)
    .run();


    console.log("✅ Added kingdom reputation column");


} catch(e) {

    console.log("Kingdom reputation column already exists");

}