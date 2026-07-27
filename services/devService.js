const {
    DEVELOPERS,
    ENABLE_DEV_COMMANDS
} = require("../config/devConfig");


function isDeveloper(userId) {


    if (!ENABLE_DEV_COMMANDS)
        return false;


    return DEVELOPERS.includes(userId);

}


module.exports = {

    isDeveloper

};