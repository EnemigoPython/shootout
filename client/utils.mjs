export async function ajax(url) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.addEventListener("load", function () {
            try {
                resolve(this.responseText);
            } catch (error) {
                reject(error);
            }
        });
        request.open("GET", url);
        request.send();
        request.addEventListener("error", reject);
    });
}

// to call await inside EventListener/non-async block
export async function loadContent(page) {
    app.innerHTML = await ajax(page);
}

export async function loadGame(page) {
    const gameWindow = document.getElementById('gameWindow');
    gameWindow.innerHTML = await ajax(page);
}

// it came to this and I'm not proud
export function adjustHack() {
    app.classList.add('in-game');
}