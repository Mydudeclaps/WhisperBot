const {
    processMessage
} = require("../services/events/messagePipeline");

const {
    unlockAchievement,
    hasAchievement,
    giveAchievementRewards,
    checkLevelAchievements
} = require("../services/achievementService");

const {
    achievementEmbed,
    levelUpEmbed
} = require("../utils/embedFactory");

const {
    getUser
} = require("../services/userService");

const {
    giveLevelReward
} = require("../services/rewardService");

const {
    addXP
} = require("../services/xpService");

// ─── Numerology ──────────────────────────────────────────────────────
// All the actual game logic/orchestration lives in
// utils/numerologyMessageHandler.js — this file only needs to know
// which channel to route to it.
const { CHANNEL_ID: NUMEROLOGY_CHANNEL_ID } = require("../config/numerologyConfig");
const { handleNumerologyMessage } = require("../utils/numerologyMessageHandler");


const cooldowns = new Map();


module.exports = {


    name: "messageCreate",



    async execute(message) {


        // Ignore bots, webhooks, and system messages (pins, boosts, etc.)
        // so none of them count toward stats, missions, or quests.
        if (
            message.author.bot ||
            message.webhookId ||
            message.system
        )
            return;

        // Numerology channel — handled entirely separately from every
        // other message-driven system. A counting channel shouldn't
        // also grant quest/chat-XP credit (that would be a strange
        // double-purpose for one message, and would keep granting XP
        // even on messages that get deleted a moment later for being an
        // incorrect count), so this returns immediately rather than
        // falling through to the quest pipeline / XP logic below.
        if (message.channel.id === NUMEROLOGY_CHANNEL_ID) {

            try {
                await handleNumerologyMessage(message);
            } catch (err) {
                console.error("Numerology message handler error:", err);
            }

            return;

        }

        // Run the message pipeline
        await processMessage(message);

        const userId = message.author.id;



        // XP cooldown
        const now = Date.now();


        const cooldown = cooldowns.get(userId);



        if (
            cooldown &&
            now - cooldown < 60000
        ) {

            return;

        }



        cooldowns.set(
            userId,
            now
        );



        const result = addXP(

            userId,

            5

        );



        if (!result)
            return;



        // Level up message

        if (result.leveledUp) {


            const reward = giveLevelReward(

                userId,

                result.newLevel

            );


            await message.channel.send({

                embeds: [

                    levelUpEmbed(

                        message.author.username,

                        result.newLevel,

                        reward

                    )

                ]

            });


        }

        const user = getUser(userId, message.author.username);

        const achievements = checkLevelAchievements(user);

        for (const achievementId of achievements) {

            if (!hasAchievement(userId, achievementId)) {

                unlockAchievement(userId, achievementId);

                const achievement =
                    giveAchievementRewards(
                        userId,
                        achievementId
                    );

                await message.channel.send({

                    embeds: [

                        achievementEmbed(
                            achievement
                        )

                    ]

                });

            }

        }


    }

};