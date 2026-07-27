const db = require("../database/database");

const {
    getQuest
} = require("./questService");


// `channelId` is only used by CHANNELS-type quests (e.g. "send messages in
// 5 different channels"), where progress means "number of distinct channels
// posted in", not "number of messages". For every other quest type it's
// ignored and progress increments by `amount` as before.
function updateQuestProgress(
    userId,
    questType,
    amount = 1,
    channelId = null
) {


    const activeQuests = db.prepare(`

        SELECT *

        FROM user_quests

        WHERE user_id = ?

        AND completed = 0

    `).all(userId);


    let result = null;

    for (const userQuest of activeQuests) {


        const quest =
        getQuest(userQuest.quest_id);



        if (!quest)
            continue;



        if (quest.type !== questType)
            continue;


        let newProgress;
        let channelsMeta = userQuest.channels_meta;

        if (questType === "CHANNELS") {

            // Track progress as the count of distinct channels seen, not
            // raw message count, so posting repeatedly in one channel
            // doesn't complete the quest.
            let seenChannels = [];

            try {

                seenChannels = channelsMeta
                    ? JSON.parse(channelsMeta)
                    : [];

                if (!Array.isArray(seenChannels))
                    seenChannels = [];

            } catch (e) {

                seenChannels = [];

            }

            if (!channelId || seenChannels.includes(channelId)) {

                // Already counted this channel (or no channel context
                // available) — nothing changes for this quest.
                continue;

            }

            seenChannels.push(channelId);

            channelsMeta = JSON.stringify(seenChannels);

            newProgress = seenChannels.length;

        } else {

            newProgress =
            userQuest.progress + amount;

        }



        if (newProgress > quest.goal)

            newProgress = quest.goal;



        const completed =
        newProgress >= quest.goal;



        db.prepare(`

            UPDATE user_quests

            SET

            progress = ?,

            completed = ?,

            completed_at = ?,

            channels_meta = ?

            WHERE id = ?

        `).run(

            newProgress,

            completed ? 1 : 0,

            completed
                ? new Date().toISOString()
                : null,

            channelsMeta,

            userQuest.id

        );


        result = {

            quest,

            completed,

            progress: newProgress

        };

    }


    return result;

}



module.exports = {

    updateQuestProgress

};
