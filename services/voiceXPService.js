const config = require("../config/gameConfig");

const {
    addXP
} = require("./xpService");


function canReceiveVoiceXP(member) {


    if (!member)
        return false;


    if (member.voice.serverMute)
        return false;


    if (member.voice.serverDeaf)
        return false;


    if (member.voice.selfMute)
        return false;


    if (member.voice.selfDeaf)
        return false;


    if (
        config.VOICE.REQUIRE_OTHERS &&
        member.voice.channel.members.size < 2
    ) {

        return false;

    }


    return true;

}



function giveVoiceXP(member) {


    if (!canReceiveVoiceXP(member))
        return null;


    return addXP(

        member.id,

        config.VOICE.XP

    );


}



module.exports = {

    giveVoiceXP,

    canReceiveVoiceXP

};