// One active /embedbuilder session per user, held in memory only.
// Sessions are lost on bot restart by design — the *templates* the user
// saves along the way are what persist (see templateService.js).
const sessions = new Map();


function defaultDraft() {

    return {

        title: null,
        description: null,
        color: null,
        timestamp: false,

        author: { name: null, iconURL: null, url: null },

        thumbnail: null,
        image: null,

        footer: { text: null, iconURL: null },

        fields: []

    };

}


function createSession(userId, guildId) {

    const session = {

        userId,
        guildId,
        draft: defaultDraft(),
        selectedFieldIndex: null

    };

    sessions.set(userId, session);

    return session;

}


function getSession(userId) {

    return sessions.get(userId) || null;

}


function endSession(userId) {

    sessions.delete(userId);

}


module.exports = {

    defaultDraft,
    createSession,
    getSession,
    endSession

};
