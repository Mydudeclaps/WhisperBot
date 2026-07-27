// Casino NPC dealers. `games` maps an NPC to the game(s) they show up for
// (matches the `game` key passed to casinoStatsService.recordBet /
// casinoNpcService.getNpcForGame). Dialogue lines are picked at random by
// casinoNpcService and attached to result embeds — purely presentational,
// never touches bet/payout logic.
module.exports = {

    frank: {
        name: "Frank \"The Banker\" Moretti",
        title: "Casino Owner & Card Dealer",
        emoji: "🕴️",
        games: ["blackjack", "poker", "tic"],
        rankLines: {
            visitor: "A new face. Let's see what you're made of.",
            regular: "I remember you. You're getting better.",
            vip: "Ah, a VIP. The best tables are this way.",
            high_roller: "Welcome, High Roller. The house is honored.",
            legend: "The Legend returns. Everyone, clear the table.",
        },
        catchphrases: [
            "Feeling lucky today?",
            "Not bad... I didn't think you'd beat the house.",
            "The house always wins... eventually.",
            "I've seen fortunes won and lost at this table.",
            "You've got guts. I respect that.",
            "That's the thing about luck... it runs out.",
            "Play your cards right, and you might just walk away."
        ],
        winPhrases: [
            "Well played. I'll get you next time.",
            "You beat me fair and square.",
            "I didn't see that coming."
        ],
        losePhrases: [
            "Sorry kid, that's how it goes.",
            "Better luck next time.",
            "The house always wins."
        ],
        // Progressive 3-Card Poker stage dialogue (commands/casino/poker.js).
        // Separate from catchphrases/winPhrases/losePhrases above, which
        // are still used as-is by blackjack.
        pokerLines: {
            ante: [
                "Place your ante. Let's see what you're made of.",
                "Ante up, whenever you're ready."
            ],
            firstCard: [
                "Interesting start...",
                "Off to a good start!",
                "Let's see where this goes."
            ],
            secondCard: [
                "The board is starting to take shape...",
                "Now it gets interesting."
            ],
            thirdCard: [
                "One more card decides everything...",
                "This is where hands are won and lost."
            ],
            fold: [
                "Wise choice. The house collects.",
                "Smart fold.",
                "Sometimes the best move is knowing when to walk away."
            ],
            win: [
                "Well played! I didn't see that coming.",
                "You beat me fair and square.",
                "Can't argue with that hand."
            ],
            loss: [
                "The house wins this hand.",
                "Better luck next time.",
                "My hand held up this time."
            ],
            push: [
                "Push. We'll call it even.",
                "A tie — nobody loses this round."
            ],
            bigWin: [
                "Incredible! That's a hand I won't forget!",
                "Now THAT'S a hand for the history books."
            ]
        }
    },

    luca: {
        name: "Luca \"The Bookmaker\" Russo",
        title: "Horse Racing Commissioner",
        emoji: "🐎",
        games: ["horse"],
        rankLines: {
            visitor: "First time at the track? Take it slow.",
            regular: "You again. Got a good feeling this time?",
            vip: "The good seats are open for you.",
            high_roller: "High Roller at my track — an honor.",
            legend: "Everyone knows your name at the derby now.",
        },
        catchphrases: [
            "The horses are lining up.",
            "I've been doing this for 40 years.",
            "Never bet on a horse named after a storm.",
            "The odds tell the story.",
            "I knew that horse was special."
        ],
        winPhrases: [
            "That horse was made for this track!",
            "You've got a good eye for talent.",
            "I knew you'd pick the winner."
        ],
        losePhrases: [
            "That's horse racing for you.",
            "Better luck at the next race.",
            "The favorite doesn't always win."
        ]
    },

    old_tom: {
        name: "Old Tom",
        title: "Dice Master",
        emoji: "🎲",
        games: ["dice", "highlow"],
        rankLines: {
            visitor: "Fresh meat at the dice table.",
            regular: "Back for more punishment, eh?",
            vip: "A VIP roller. I'll get the good dice.",
            high_roller: "High Roller. The dice remember you.",
            legend: "Legend status. Even I'm nervous now.",
        },
        catchphrases: [
            "I've never lost a dice game...",
            "The dice don't lie.",
            "You can't beat the dice.",
            "I've been rolling dice since before you were born."
        ],
        winPhrases: [
            "You got lucky this time.",
            "The dice favored you today.",
            "Not bad, kid."
        ],
        losePhrases: [
            "Told you so.",
            "The dice always win.",
            "Better luck next roll."
        ]
    },

    silas: {
        name: "Silas \"The Mechanic\" Vance",
        title: "Slot Machine Technician",
        emoji: "🔧",
        games: ["slots"],
        rankLines: {
            visitor: "New to the machines? I'll show you around.",
            regular: "You're becoming a regular around here.",
            vip: "VIP status — I'll tune the good machine for you.",
            high_roller: "High Roller! Only the best reels for you.",
            legend: "Legend. These machines practically bow to you.",
        },
        catchphrases: [
            "These machines are my babies.",
            "I know exactly when this one's going to hit.",
            "That one's due for a payout.",
            "Don't tell anyone I told you... but this one's hot."
        ],
        winPhrases: [
            "That machine's been good to you!",
            "I knew it was ready to pop!",
            "Jackpot! I mean... congratulations!"
        ],
        losePhrases: [
            "That's how it goes sometimes.",
            "The machine's just warming up.",
            "Try again, it's due."
        ]
    },

    lucy: {
        name: "Lucy",
        title: "Casino Hostess",
        emoji: "👩‍🍳",
        games: ["roulette", "memory"],
        rankLines: {
            visitor: "First spin? Welcome to the wheel.",
            regular: "Back again! The wheel missed you.",
            vip: "VIP at my table — let me get you settled.",
            high_roller: "High Roller! The wheel is yours tonight.",
            legend: "A Legend at the wheel. This is history.",
        },
        catchphrases: [
            "Welcome to the casino!",
            "I've got a good feeling about this spin.",
            "Let me get you a drink while you play.",
            "The wheel favors the bold.",
            "I've seen this wheel change lives."
        ],
        winPhrases: [
            "The wheel loves you tonight!",
            "I knew you'd win!",
            "That was beautiful to watch."
        ],
        losePhrases: [
            "The wheel is cruel sometimes.",
            "Better luck next spin.",
            "Don't give up yet!"
        ],
        // Memory Vault stage dialogue (commands/casino/memory.js).
        // Separate from catchphrases/winPhrases/losePhrases above, which
        // are still used as-is by roulette.
        memoryLines: {
            match: [
                "The vault remembers your skill...",
                "Nicely spotted.",
                "You've got a sharp eye."
            ],
            matchStreak: [
                "Two in a row... the vault is impressed.",
                "You're on a roll now!"
            ],
            noMatch: [
                "The vault shifts... try again.",
                "Not quite. Look closer next time.",
                "The vault keeps its secrets a little longer."
            ],
            noMatchStreak: [
                "Even the vault has its secrets.",
                "The vault is being stubborn today."
            ],
            win: [
                "The vault opens. The treasure is yours.",
                "A well-earned unlock."
            ],
            loss: [
                "The vault seals shut... better luck next time.",
                "So close. The vault wasn't ready to open."
            ],
            perfect: [
                "A perfect memory. The vault has never seen such skill.",
                "Flawless. I'll remember this one."
            ]
        }
    }

};
