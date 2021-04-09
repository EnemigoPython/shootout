const fs = require('fs');


function randomIndex (length) {
    return Math.floor(Math.random() * (length));
}

async function lookUp(dir) {
    const res = fs.readdirSync(dir, (error, files) => {
        try {
            return files;
        } catch (error) {
            return null;
        }
    });
    return res;
}

async function readText(path) {
    try {
        const res = fs.readFileSync(path, 'utf-8');
        return res;
    } catch (error) {
        return null;
    }
}

async function getRandomElement(presets) {
    const path = presets === 'answer' ? '/text/answers' : '/text/prompts';
    const dir = await lookUp(__dirname + path);
    let i = randomIndex(dir.length);
    const file = await readText(`${__dirname}${path}/${dir[i]}`);
    const lines = file.split(/\r?\n/);
    i = randomIndex(lines.length);
    line = lines[i];
    return line;
}

async function getAnswers() {
    const answers = [];
    let answer;
    for (let i = 0; i < 3; i++) {
        while (!answer || answers.includes(answer)) {
            answer = await getRandomElement('answer');
        }
        answers.push(answer);
    }
    return answers;
}

async function getPrompt(names) {
    let prompt = await getRandomElement('prompt');
    if (prompt.includes('*')) {
        const i = randomIndex(names.length);
        const name = names[i];
        prompt = prompt.replace('*', name);
    }
    if (prompt.includes('^')) {
        const first = await getRandomElement('answer');
        let second;
        while (!second || first === second) {
            second = await getRandomElement('answer');
        }
        prompt = prompt.replace('^', first);
        prompt = prompt.replace('^', second);
    }
    return prompt;
}

// game constructor
module.exports = {
    GameRoom: function(name) {
        this.settings = {
            'rounds': '5',
            'timer': '30',
            'character': '30',
            'element': 'both',
            'penalty': 'on'
        };

        this.title = `${name}'s Room`
        this.public = true;
        this.round = 0;

        // get random quiz presets for each player and save it to GameRoom
        this.newRound = async (players, names) => {
            this.presets = {};
            this.round++;
            this.turn = 0;
            for (const player of players) {
                switch (this.settings.element) {
                    case 'answers':
                        this.presets[player] = await getAnswers();
                        break;
                    case 'prompts':
                        this.presets[player] = await getPrompt(names);
                        break;
                    case 'both':
                        this.presets[player] = this.round % 2 === 0 ? await getAnswers() : await getPrompt(names);
                        break;
                }
            }
        };

        // using data generated from newRound, return the player to go next and their preset
        this.nextTurn = (players) => {
            // reset amount of correct guesses
            this.correctCount = 0;
            this.currentPicker = null;
            let player;
            // iterate through players with presets until it can either find one in room or has gone through all
            while (!players.includes(player) && this.turn <= Object.keys(this.presets).length) {
                player = Object.keys(this.presets)[this.turn];
                this.turn++;
            }
            // if the loop ended in success, set the currentPicker & return the preset
            this.currentPicker = players.includes(player) ? player : null;
            return this.currentPicker ? {'player': player, 'preset': this.presets[player]} : null;
        };

        // static timer independent of events, param of ms (1 sec = 1000)
        this.staticTimer = (ms) => {
            return new Promise((resolve, reject) => {
                try {
                    setTimeout(resolve, ms);
                } catch (error) {
                    reject(error);
                }
            });
        };

        // initialise game timer -- activeTimer controls if the timer stops
        this.startGameTimer = () => {
            this.activeTimer = true;
            this.timeRemaining = parseInt(this.settings.timer) * 10;
        };

        // decrement timer
        this.tickGameTimer = async () => {
            await this.staticTimer(100);
            this.timeRemaining--;
        };

        // was the guess right? If so, return what index the answer was + if there are any answers remaining + score
        this.processGuess = (guess) => {
            const i = this.answers.indexOf(guess);
            let points;
            let remaining;
            if (this.answers.includes(guess)) {
                this.correctCount++;
                points = this.timeRemaining;
                // now that it's been guessed, "remove" it (splicing will f up the indices)
                this.answers[i] = '';
            } else {
                points = this.settings.penalty === 'on' ? -50 : 0;
            }
            remaining = this.correctCount < 3;
            return {i, remaining, points};
        };

        this.createPodium = (names, scores) => {
            // sort in descending order without mutating original array
            sortedScores = [...scores].sort((a, b) => b - a);
            const podium = [];
            for (let i = 0; i < 3; i++) {
                const j = scores.indexOf(sortedScores[i]);
                podium.push(names[j]);
            }
            return podium;
        };

    },
    genCode: function() {
        let result = '';
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let i = 0; i < 4; i++) {
            result += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return result;
    }
};