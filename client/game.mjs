import {shake} from './anims.mjs';
import {socket, username, settings} from './client.mjs';


function newInput() {
    const input = document.createElement('input');
    input.classList.add('pickInput');
    input.setAttribute('maxlength', parseInt(settings.character));
    return input;
}

function noSpaces(x) {
    return !x.includes(' ');
}

function isDifferent(sentence, word) {
    return !sentence.toLowerCase().includes(word.toLowerCase());
}

function validInput(prompt, answer) {
    return prompt && answer && noSpaces(answer) && isDifferent(prompt, answer);
}

function uniqueAnswers(answers) {
    const checkUnique = Array.from(new Set(answers));
    return answers.length === checkUnique.length;
}

function validInputs(prompt, answers) {
    return answers.every(answer => validInput(prompt, answer)) && uniqueAnswers(answers);
}

export function pickScreen(preset) {
    document.getElementById('guessText').remove();
    const userPickType = typeof preset === 'object' ? 'prompt' : 'answers';
    const gameHeader = document.getElementById('gameHeader');
    const answerEls = document.getElementsByClassName('answers');
    const promptEl = document.getElementById('prompt');
    const submitBtn = document.getElementById('submitBtn');
    gameHeader.innerText = `Finish the question below by filling in the ${userPickType}:`;
    if (userPickType === 'prompt') {
        for (let i = 0; i < 3; i++) {
            answerEls[i].innerText = preset[i];
        }
        const replaceInput = newInput();
        promptEl.parentNode.replaceChild(replaceInput, promptEl);
    } else {
        [...answerEls].forEach(answerEl => {
            const replaceInput = newInput();
            answerEl.parentNode.replaceChild(replaceInput, answerEl);
        });
        promptEl.innerText = preset;
    }
    submitBtn.addEventListener('click', (e) => {
        const allInputs = document.getElementsByClassName('pickInput');
        const userContent = userPickType === 'prompt' ? allInputs[0].value : [...allInputs].map(input => input.value);
        const prompt = userPickType === 'prompt' ? userContent : preset;
        const answers = userPickType === 'answers' ? userContent : preset;
        const submitWarning = document.getElementById('submitWarning');
        let warningText;

        if (validInputs(prompt, answers)) {
            submitWarning.innerText = '';
            socket.emit('pickerSubmit', {'pickType': userPickType, 'content': userContent});
        } else {
            // if any inputs not accepted, display message with why (overwrite in order of importance: no text>spaces>common word)
            for (let i = 0; i < 3; i++) {
                if (!validInput(prompt, answers[i]) || !uniqueAnswers(answers)) {
                    if (!isDifferent(prompt, answers[i]) || !uniqueAnswers(answers)) {
                        warningText = 'You must be original with your response!';
                    }
                    if (!noSpaces(answers[i])) {
                        warningText = "There shouldn't be spaces in your answers.";
                    }
                    if (!answers[i]) {
                        warningText = 'Fill in all the answers.';
                    }
                    if (!prompt) {
                        warningText = 'Fill in the prompt.';
                    }
                    if (userPickType === 'prompt') {
                        shake(allInputs[0]);
                        break;
                    } else {
                        shake(allInputs[i]);
                    }
                }
            }
            submitWarning.innerText = warningText;
        }
    });
}

export function waitScreen(player) {
    document.getElementById('submitBtn').remove();
    const gameHeader = document.getElementById('gameHeader');
    gameHeader.innerText = `${player} is creating something beautiful...`;
}

export function waitingRoom() {
    document.getElementById('submitBtn').remove();
    const gameHeader = document.getElementById('gameHeader');
    gameHeader.innerText = `You joined the game late ${username}, hold on a second...`;
}

export function tickTimer(time) {
    const gameTimerEl = document.getElementById('gameTimer');
    gameTimerEl.innerText = time;
}

export function guessListener() {
    guessText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (guessText.value) {
                const guess = guessText.value;
                guessText.value = '';
                socket.emit('guess', guess.toLowerCase());
            } else {
                shake(guessText);
            }
        }
    });
}