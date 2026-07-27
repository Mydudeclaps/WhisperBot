// The full horse roster for /horse. Each race draws HORSE.RACE_SIZE of
// these at random. `odds` is the payout multiplier if that horse wins —
// lower odds = stronger favorite (races more often), higher odds = long
// shot (rarer win, bigger payout). See services/horseService.js for how
// odds translate into actual win probability.
module.exports = [
    { id: "shadowfang",     name: "Shadowfang",      odds: 3.2 },
    { id: "golden_spirit",  name: "Golden Spirit",   odds: 2.1 },
    { id: "blood_runner",   name: "Blood Runner",    odds: 5.5 },
    { id: "storm_hoof",     name: "Storm Hoof",      odds: 7.0 },
    { id: "moon_dancer",    name: "Moon Dancer",     odds: 4.4 },
    { id: "whisper_wind",   name: "Whisper Wind",    odds: 6.0 },
    { id: "kingdoms_pride", name: "Kingdom's Pride", odds: 3.8 },
    { id: "lucky_strike",   name: "Lucky Strike",    odds: 8.5 },
    { id: "night_terror",   name: "Night Terror",    odds: 9.0 },
    { id: "dawn_breaker",   name: "Dawn Breaker",    odds: 4.9 }
];
