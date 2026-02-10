const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- Room state ---
const rooms = {};       // roomCode -> { players: [socketId, socketId], moves: {}, ready: {}, noMoveCount: {}, turnTimer: null }
const quickQueue = [];  // [socketId, ...]

function generateCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? generateCode() : code;
}

function createRoom(code) {
  rooms[code] = {
    players: [],
    moves: {},
    ready: {},
    noMoveCount: {},
    turnTimer: null,
    turnActive: false,
  };
  return rooms[code];
}

function findRoomBySocket(socketId) {
  for (const [code, room] of Object.entries(rooms)) {
    if (room.players.includes(socketId)) return { code, room };
  }
  return null;
}

function cleanupRoom(code) {
  const room = rooms[code];
  if (room && room.turnTimer) clearTimeout(room.turnTimer);
  delete rooms[code];
  console.log(`[room] destroyed ${code}`);
}

function playerIndex(room, socketId) {
  return room.players.indexOf(socketId);
}

function opponentId(room, socketId) {
  const idx = playerIndex(room, socketId);
  return room.players[idx === 0 ? 1 : 0];
}

// --- Turn logic ---
const TURN_DURATION_MS = 15000;

function startTurn(code) {
  const room = rooms[code];
  if (!room || room.players.length < 2) return;

  room.moves = {};
  room.ready = {};
  room.turnActive = true;

  io.in(code).emit('turn-start', { duration: TURN_DURATION_MS });
  console.log(`[turn] started in ${code}`);

  room.turnTimer = setTimeout(() => {
    executeTurn(code);
  }, TURN_DURATION_MS);
}

function executeTurn(code) {
  const room = rooms[code];
  if (!room || !room.turnActive) return;

  room.turnActive = false;
  if (room.turnTimer) clearTimeout(room.turnTimer);
  room.turnTimer = null;

  const p1 = room.players[0];
  const p2 = room.players[1];
  const p1Moves = room.moves[p1] || [];
  const p2Moves = room.moves[p2] || [];

  // Track no-move forfeits
  for (const pid of [p1, p2]) {
    const moves = room.moves[pid] || [];
    const hasMoves = moves.some(m => m !== null);
    if (!hasMoves) {
      room.noMoveCount[pid] = (room.noMoveCount[pid] || 0) + 1;
    } else {
      room.noMoveCount[pid] = 0;
    }
  }

  // Check for forfeits
  for (const pid of [p1, p2]) {
    if (room.noMoveCount[pid] >= 2) {
      const forfeitIdx = playerIndex(room, pid);
      const winnerIdx = forfeitIdx === 0 ? 1 : 0;
      io.in(code).emit('game-over', { winner: winnerIdx + 1, reason: 'forfeit-no-move' });
      console.log(`[game] player ${forfeitIdx + 1} forfeited (no moves) in ${code}`);
      return;
    }
  }

  const allMoves = {
    p1: p1Moves,
    p2: p2Moves,
  };

  io.in(code).emit('execute-turn', allMoves);
  console.log(`[turn] executing in ${code}:`, JSON.stringify(allMoves));
}

// --- Socket handling ---
io.on('connection', (socket) => {
  console.log(`[conn] ${socket.id} connected`);

  // Create private room
  socket.on('create-room', (callback) => {
    const code = generateCode();
    const room = createRoom(code);
    room.players.push(socket.id);
    room.noMoveCount[socket.id] = 0;
    socket.join(code);
    console.log(`[room] ${socket.id} created ${code}`);
    callback({ code, playerNumber: 1 });
  });

  // Join private room by code
  socket.on('join-room', (code, callback) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (!room) return callback({ error: 'Room not found' });
    if (room.players.length >= 2) return callback({ error: 'Room is full' });

    room.players.push(socket.id);
    room.noMoveCount[socket.id] = 0;
    socket.join(code);
    console.log(`[room] ${socket.id} joined ${code}`);
    callback({ code, playerNumber: 2 });

    // Both players in — start game
    io.in(code).emit('game-start', {
      players: [room.players[0], room.players[1]],
    });
    console.log(`[game] started in ${code}`);

    // Start first turn after a brief delay for clients to set up
    setTimeout(() => startTurn(code), 1000);
  });

  // Quick play queue
  socket.on('quick-play', (callback) => {
    // Remove if already in queue
    const qIdx = quickQueue.indexOf(socket.id);
    if (qIdx !== -1) quickQueue.splice(qIdx, 1);

    if (quickQueue.length > 0) {
      const opponentSocket = quickQueue.shift();
      // Make sure opponent is still connected
      const opSock = io.sockets.sockets.get(opponentSocket);
      if (!opSock) {
        quickQueue.push(socket.id);
        callback({ waiting: true });
        return;
      }

      const code = generateCode();
      const room = createRoom(code);
      room.players.push(opponentSocket);
      room.players.push(socket.id);
      room.noMoveCount[opponentSocket] = 0;
      room.noMoveCount[socket.id] = 0;
      opSock.join(code);
      socket.join(code);

      opSock.emit('quick-play-matched', { code, playerNumber: 1 });
      callback({ code, playerNumber: 2 });

      io.in(code).emit('game-start', {
        players: [opponentSocket, socket.id],
      });
      console.log(`[quick] matched ${opponentSocket} + ${socket.id} in ${code}`);

      setTimeout(() => startTurn(code), 1000);
    } else {
      quickQueue.push(socket.id);
      callback({ waiting: true });
      console.log(`[quick] ${socket.id} waiting`);
    }
  });

  socket.on('cancel-quick-play', () => {
    const idx = quickQueue.indexOf(socket.id);
    if (idx !== -1) {
      quickQueue.splice(idx, 1);
      console.log(`[quick] ${socket.id} cancelled`);
    }
  });

  // Player submits moves for their blobs
  socket.on('submit-moves', (moves) => {
    const found = findRoomBySocket(socket.id);
    if (!found || !found.room.turnActive) return;
    found.room.moves[socket.id] = moves;
    console.log(`[moves] ${socket.id} submitted in ${found.code}`);
  });

  // Player toggles ready
  socket.on('player-ready', (isReady) => {
    const found = findRoomBySocket(socket.id);
    if (!found || !found.room.turnActive) return;

    found.room.ready[socket.id] = isReady;
    console.log(`[ready] ${socket.id} = ${isReady} in ${found.code}`);

    // Check if both ready
    const room = found.room;
    if (room.players.length === 2 && room.ready[room.players[0]] && room.ready[room.players[1]]) {
      executeTurn(found.code);
    }
  });

  // Turn finished (physics settled) — client reports back
  socket.on('turn-settled', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    // Simple approach: first player to report settled triggers next turn
    // (both clients settle at roughly the same time)
    if (!found.room.turnActive) {
      startTurn(found.code);
    }
  });

  // Goal scored — client reports
  socket.on('goal-scored', (data) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    io.in(found.code).emit('game-over', { winner: data.winner, reason: 'goal' });
    console.log(`[game] goal in ${found.code}, player ${data.winner} wins`);
  });

  // Rematch request
  socket.on('request-rematch', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const opp = opponentId(found.room, socket.id);
    if (!opp) return;
    const oppSock = io.sockets.sockets.get(opp);
    if (oppSock) oppSock.emit('rematch-requested');
  });

  socket.on('accept-rematch', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    found.room.noMoveCount = {};
    found.room.noMoveCount[found.room.players[0]] = 0;
    found.room.noMoveCount[found.room.players[1]] = 0;
    io.in(found.code).emit('game-start', {
      players: [found.room.players[0], found.room.players[1]],
    });
    setTimeout(() => startTurn(found.code), 1000);
  });

  // Leave game
  socket.on('leave-game', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    socket.leave(found.code);
    const opp = opponentId(found.room, socket.id);
    if (opp) {
      const oppSock = io.sockets.sockets.get(opp);
      if (oppSock) oppSock.emit('opponent-disconnected');
    }
    cleanupRoom(found.code);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[conn] ${socket.id} disconnected`);

    // Remove from quick play queue
    const qIdx = quickQueue.indexOf(socket.id);
    if (qIdx !== -1) quickQueue.splice(qIdx, 1);

    // Handle game disconnect
    const found = findRoomBySocket(socket.id);
    if (!found) return;

    const opp = opponentId(found.room, socket.id);
    if (opp) {
      const oppSock = io.sockets.sockets.get(opp);
      if (oppSock) {
        const disconnectedIdx = playerIndex(found.room, socket.id);
        oppSock.emit('opponent-disconnected', { disconnectedPlayer: disconnectedIdx + 1 });
      }
    }
    cleanupRoom(found.code);
  });
});

// --- Heartbeat config ---
io.engine.pingInterval = 5000;
io.engine.pingTimeout = 10000;

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Blobolicious server running on http://localhost:${PORT}`);
});
