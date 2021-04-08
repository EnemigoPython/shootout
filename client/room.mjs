import {socket, username} from './client.mjs'

export const playerArray = [];

export function addPlayerName(player) {
    playerArray.push(player);
    const playerEl = document.createElement('li');
    const playerText = document.createTextNode(player);
    playerEl.appendChild(playerText);
    document.getElementById('playerList').appendChild(playerEl);
    const scoreEl = document.createElement('li');
    const scoreText = document.createTextNode('0');
    scoreEl.appendChild(scoreText);
    document.getElementById('playerScores').appendChild(scoreEl);
}

export function chatMessage(msg, server=false) {
    const message = document.createElement('li');
    const chatText = document.getElementById('chatText');
    const scrollChat = document.getElementById('scrollChat');
    let messageText;
    if (server) {
        message.style.fontStyle = 'italic';
        switch (msg.content) {
            case 'create':
                messageText = document.createTextNode(`${msg.user} created the game.`);
                break;
            case 'join':
                messageText = document.createTextNode(`${msg.user} joined the game.`);
                break;
            case 'left':
                messageText = document.createTextNode(`${msg.user} left the game.`);
                break;
            case 'host':
                messageText = document.createTextNode(`${msg.user} is the new host.`);
                break;
            case 'unable':
                messageText = document.createTextNode("Can't start the game with fewer than 3 players.");
                break;
            default:
                messageText = document.createTextNode(`${msg.user} guessed ${msg.content}.`);
                break;
        }
    } else {
        messageText = document.createTextNode(`${msg.user}: ${msg.content}`);
    }
    message.appendChild(messageText);
    chatText.appendChild(message);
    // autoscroll
    scrollChat.scrollTop = scrollChat.scrollHeight;
}

export function chatListener() {
    const chatInput = document.getElementById('chatInput');
    const chatBtn = document.getElementById('chatBtn')
    chatBtn.addEventListener('click', (e) => {
        if (chatInput.value) {
            const content = chatInput.value;
            socket.emit('userMessage', {'user': username, 'content': content});
            chatInput.value = '';
        }
    });
    
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            chatBtn.click();
        }
    });
}

// only the host should have access to the lobby settings
export function enableSettings() {
    const settings = document.querySelectorAll("input[disabled]");
    [...settings].forEach(setting => {
        setting.disabled = false;
        setting.addEventListener('input', (e) => {
            socket.emit('settingChanged', {'setting': setting.name, 'value': setting.value});
        });
    });
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = false;
    startBtn.addEventListener('click', (e) => {
        socket.emit('startGame');
    });
}

export function newSetting(setting, value) {
    switch (setting) {
        case 'rounds':
        case 'timer':
        case 'character':
            document.getElementById(setting).value = document.getElementById(`${setting}Value`).value = value;
            break;
        default:
            document.querySelector(`[name="${setting}"][id="${value}"]`).checked = true;
            break;
    }
}

export function updateScore(player, score) {
    const i = playerArray.indexOf(player);
    const playerScore = document.getElementById('playerScores').children[i];
    playerScore.innerText = score;
}