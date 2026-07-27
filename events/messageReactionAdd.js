const {
    incrementStat
} = require("../services/statsService");


const {
    updateMissionProgress
} = require("../services/dailyProgressService");


const {
    updateQuestProgress
} = require("../services/questProgressService");



module.exports = {

    name: "messageReactionAdd",


    async execute(reaction, user) {


        if (user.bot)
            return;



        // Handle partial reactions
        if (reaction.partial) {

            try {

                await reaction.fetch();

            } catch (error) {

                console.error(
                    "Reaction fetch failed:",
                    error
                );

                return;

            }

        }



        const reactorId = user.id;

        const receiverId =
        reaction.message.author.id;



        // ==========================
        // REACTIONS GIVEN
        // ==========================

        incrementStat(

            reactorId,

            "reactions_given"

        );


        await updateMissionProgress(

            reactorId,

            "reactions_given",

            1,

            reaction.message.channel

        );



        // ==========================
        // REACTIONS RECEIVED
        // ==========================

        incrementStat(

            receiverId,

            "reactions_received"

        );


        await updateMissionProgress(

            receiverId,

            "reactions_received",

            1,

            reaction.message.channel

        );



        console.log(

            "REACTION TRACKED:",

            user.username,

            "reacted to",

            reaction.message.author.username

        );



        // ==========================
        // QUEST SYSTEM
        // ==========================

        // NOTE: this was previously tracked under the generic id "REACTIONS",
        // but it was always the reactor's progress that got updated — so the
        // id is renamed to REACTIONS_GIVEN to match reality, and a proper
        // REACTIONS_RECEIVED update is added for the message author below.

        const result =
        updateQuestProgress(

            reactorId,

            "REACTIONS_GIVEN"

        );

        updateQuestProgress(

            receiverId,

            "REACTIONS_RECEIVED"

        );



        if (!result)
            return;



        if (result.completed) {


            const {
                giveQuestRewards
            } = require("../services/questRewardService");



            const rewards =
            giveQuestRewards(

                reactorId,

                result.quest

            );



            await reaction.message.channel.send(

                `🏆 **Quest Complete!**\n\n` +

                `${result.quest.name}\n\n` +

                `🎁 Rewards:\n` +

                `✨ +${rewards.xp} XP\n` +

                `💰 +${rewards.coins} Coins\n` +

                `🏰 +${rewards.reputation} Reputation`

            );

        }


    }

};