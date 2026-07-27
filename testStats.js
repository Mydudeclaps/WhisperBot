const {
    incrementStat,
    getStat
} = require("./services/statsService");

incrementStat("test-user", "messages_sent");

incrementStat("test-user", "messages_sent");

incrementStat("test-user", "messages_sent");

console.log(
    getStat("test-user", "messages_sent")
);