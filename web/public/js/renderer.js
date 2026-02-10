// Renderer module — draws game state to canvas
const Renderer = (() => {
  let canvas, ctx;

  const COLORS = {
    field: '#2d6a4f',
    fieldLine: 'rgba(255,255,255,0.15)',
    wall: '#1a1a2e',
    goalLeft: 'rgba(231, 76, 60, 0.3)',
    goalRight: 'rgba(52, 152, 219, 0.3)',
    goalPostLeft: '#e74c3c',
    goalPostRight: '#3498db',
    p1Fill: '#e74c3c',
    p1Stroke: '#c0392b',
    p2Fill: '#3498db',
    p2Stroke: '#2980b9',
    p1Eliminated: 'rgba(231,76,60,0.2)',
    p2Eliminated: 'rgba(52,152,219,0.2)',
    ball: '#f1c40f',
    ballStroke: '#d4ac0d',
    arrow: 'rgba(255,255,255,0.8)',
    arrowPower: '#e94560',
  };

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    const dims = Physics.getDimensions();
    canvas.width = dims.W;
    canvas.height = dims.H;
  }

  function clear() {
    const { W, H } = Physics.getDimensions();
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(0, 0, W, H);
  }

  function drawFieldMarkings() {
    const { W, H } = Physics.getDimensions();
    ctx.strokeStyle = COLORS.fieldLine;
    ctx.lineWidth = 2;

    // Center line
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = COLORS.fieldLine;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWalls() {
    const { W, H, WALL_T, GOAL_W, GOAL_H } = Physics.getDimensions();
    const goalTop = (H - GOAL_H) / 2;
    const goalBottom = (H + GOAL_H) / 2;

    ctx.fillStyle = COLORS.wall;

    // Top and bottom
    ctx.fillRect(0, -WALL_T, W, WALL_T);
    ctx.fillRect(0, H, W, WALL_T);

    // Left wall sections
    ctx.fillRect(-WALL_T, 0, WALL_T, goalTop);
    ctx.fillRect(-WALL_T, goalBottom, WALL_T, H - goalBottom);

    // Right wall sections
    ctx.fillRect(W, 0, WALL_T, goalTop);
    ctx.fillRect(W, goalBottom, WALL_T, H - goalBottom);
  }

  function drawGoals() {
    const { W, H, GOAL_W, GOAL_H } = Physics.getDimensions();
    const goalTop = (H - GOAL_H) / 2;

    // Left goal area
    ctx.fillStyle = COLORS.goalLeft;
    ctx.fillRect(-GOAL_W, goalTop, GOAL_W, GOAL_H);

    // Left goal posts
    ctx.strokeStyle = COLORS.goalPostLeft;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, goalTop);
    ctx.lineTo(-GOAL_W, goalTop);
    ctx.lineTo(-GOAL_W, goalTop + GOAL_H);
    ctx.lineTo(0, goalTop + GOAL_H);
    ctx.stroke();

    // Right goal area
    ctx.fillStyle = COLORS.goalRight;
    ctx.fillRect(W, goalTop, GOAL_W, GOAL_H);

    // Right goal posts
    ctx.strokeStyle = COLORS.goalPostRight;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W, goalTop);
    ctx.lineTo(W + GOAL_W, goalTop);
    ctx.lineTo(W + GOAL_W, goalTop + GOAL_H);
    ctx.lineTo(W, goalTop + GOAL_H);
    ctx.stroke();
  }

  function drawBlob(blob, team) {
    const { BLOB_R } = Physics.getDimensions();
    if (blob.eliminated) {
      ctx.globalAlpha = 0.25;
    }

    ctx.fillStyle = team === 'p1' ? COLORS.p1Fill : COLORS.p2Fill;
    ctx.strokeStyle = team === 'p1' ? COLORS.p1Stroke : COLORS.p2Stroke;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(blob.position.x, blob.position.y, BLOB_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Team indicator number
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(blob.blobIndex + 1, blob.position.x, blob.position.y);

    ctx.globalAlpha = 1;
  }

  function drawBall(ball) {
    const { BALL_R } = Physics.getDimensions();
    ctx.fillStyle = COLORS.ball;
    ctx.strokeStyle = COLORS.ballStroke;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawAimArrow(fromX, fromY, toX, toY, power) {
    // Arrow points in the shot direction (opposite of drag)
    const dx = fromX - toX;
    const dy = fromY - toY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;

    const nx = dx / len;
    const ny = dy / len;
    const arrowLen = 30 + power * 40; // scale with power

    const tipX = fromX + nx * arrowLen;
    const tipY = fromY + ny * arrowLen;

    // Line
    ctx.strokeStyle = COLORS.arrow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Arrowhead
    const headLen = 10;
    const angle = Math.atan2(ny, nx);
    ctx.fillStyle = COLORS.arrowPower;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - headLen * Math.cos(angle - 0.4), tipY - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(tipX - headLen * Math.cos(angle + 0.4), tipY - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();

    // Power indicator dot
    const dotRadius = 3 + power * 4;
    ctx.fillStyle = COLORS.arrowPower;
    ctx.beginPath();
    ctx.arc(fromX, fromY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMoveIndicator(blob, move) {
    // Show a small arrow on blobs that have moves set
    if (!move || blob.eliminated) return;
    const { BLOB_R } = Physics.getDimensions();

    const fx = move.fx;
    const fy = move.fy;
    const force = Math.sqrt(fx * fx + fy * fy);
    if (force < 0.0001) return;

    const nx = fx / force;
    const ny = fy / force;
    const arrowLen = BLOB_R + 15;

    const tipX = blob.position.x + nx * arrowLen;
    const tipY = blob.position.y + ny * arrowLen;

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(blob.position.x + nx * BLOB_R, blob.position.y + ny * BLOB_R);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }

  function render(gameState) {
    clear();
    drawFieldMarkings();
    drawGoals();
    drawWalls();

    const bodies = Physics.getBodies();

    // Draw blobs
    for (const team of ['p1', 'p2']) {
      bodies.blobs[team].forEach((blob, i) => {
        drawBlob(blob, team);
        // Draw move indicators for set moves
        if (gameState && gameState.moves) {
          const teamMoves = gameState.moves[team] || [];
          const move = teamMoves.find(m => m && m.blobIndex === i);
          drawMoveIndicator(blob, move);
        }
      });
    }

    // Draw ball
    if (bodies.ball) {
      drawBall(bodies.ball);
    }

    // Draw active aiming arrow
    if (gameState && gameState.aiming) {
      const a = gameState.aiming;
      drawAimArrow(a.fromX, a.fromY, a.toX, a.toY, a.power);
    }
  }

  return { init, render };
})();
