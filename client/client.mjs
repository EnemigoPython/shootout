import {shake} from './anims.mjs';
import {pickScreen, waitScreen, waitingRoom, tickTimer, guessListener} from './game.mjs';
import {playerArray, addPlayerName, chatMessage, chatListener, enableSettings, newSetting, updateScore} from './room.mjs';
import {ajax, loadContent, loadGame, adjustHack} from './utils.mjs';

export const socket = io();
export let username;
export let settings = {};

async function main() {
    const app = document.getElementById("app");
    app.innerHTML = await ajax('/menu');

    const userText = document.getElementById('userText');
    const createBtn = document.getElementById('createBtn');

    // check local storage for username
    if (localStorage.getItem('username')) {
        userText.value = localStorage.getItem('username');
    }

    createBtn.addEventListener('click', (e) => {
        if (userText.value) {
            username = userText.value;
            localStorage.setItem('username', username);
            socket.emit('create', username);
        } else {
            shake(userText);
        }
    });

    const codeText = document.getElementById('codeText');
    const joinBtn = document.getElementById('joinBtn');
    const subtext = document.getElementById('subtext');

    // if url pathname contains code, fill in codeText
    const urlPath = window.location.pathname;
    if (urlPath.match(/^\/[A-Za-z]{4}$/)) {
        codeText.value = urlPath.replace('/', '').toUpperCase();
    }

    joinBtn.addEventListener('click', (e) => {
        if (userText.value) {
            const code = codeText.value;
            if (code && code.length === 4) {
                username = userText.value;
                socket.emit('join', {'username': username, 'code': code});
            } else {
                shake(codeText);
            }
        } else {
            shake(userText);
        }
    });

    socket.on('welcome', (playerCount) => {
        subtext.innerText = `${playerCount} player${playerCount > 1 ? 's' : ''} online`;
    });

    socket.on('created', ({code, gameSettings, title}) => {
        // update URL with code
        window.history.replaceState(null, '', `/${code}`);
        settings = gameSettings;

        loadContent('/lobby').then(() => {
            adjustHack();
            document.getElementById('roomTitle').innerText = title;
            document.getElementById('code').innerText = code;
            addPlayerName(username);
            chatListener();
            chatMessage({'user': username, 'content': 'create'}, true);
            loadGame('/settings').then(() => {
                enableSettings();
            });
        });
    });

    socket.on('joined', ({code, players, round, gameSettings, title}) => {
        // update URL with code
        window.history.replaceState(null, '', `/${code}`);
        settings = gameSettings;

        loadContent('/lobby').then(() => {
            adjustHack();
            document.getElementById('roomTitle').innerText = title;
            document.getElementById('code').innerText = code;
            players.forEach(player => {
                addPlayerName(player);
            });
            chatListener();
            chatMessage({'user': username, 'content': 'join'}, true);
            if (round > 0) {
                loadGame('/game').then(() => {
                    document.getElementById('lobbyRound').innerText = `Round ${round}/${settings.rounds}`;
                    waitingRoom();
                });
            } else {
                loadGame('/settings').then(() => {
                    for (const setting in gameSettings) {
                        newSetting(setting, settings[setting]);
                    }
                });
            }
        });
    });

    socket.on('joinFailed', (error) => {
        subtext.style.color = 'red';
        switch (error) {
            case 'notFound':
                subtext.innerText = 'Room not found.';
                break;
            case 'roomFull':
                subtext.innerText = 'Room full.';
                break;
            case 'sameName':
                subtext.innerText = 'You have the same name as a member of the room.';
                break;
        }
    });

    socket.on('newPlayer', (player) => {
        addPlayerName(player);
        chatMessage({'user': player, 'content': 'join'}, true);
    });

    socket.on('left', (player) => {
        if (playerArray.includes(player)) {
            const i = playerArray.indexOf(player);
            const leavingPlayer = document.getElementById('playerList').children[i];
            const leaverScore = document.getElementById('playerScores').children[i];
            document.getElementById('playerList').removeChild(leavingPlayer);
            document.getElementById('playerScores').removeChild(leaverScore);
            playerArray.splice(i, 1);
            chatMessage({'user': player, 'content': 'left'}, true);
        }
    });

    socket.on('hostMigrate', () => {
        if (document.getElementById('roomTitle').innerText === 'Settings') {
            enableSettings();
        }
    });

    socket.on('migrateMessage', (player) => {
        chatMessage({'user': player, 'content': 'host'}, true);
    })

    socket.on('userMessage', ({user, content}) => {
        chatMessage({'user': user, 'content': content});
    });

    socket.on('syncSettings', ({setting, value}) => {
        settings[setting] = value;
        newSetting(setting, value);
    });

    socket.on('pick', (preset, round) => {
        document.getElementById('lobbyRound').innerText = `Round ${round}/${settings.rounds}`;
        loadGame('/game').then(() => {
            pickScreen(preset);
        });
    });

    socket.on('preturn', (player, round) => {
        document.getElementById('lobbyRound').innerText = `Round ${round}/${settings.rounds}`;
        loadGame('/game').then(() => {
            waitScreen(player);
        });
    });

    socket.on('notEnough', (player) => {
        chatMessage({'user': player, 'content': 'unable'}, true);
    });

    socket.on('startTurn', ({prompt, play, player=username}) => {
        loadGame('/game').then(() => {
            document.getElementById('submitBtn').remove();
            const gameHeader = document.getElementById('gameHeader');
            gameHeader.innerText = `${player} riddles you this...`;
            const promptEl = document.getElementById('prompt');
            promptEl.innerText = prompt;
            if (play) {
                guessText.disabled = false;
                guessListener();
            } else {
                guessText.placeholder = '';
            }
        });
    });

    socket.on('tick', (time) => {
        tickTimer(time);
    });

    socket.on('timeout', ({answers, count}) => {
        guessText.remove();
        const answerEls = document.getElementsByClassName('answers');
        for (let i = 0; i < 3; i++) {
            answerEls[i].innerText = answers[i];
        }
        switch (count) {
            case 0:
                gameHeader.innerText = 'You got none?? What went wrong? (0/3)';
                break;
            case 1:
                gameHeader.innerText = 'Surely you lot can do better than that? (1/3)';
                break;
            case 2:
                gameHeader.innerText = 'Almost, but no cigar. (2/3)';
                break;
        }
    });

    socket.on('correctGuess', ({answer, i, scores}) => {
        const answerEl = document.getElementById(`answer${i}`);
        answerEl.innerText = answer;
        for (const score in scores) {
            updateScore(score, scores[score]);
        }
    });

    socket.on('wrongGuess', ({guess, player, score}) => {
        chatMessage({'user': player, 'content': guess}, true);
        updateScore(player, score);
    });

    socket.on('completion', () => {
        guessText.remove();
        gameHeader.innerText = 'Too easy for these players! (3/3)';
    });

    socket.on('gameOver', (podium) => {
        loadGame('/podium').then(() => {
            document.getElementById('first').innerText = podium[0];
            document.getElementById('second').innerText = podium[1];
            document.getElementById('third').innerText = podium[2];
        });
    });

    socket.on('restart', (isHost) => {
        document.getElementById('lobbyRound').innerText = 'Settings';
        loadGame('/settings').then(() => {
            for (const setting in settings) {
                newSetting(setting, settings[setting]);
            }
            if (isHost) {
                enableSettings();
            }
        });
    });

}

main();