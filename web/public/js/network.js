// Network module — Socket.io client wrapper
const Network = (() => {
  let socket = null;

  // Event callbacks set by game.js
  let handlers = {};

  function connect() {
    socket = io();

    socket.on('connect', () => {
      console.log('[net] connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[net] disconnected');
    });

    // Game events
    socket.on('game-start', (data) => {
      if (handlers.onGameStart) handlers.onGameStart(data);
    });

    socket.on('turn-start', (data) => {
      if (handlers.onTurnStart) handlers.onTurnStart(data);
    });

    socket.on('execute-turn', (moves) => {
      if (handlers.onExecuteTurn) handlers.onExecuteTurn(moves);
    });

    socket.on('game-over', (data) => {
      if (handlers.onGameOver) handlers.onGameOver(data);
    });

    socket.on('opponent-disconnected', (data) => {
      if (handlers.onOpponentDisconnected) handlers.onOpponentDisconnected(data);
    });

    socket.on('quick-play-matched', (data) => {
      if (handlers.onQuickPlayMatched) handlers.onQuickPlayMatched(data);
    });

    socket.on('rematch-requested', () => {
      if (handlers.onRematchRequested) handlers.onRematchRequested();
    });
  }

  function createRoom(callback) {
    socket.emit('create-room', callback);
  }

  function joinRoom(code, callback) {
    socket.emit('join-room', code, callback);
  }

  function quickPlay(callback) {
    socket.emit('quick-play', callback);
  }

  function cancelQuickPlay() {
    socket.emit('cancel-quick-play');
  }

  function submitMoves(moves) {
    socket.emit('submit-moves', moves);
  }

  function setReady(isReady) {
    socket.emit('player-ready', isReady);
  }

  function turnSettled() {
    socket.emit('turn-settled');
  }

  function goalScored(data) {
    socket.emit('goal-scored', data);
  }

  function requestRematch() {
    socket.emit('request-rematch');
  }

  function acceptRematch() {
    socket.emit('accept-rematch');
  }

  function leaveGame() {
    socket.emit('leave-game');
  }

  function setHandlers(h) {
    handlers = h;
  }

  function getSocketId() {
    return socket ? socket.id : null;
  }

  return {
    connect, createRoom, joinRoom, quickPlay, cancelQuickPlay,
    submitMoves, setReady, turnSettled, goalScored,
    requestRematch, acceptRematch, leaveGame,
    setHandlers, getSocketId,
  };
})();
