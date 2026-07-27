const fs = require("fs");
const path = require("path");


const logFolder = path.join(
    __dirname,
    "../logs"
);


// Create logs folder if missing
if (!fs.existsSync(logFolder)) {

    fs.mkdirSync(logFolder);

}



function writeLog(type, message) {


    const time = new Date()
        .toLocaleString();


    const logMessage =
        `[${time}] [${type}] ${message}\n`;


    console.log(logMessage);


    fs.appendFileSync(

        path.join(
            logFolder,
            "whisperbot.log"
        ),

        logMessage

    );

}



function info(message) {

    writeLog(
        "INFO",
        message
    );

}



function error(message) {

    writeLog(
        "ERROR",
        message
    );

}



function command(message) {

    writeLog(
        "COMMAND",
        message
    );

}



module.exports = {

    info,

    error,

    command

};