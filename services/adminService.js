const { ADMIN_ROLE_IDS } = require("../config/adminConfig");


// True if this guild member should be allowed to use admin-only WhisperBot
// tools (Administrator permission, or one of the approved admin roles).
function isBotAdmin(member) {

    if (!member) return false;

    if (member.permissions?.has("Administrator")) return true;

    if (!ADMIN_ROLE_IDS.length) return false;

    return member.roles.cache.some(role => ADMIN_ROLE_IDS.includes(role.id));

}


module.exports = {

    isBotAdmin

};
