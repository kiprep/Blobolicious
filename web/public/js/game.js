// Main game module — ties everything together
const Game = (() => {
  // State
  let mode = null;          // 'online' | 'ai'
  let playerNumber = 0;     // 1 or 2
  let myTeam = 'p1';
  let aiTeam = 'p2';
  let isAiOpponent = false;
  let gameActive = false;
  let turnActive = false;
  let isReady = false;
  let executing = false;
  let settleCheckInterval = null;
  let timerInterval = null;
  let timerRemaining = 0;
  let goalHandled = false;

  // DOM refs
  const lobby = document.getElementById('lobby');
  const gameScreen = document.getElementById('game-screen');
  const gameOverScreen = document.getElementById('game-over');
  const canvas = document.getElementById('game-canvas');

  // Lobby elements
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const btnQuick = document.getElementById('btn-quick');
  const btnAi = document.getElementById('btn-ai');
  const createPanel = document.getElementById('create-panel');
  const joinPanel = document.getElementById('join-panel');
  const quickPanel = document.getElementById('quick-panel');
  const roomCodeDisplay = document.getElementById('room-code');
  const joinInput = document.getElementById('join-input');
  const joinError = document.getElementById('join-error');
  const btnJoinSubmit = document.getElementById('btn-join-submit');
  const btnCancelCreate = document.getElementById('btn-cancel-create');
  const btnCancelJoin = document.getElementById('btn-cancel-join');
  const btnCancelQuick = document.getElementById('btn-cancel-quick');
  const menuButtons = document.querySelector('.menu-buttons');

  // HUD elements
  const hudPlayerLabel = document.getElementById('hud-player-label');
  const hudTimer = document.getElementById('hud-timer');
  const btnReady = document.getElementById('btn-ready');
  const turnMessage = document.getElementById('turn-message');

  // Game over elements
  const gameOverText = document.getElementById('game-over-text');
  const gameOverReason = document.getElementById('game-over-reason');
  const btnRematch = document.getElementById('btn-rematch');
  const btnContinueAi = document.getElementById('btn-continue-ai');
  const btnLeave = document.getElementById('btn-leave');

  // --- Initialization ---
  function init() {
    Network.connect();
    setupLobbyEvents();
    setupGameEvents();
    setupNetworkHandlers();
  }

  // --- Lobby ---
  function setupLobbyEvents() {
    btnCreate.addEventListener('click', () => {
      hideAllPanels();
      menuButtons.classList.add('hidden');
      createPanel.classList.remove('hidden');
      Network.createRoom((res) => {
        roomCodeDisplay.textContent = res.code;
        playerNumber = res.playerNumber;
      });
    });

    btnJoin.addEventListener('click', () => {
      hideAllPanels();
      menuButtons.classList.add('hidden');
      joinPanel.classList.remove('hidden');
      joinInput.value = '';
      joinError.classList.add('hidden');
      joinInput.focus();
    });

    btnJoinSubmit.addEventListener('click', () => {
      const code = joinInput.value.trim().toUpperCase();
      if (code.length !== 4) {
        joinError.textContent = 'Enter a 4-character code';
        joinError.classList.remove('hidden');
        return;
      }
      Network.joinRoom(code, (res) => {
        if (res.error) {
          joinError.textContent = res.error;
          joinError.classList.remove('hidden');
        } else {
          playerNumber = res.playerNumber;
        }
      });
    });

    joinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnJoinSubmit.click();
    });

    btnQuick.addEventListener('click', () => {
      hideAllPanels();
      menuButtons.classList.add('hidden');
      quickPanel.classList.remove('hidden');
      Network.quickPlay((res) => {
        if (res.waiting) {
          // stay on quick panel
        } else {
          playerNumber = res.playerNumber;
        }
      });
    });

    btnAi.addEventListener('click', () => {
      startLocalGame();
    });

    btnCancelCreate.addEventListener('click', () => {
      Network.leaveGame();
      showLobby();
    });

    btnCancelJoin.addEventListener('click', () => {
      showLobby();
    });

    btnCancelQuick.addEventListener('click', () => {
      Network.cancelQuickPlay();
      showLobby();
    });
  }

  function hideAllPanels() {
    createPanel.classList.add('hidden');
    joinPanel.classList.add('hidden');
    quickPanel.classList.add('hidden');
  }

  function showLobby() {
    hideAllPanels();
    menuButtons.classList.remove('hidden');
    gameScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    lobby.classList.add('active');
  }

  // --- Network handlers ---
  function setupNetworkHandlers() {
    Network.setHandlers({
      onGameStart: (data) => {
        mode = 'online';
        isAiOpponent = false;
        myTeam = playerNumber === 1 ? 'p1' : 'p2';
        startGame();
      },
      onTurnStart: (data) => {
        beginTurn(data.duration);
      },
      onExecuteTurn: (moves) => {
        executeMoves(moves);
      },
      onGameOver: (data) => {
        showGameOver(data.winner, data.reason);
      },
      onOpponentDisconnected: (data) => {
        if (gameActive && !executing) {
          showGameOver(playerNumber, 'disconnect');
        }
      },
      onQuickPlayMatched: (data) => {
        playerNumber = data.playerNumber;
      },
      onRematchRequested: () => {
        // Auto-accept for simplicity
        Network.acceptRematch();
      },
    });
  }

  // --- Game setup ---
  function startGame() {
    lobby.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    gameScreen.classList.add('active');

    hudPlayerLabel.textContent = `Player ${playerNumber}`;
    hudPlayerLabel.style.color = playerNumber === 1 ? '#e74c3c' : '#3498db';

    goalHandled = false;
    gameActive = true;
    turnActive = false;
    executing = false;

    Physics.init();
    Renderer.init(canvas);
    Input.init(canvas, myTeam);

    Physics.setOnGoal((side) => {
      if (goalHandled) return;
      goalHandled = true;
      // Left goal = P1 scores (P2's goal), Right goal = P2 scores (P1's goal)
      const winner = side === 'left' ? 2 : 1;
      if (mode === 'online') {
        Network.goalScored({ winner });
      } else {
        showGameOver(winner, 'goal');
      }
    });

    Physics.setOnBlobEliminated((team, index) => {
      console.log(`[game] blob eliminated: ${team}[${index}]`);
    });

    Input.setOnAimUpdate((aimData) => {
      renderFrame(aimData);
    });

    Input.setOnMoveSet((moves) => {
      if (mode === 'online') {
        Network.submitMoves(moves);
      }
    });

    renderFrame(null);
  }

  function startLocalGame() {
    mode = 'ai';
    isAiOpponent = true;
    playerNumber = 1;
    myTeam = 'p1';
    aiTeam = 'p2';
    startGame();
    beginTurn(15000);
  }

  // --- Turn management ---
  function beginTurn(duration) {
    turnActive = true;
    isReady = false;
    executing = false;
    goalHandled = false;
    Input.clearMoves();
    Input.enable();
    btnReady.textContent = 'Ready';
    btnReady.classList.remove('is-ready');
    turnMessage.classList.add('hidden');

    // Timer
    timerRemaining = Math.ceil(duration / 1000);
    hudTimer.textContent = timerRemaining;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timerRemaining--;
      hudTimer.textContent = Math.max(0, timerRemaining);
      if (timerRemaining <= 0) {
        clearInterval(timerInterval);
        if (mode === 'ai' && turnActive) {
          executeLocalTurn();
        }
      }
    }, 1000);

    // AI turn timer for local mode
    if (mode === 'ai') {
      // AI timeout handled by timer above
    }

    renderFrame(null);
  }

  function executeLocalTurn() {
    if (!turnActive) return;
    turnActive = false;
    Input.disable();

    const playerMoves = Input.getMoves();
    const aiMoves = AI.generateMoves(aiTeam);

    const allMoves = { p1: playerMoves, p2: aiMoves };
    executeMoves(allMoves);
  }

  function executeMoves(moves) {
    turnActive = false;
    executing = true;
    Input.disable();
    if (timerInterval) clearInterval(timerInterval);
    hudTimer.textContent = '--';

    turnMessage.textContent = 'Executing...';
    turnMessage.classList.remove('hidden');

    Physics.applyMoves(moves);

    // Run physics and check for settle
    let settleCount = 0;
    settleCheckInterval = setInterval(() => {
      // Step physics multiple times per check for speed
      for (let i = 0; i < 3; i++) {
        Physics.step(1000 / 60);
      }
      renderFrame(null);

      if (Physics.isSettled()) {
        settleCount++;
        if (settleCount > 10) { // Stable for ~10 checks
          clearInterval(settleCheckInterval);
          executing = false;
          turnMessage.classList.add('hidden');

          if (!goalHandled && gameActive) {
            if (mode === 'online') {
              Network.turnSettled();
            } else if (mode === 'ai') {
              beginTurn(15000);
            }
          }
        }
      } else {
        settleCount = 0;
      }
    }, 1000 / 30);
  }

  // --- Rendering ---
  function renderFrame(aimData) {
    const myMoves = Input.getMoves();
    const gameState = {
      moves: { [myTeam]: myMoves },
      aiming: aimData,
    };
    Renderer.render(gameState);
  }

  // --- Game Over ---
  function showGameOver(winner, reason) {
    gameActive = false;
    turnActive = false;
    executing = false;
    Input.disable();
    if (timerInterval) clearInterval(timerInterval);
    if (settleCheckInterval) clearInterval(settleCheckInterval);

    const iWin = winner === playerNumber;
    gameOverText.textContent = iWin ? 'You Win!' : 'You Lose!';

    const reasons = {
      'goal': 'Goal scored!',
      'forfeit-no-move': iWin ? 'Opponent forfeited (no moves)' : 'Forfeited (no moves for 2 turns)',
      'disconnect': 'Opponent disconnected',
    };
    gameOverReason.textContent = reasons[reason] || '';

    // Show continue vs AI only on disconnect
    if (reason === 'disconnect') {
      btnContinueAi.classList.remove('hidden');
    } else {
      btnContinueAi.classList.add('hidden');
    }

    // Hide rematch in AI mode or disconnect
    if (mode === 'ai' || reason === 'disconnect') {
      btnRematch.classList.add('hidden');
    } else {
      btnRematch.classList.remove('hidden');
    }

    gameOverScreen.classList.remove('hidden');
  }

  // --- Game events ---
  function setupGameEvents() {
    btnReady.addEventListener('click', () => {
      if (!turnActive) return;

      isReady = !isReady;
      if (isReady) {
        btnReady.textContent = 'Unready';
        btnReady.classList.add('is-ready');
        if (mode === 'online') {
          Network.submitMoves(Input.getMoves());
          Network.setReady(true);
        } else if (mode === 'ai') {
          executeLocalTurn();
        }
      } else {
        btnReady.textContent = 'Ready';
        btnReady.classList.remove('is-ready');
        if (mode === 'online') {
          Network.setReady(false);
        }
      }
    });

    btnRematch.addEventListener('click', () => {
      gameOverScreen.classList.add('hidden');
      if (mode === 'online') {
        Network.requestRematch();
        Network.acceptRematch();
      } else {
        Physics.reset();
        startLocalGame();
      }
    });

    btnContinueAi.addEventListener('click', () => {
      gameOverScreen.classList.add('hidden');
      mode = 'ai';
      isAiOpponent = true;
      // Figure out which team the disconnected player was
      aiTeam = playerNumber === 1 ? 'p2' : 'p1';
      gameActive = true;
      goalHandled = false;

      Physics.setOnGoal((side) => {
        if (goalHandled) return;
        goalHandled = true;
        const winner = side === 'left' ? 2 : 1;
        showGameOver(winner, 'goal');
      });

      beginTurn(15000);
    });

    btnLeave.addEventListener('click', () => {
      if (mode === 'online') {
        Network.leaveGame();
      }
      Physics.destroy();
      Input.destroy();
      showLobby();
    });
  }

  // --- Boot ---
  init();
})();
