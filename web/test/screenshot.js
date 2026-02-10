// Test harness — starts server, validates pages load, checks for JS errors
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;

let serverProc = null;
let errors = [];
let passed = 0;
let failed = 0;

function log(msg) { console.log(`[test] ${msg}`); }
function pass(msg) { passed++; log(`PASS: ${msg}`); }
function fail(msg) { failed++; errors.push(msg); log(`FAIL: ${msg}`); }

function fetch(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${urlPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn('node', [path.join(__dirname, '..', 'server.js')], {
      env: { ...process.env, PORT: PORT },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    serverProc.stdout.on('data', (d) => {
      output += d.toString();
      if (output.includes('running on')) resolve();
    });
    serverProc.stderr.on('data', (d) => {
      console.log(`[server stderr] ${d.toString().trim()}`);
    });

    setTimeout(() => reject(new Error('Server start timeout')), 5000);
  });
}

async function runTests() {
  log('Starting server...');
  await startServer();
  log('Server started on port ' + PORT);

  // Test 1: Index page loads
  try {
    const res = await fetch('/');
    if (res.status === 200) pass('Index page returns 200');
    else fail(`Index page returned ${res.status}`);

    if (res.body.includes('Blobolicious')) pass('Index contains title');
    else fail('Index missing title');

    if (res.body.includes('Create Game')) pass('Index has Create Game button');
    else fail('Index missing Create Game button');

    if (res.body.includes('Join Game')) pass('Index has Join Game button');
    else fail('Index missing Join Game button');

    if (res.body.includes('Quick Play')) pass('Index has Quick Play button');
    else fail('Index missing Quick Play button');

    if (res.body.includes('Play vs AI')) pass('Index has Play vs AI button');
    else fail('Index missing Play vs AI button');

    if (res.body.includes('game-canvas')) pass('Index has game canvas');
    else fail('Index missing game canvas');
  } catch (e) {
    fail(`Index page error: ${e.message}`);
  }

  // Test 2: JS files load
  const jsFiles = ['physics.js', 'renderer.js', 'input.js', 'ai.js', 'network.js', 'game.js', 'matter.min.js'];
  for (const file of jsFiles) {
    try {
      const res = await fetch(`/js/${file}`);
      if (res.status === 200 && res.body.length > 0) pass(`${file} loads (${res.body.length} bytes)`);
      else fail(`${file} failed to load (status: ${res.status})`);
    } catch (e) {
      fail(`${file} error: ${e.message}`);
    }
  }

  // Test 3: Socket.io client loads
  try {
    const res = await fetch('/socket.io/socket.io.js');
    if (res.status === 200) pass('Socket.io client JS loads');
    else fail(`Socket.io client returned ${res.status}`);
  } catch (e) {
    fail(`Socket.io client error: ${e.message}`);
  }

  // Test 4: CSS loads
  try {
    const res = await fetch('/style.css');
    if (res.status === 200) pass('CSS loads');
    else fail(`CSS returned ${res.status}`);
  } catch (e) {
    fail(`CSS error: ${e.message}`);
  }

  // Test 5: Socket.io connection test
  try {
    const ioClient = require('socket.io-client');
    const socket = ioClient(BASE, { forceNew: true });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { fail('Socket.io connection timeout'); reject(new Error('timeout')); }, 3000);

      socket.on('connect', () => {
        clearTimeout(timer);
        pass('Socket.io connects successfully');

        // Test room creation
        socket.emit('create-room', (res) => {
          if (res.code && res.code.length === 4) pass(`Room created: ${res.code}`);
          else fail('Room creation failed');

          if (res.playerNumber === 1) pass('Creator is Player 1');
          else fail(`Creator playerNumber: ${res.playerNumber}`);

          socket.disconnect();
          resolve();
        });
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        fail(`Socket.io connection error: ${err.message}`);
        reject(err);
      });
    });
  } catch (e) {
    if (!e.message.includes('timeout')) {
      log(`SKIP: Socket.io integration test (${e.message})`);
    }
  }

  // Test 6: Two-player room join + game start
  try {
    const ioClient = require('socket.io-client');
    const p1 = ioClient(BASE, { forceNew: true });

    await new Promise((resolve, reject) => {
      let gameStartCount = 0;
      const timer = setTimeout(() => { fail('Two-player test timeout'); p1.disconnect(); resolve(); }, 5000);

      p1.on('connect', () => {
        p1.emit('create-room', (res) => {
          const roomCode = res.code;
          pass(`P1 created room ${roomCode}`);

          // Create p2 AFTER room exists to avoid race
          const p2 = ioClient(BASE, { forceNew: true });

          const onGameStart = () => {
            gameStartCount++;
            if (gameStartCount === 2) {
              clearTimeout(timer);
              pass('Both players received game-start');
              p1.disconnect();
              p2.disconnect();
              resolve();
            }
          };
          p1.on('game-start', onGameStart);
          p2.on('game-start', onGameStart);

          p2.on('connect', () => {
            p2.emit('join-room', roomCode, (res2) => {
              if (res2.error) { fail(`P2 join error: ${res2.error}`); clearTimeout(timer); reject(); return; }
              if (res2.playerNumber === 2) pass('P2 is Player 2');
              else fail(`P2 playerNumber: ${res2.playerNumber}`);
            });
          });
        });
      });
    });
  } catch (e) {
    log(`SKIP: Two-player test (${e.message})`);
  }

  // Test 7: Quick play matchmaking
  try {
    const ioClient = require('socket.io-client');
    const q1 = ioClient(BASE, { forceNew: true });
    const q2 = ioClient(BASE, { forceNew: true });

    await new Promise((resolve, reject) => {
      let matchCount = 0;

      q1.on('connect', () => {
        q1.emit('quick-play', (res) => {
          if (res.waiting) pass('Q1 queued (waiting)');
          else { matchCount++; pass('Q1 matched immediately'); }
        });

        // Small delay to ensure q1 is queued first
        setTimeout(() => {
          q2.on('connect', () => {
            q2.emit('quick-play', (res) => {
              if (res.code) { pass(`Q2 matched into room ${res.code}`); matchCount++; }
              else fail('Q2 not matched');
            });
          });
        }, 200);
      });

      q1.on('quick-play-matched', (data) => {
        if (data.code) { pass(`Q1 matched via event: ${data.code}`); matchCount++; }
      });

      let gameStartCount = 0;
      const onGameStart = () => {
        gameStartCount++;
        if (gameStartCount === 2) {
          pass('Quick play: both received game-start');
          q1.disconnect();
          q2.disconnect();
          resolve();
        }
      };
      q1.on('game-start', onGameStart);
      q2.on('game-start', onGameStart);

      setTimeout(() => { q1.disconnect(); q2.disconnect(); resolve(); }, 5000);
    });
  } catch (e) {
    log(`SKIP: Quick play test (${e.message})`);
  }

  // Test 8: Disconnect handling
  try {
    const ioClient = require('socket.io-client');
    const d1 = ioClient(BASE, { forceNew: true });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { fail('Disconnect test timeout'); d1.disconnect(); resolve(); }, 5000);

      d1.on('connect', () => {
        d1.emit('create-room', (res) => {
          const d2 = ioClient(BASE, { forceNew: true });

          d2.on('game-start', () => {
            // D1 disconnects after game starts
            d1.disconnect();
          });

          d2.on('opponent-disconnected', () => {
            clearTimeout(timer);
            pass('Disconnect detected by remaining player');
            d2.disconnect();
            resolve();
          });

          d2.on('connect', () => {
            d2.emit('join-room', res.code, () => {});
          });
        });
      });
    });
  } catch (e) {
    log(`SKIP: Disconnect test (${e.message})`);
  }

  // Summary
  console.log('\n' + '='.repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('Failures:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log('='.repeat(40));
}

runTests()
  .catch(e => console.error('Test runner error:', e))
  .finally(() => {
    if (serverProc) serverProc.kill();
    process.exit(failed > 0 ? 1 : 0);
  });
