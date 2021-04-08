const {GameRoom, genCode} = require('./game.js');
const games = {};
let playerCount = 0;

const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const port = process.env.PORT || 4000;

const app = express();
const path = require('path');
const server = http.createServer(app);
const io = socketio(server);
app.use(express.static('./client'));
app.use(express.static('./client/pages'));

function HTML(file) {
  return path.join(__dirname, '..', `/client/pages/${file}.html`);
}

app.get('/menu', (req, res) => {
  res.sendFile(HTML('menu'));
});

app.get('/lobby', (req, res) => {
  res.sendFile(HTML('lobby'));
});

app.get('/settings', (req, res) => {
  res.sendFile(HTML('settings'));
});

app.get('/game', (req, res) => {
  res.sendFile(HTML('game'));
});

app.get('/podium', (req, res) => {
  res.sendFile(HTML('podium'));
});

app.get('/****', (req, res) => {
  res.sendFile(HTML('index'));
});

function getPlayers(room) {
  const players = Array.from(io.sockets.adapter.rooms.get(room).keys());
  const playerNames = players.map(player => io.sockets.sockets.get(player).username);
  return {'players': players, 'names': playerNames};
}

function getScores(room) {
  const players = Array.from(io.sockets.adapter.rooms.get(room).keys());
  const scores = players.map(player => io.sockets.sockets.get(player).score);
  return scores;
}

async function newRound(room) {
  const {players, names} = getPlayers(room);
  await games[room].newRound(players, names);
  // stop it throwing UnhandledPromiseRejectionError when room gets deleted
  if (!games[room]) {
    return;
  }
  if (games[room].round <= games[room].settings.rounds) {
    const {player, preset} = games[room].nextTurn(players);
    const playerSocket = io.sockets.sockets.get(player);
    const roundNumber = games[room].round;
    io.to(player).emit("pick", preset, roundNumber);
    playerSocket.to(room).emit("preturn", playerSocket.username, roundNumber);
  } else {
    const scores = getScores(room);
    const podium = games[room].createPodium(names, scores);
    io.to(room).emit("gameOver", podium);
    await games[room].staticTimer(8000);
    const roomHost = players.filter(player => io.sockets.sockets.get(player).host)[0];
    const hostSocket = io.sockets.sockets.get(roomHost);
    games[room].round = 0;
    io.to(roomHost).emit("restart", true);
    hostSocket.to(room).emit("restart", false);
  }
}

async function nextTurn(room, instant=false) {
  // moment to breathe in between turns
  if (!instant) {
    await games[room].staticTimer(6000);
  }
  
  const players = getPlayers(room).players;
  const playerData = games[room].nextTurn(players);
  if (playerData) {
    const {player, preset} = playerData;
    const playerSocket = io.sockets.sockets.get(player);
    const roundNumber = games[room].round;
    io.to(player).emit("pick", preset, roundNumber);
    playerSocket.to(room).emit("preturn", playerSocket.username, roundNumber);
  } else {
    newRound(room);
  }
}

io.on('connection', (socket) => {
  console.log(socket.id + ' connected to the server.');
  playerCount++;
  socket.emit('welcome', playerCount);

  // remove player from room after DC
  socket.on("disconnecting", () => {
    if (socket.room) {
      socket.to(socket.room).emit('left', socket.username);
      if (games[socket.room].currentPicker === socket.id) {
        nextTurn(socket.room, true);
      }
    }
    // if they were room host, find new host
    if (socket.host) {
      const players = getPlayers(socket.room).players;
      const newHost = io.sockets.sockets.get(players.filter(player => player !== socket.id)[0]);
      // transfer if anyone left in the room (otherwise TypeError, newHost is undefined)
      if (newHost) {
        newHost.host = true;
        socket.to(newHost.id).emit('hostMigrate');
        socket.to(socket.room).emit('migrateMessage', newHost.username);
      } else {
        delete games[socket.room];
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(socket.id + ' has disconnected.');
    playerCount--;
  });

  socket.on("create", (username) => {
    let code;
    // generate a code that isn't already being used for a room
    while (!code || io.sockets.adapter.rooms.get(code)) {
      code = genCode();
    }
    socket.username = username;
    socket.host = true;
    socket.room = code;
    socket.score = 0;
    socket.join(code);
    games[code] = new GameRoom(username);
    socket.emit("created", {'code': code, 'gameSettings': games[code].settings, 'title': games[code].title});
    console.log(`Room created: ${games[code].title}.`);
  });

  socket.on("join", ({username, code}) => {
    code = code.toUpperCase();
    if (io.sockets.adapter.rooms.get(code)) {
      const names = getPlayers(code).names;
      if (names.length < 12) {
        if (names.every(name => username !== name)) {
          // include self in list of players
          names.push(username);
          socket.username = username;
          socket.host = false;
          socket.room = code;
          socket.score = 0;
          socket.join(code);
          socket.emit("joined", {'code': code, 'players': names, 'round': games[code].round, 'gameSettings': games[code].settings, 
            'title': games[code].title});
          socket.to(code).emit("newPlayer", username);
          console.log(`${username} joined ${games[code].title}.`)
        } else {
          socket.emit("joinFailed", "sameName");
        }
      } else {
        socket.emit("joinFailed", "roomFull");
      }
    } else {
      socket.emit("joinFailed", "notFound");
    }
  });

  socket.on("userMessage", ({user, content}) => {
    io.to(socket.room).emit("userMessage", {user, content});
  });

  socket.on("settingChanged", ({setting, value}) => {
    games[socket.room].settings[setting] = value;
    io.to(socket.room).emit("syncSettings", {setting, value});
  });

  socket.on("startGame", () => {
    const players = getPlayers(socket.room).players;
    if (players.length < 3) {
      io.to(socket.room).emit("notEnough", socket.username);
    } else {
      newRound(socket.room);
    }
  });

  socket.on("pickerSubmit", async ({pickType, content}) => {
    const preset = games[socket.room].presets[socket.id];
    const prompt = pickType === 'prompt' ? content : preset;
    const answers = pickType === 'prompt' ? preset : content;
    games[socket.room].answers = answers.map(answer => answer.toLowerCase());
    socket.to(socket.room).emit("startTurn", {'prompt': prompt, 'play': true, 'player': socket.username});
    socket.emit("startTurn", {'prompt': prompt, 'play': false});
    games[socket.room].startGameTimer();
    while (games[socket.room].timeRemaining > 0 && games[socket.room].activeTimer) {
      await games[socket.room].tickGameTimer();
      try {
        io.to(socket.room).emit("tick", games[socket.room].timeRemaining);
      } catch (error) {
        return;
      }
    }
    if (games[socket.room].activeTimer) {
      correctCount = games[socket.room].correctCount;
      io.to(socket.room).emit("timeout", {'answers': answers, 'count': correctCount});
      nextTurn(socket.room);
    }
  });

  socket.on("guess", (guess) => {
    const {i, remaining, points} = games[socket.room].processGuess(guess);
    socket.score += points;
    if (i >= 0) {
      const scores = {};
      scores[socket.username] = socket.score;
      const picker = games[socket.room].currentPicker;
      const pickerSocket = io.sockets.sockets.get(picker);
      pickerSocket.score += Math.floor(points / 2);
      scores[pickerSocket.username] = pickerSocket.score; 
      io.to(socket.room).emit("correctGuess", {'answer': guess, 'i': i, scores});
      // if all the answers have been guessed, stop the timer
      if (!remaining) {
        games[socket.room].activeTimer = false;
        io.to(socket.room).emit("completion");
        nextTurn(socket.room);
      }
    } else {
      io.to(socket.room).emit("wrongGuess", {'guess': guess, 'player': socket.username, 'score': socket.score})
    }
  });

});

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});