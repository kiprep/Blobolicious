// AI module — simple opponent logic
const AI = (() => {
  const FORCE_SCALE = 0.008;
  const MAX_FORCE = 0.012;
  const INACCURACY = 0.3; // radians of random aim offset

  function generateMoves(aiTeam) {
    const bodies = Physics.getBodies();
    const blobs = bodies.blobs[aiTeam];
    const ball = bodies.ball;
    const { W } = Physics.getDimensions();

    // Determine which goal we're aiming for
    const targetGoalX = aiTeam === 'p1' ? -20 : W + 20;
    const targetGoalY = Physics.getDimensions().H / 2;

    const moves = [];

    blobs.forEach((blob, i) => {
      if (blob.eliminated) {
        moves.push(null);
        return;
      }

      // Find the best action: aim toward the ball
      const dx = ball.position.x - blob.position.x;
      const dy = ball.position.y - blob.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) {
        moves.push(null);
        return;
      }

      // Normalize direction toward ball
      let nx = dx / dist;
      let ny = dy / dist;

      // Add some inaccuracy
      const offset = (Math.random() - 0.5) * INACCURACY;
      const cos = Math.cos(offset);
      const sin = Math.sin(offset);
      const rnx = nx * cos - ny * sin;
      const rny = nx * sin + ny * cos;

      // Force magnitude — closer blobs hit harder
      const power = Math.min(FORCE_SCALE / Math.max(dist * 0.003, 0.01), MAX_FORCE);

      moves.push({
        blobIndex: i,
        fx: rnx * power,
        fy: rny * power,
      });
    });

    return moves;
  }

  return { generateMoves };
})();
