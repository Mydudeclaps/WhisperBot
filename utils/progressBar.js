function createProgressBar(current, max, length = 10) {

    const percent = Math.min(current / max, 1);

    const filled = Math.round(percent * length);

    return (
        "█".repeat(filled) +
        "░".repeat(length - filled)
    );

}

module.exports = {
    createProgressBar
};