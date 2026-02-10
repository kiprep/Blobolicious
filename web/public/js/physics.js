// Physics module — wraps Matter.js
const Physics = (() => {
  // We load Matter.js from CDN in index.html, accessed via window.Matter
  let engine, world, runner;

  // Game dimensions
  const W = 960;
  const H = 600;
  const WALL_T = 20;     // wall thickness
  const GOAL_W = 20;     // goal trigger width
  const GOAL_H = 160;    // goal opening height
  const BLOB_R = 20;     // blob radius
  const BALL_R = 15;     // ball radius

  let bodies = {
    blobs: { p1: [], p2: [] },
    ball: null,
    walls: [],
    goals: { left: null, right: null },
  };

  let onGoal = null;       // callback(goalSide)  'left' or 'right'
  let onBlobEliminated = null; // callback(player, index)

  const BLOB_POSITIONS = {
    p1: [
      { x: W * 0.75, y: H / 2 - 80 },
      { x: W * 0.75, y: H / 2 + 80 },
      { x: W * 0.7, y: H / 2 },
    ],
    p2: [
      { x: W * 0.25, y: H / 2 - 80 },
      { x: W * 0.25, y: H / 2 + 80 },
      { x: W * 0.3, y: H / 2 },
    ],
  };

  function init() {
    const Matter = window.Matter;
    engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
    world = engine.world;

    createWalls();
    createGoals();
    createBlobs();
    createBall();

    // Collision detection for goals
    Matter.Events.on(engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        handleCollision(pair.bodyA, pair.bodyB);
        handleCollision(pair.bodyB, pair.bodyA);
      }
    });

    return { engine, world };
  }

  function createWalls() {
    const Matter = window.Matter;
    const opts = { isStatic: true, restitution: 0.8, friction: 0, label: 'wall' };

    const goalTop = (H - GOAL_H) / 2;
    const goalBottom = (H + GOAL_H) / 2;

    // Top wall
    bodies.walls.push(Matter.Bodies.rectangle(W / 2, -WALL_T / 2, W, WALL_T, opts));
    // Bottom wall
    bodies.walls.push(Matter.Bodies.rectangle(W / 2, H + WALL_T / 2, W, WALL_T, opts));

    // Left wall — top section (above goal)
    bodies.walls.push(Matter.Bodies.rectangle(-WALL_T / 2, goalTop / 2, WALL_T, goalTop, opts));
    // Left wall — bottom section (below goal)
    bodies.walls.push(Matter.Bodies.rectangle(-WALL_T / 2, (goalBottom + H) / 2, WALL_T, H - goalBottom, opts));

    // Right wall — top section (above goal)
    bodies.walls.push(Matter.Bodies.rectangle(W + WALL_T / 2, goalTop / 2, WALL_T, goalTop, opts));
    // Right wall — bottom section (below goal)
    bodies.walls.push(Matter.Bodies.rectangle(W + WALL_T / 2, (goalBottom + H) / 2, WALL_T, H - goalBottom, opts));

    // Back walls behind goals to catch the ball
    bodies.walls.push(Matter.Bodies.rectangle(-GOAL_W - WALL_T / 2, H / 2, WALL_T, GOAL_H + WALL_T, opts));
    bodies.walls.push(Matter.Bodies.rectangle(W + GOAL_W + WALL_T / 2, H / 2, WALL_T, GOAL_H + WALL_T, opts));
    // Goal top/bottom edges
    bodies.walls.push(Matter.Bodies.rectangle(-GOAL_W / 2, goalTop - WALL_T / 2, GOAL_W, WALL_T, opts));
    bodies.walls.push(Matter.Bodies.rectangle(-GOAL_W / 2, goalBottom + WALL_T / 2, GOAL_W, WALL_T, opts));
    bodies.walls.push(Matter.Bodies.rectangle(W + GOAL_W / 2, goalTop - WALL_T / 2, GOAL_W, WALL_T, opts));
    bodies.walls.push(Matter.Bodies.rectangle(W + GOAL_W / 2, goalBottom + WALL_T / 2, GOAL_W, WALL_T, opts));

    Matter.Composite.add(world, bodies.walls);
  }

  function createGoals() {
    const Matter = window.Matter;
    const goalOpts = { isStatic: true, isSensor: true, label: 'goal' };

    bodies.goals.left = Matter.Bodies.rectangle(-GOAL_W / 2, H / 2, GOAL_W, GOAL_H, {
      ...goalOpts, label: 'goal-left',
    });
    bodies.goals.right = Matter.Bodies.rectangle(W + GOAL_W / 2, H / 2, GOAL_W, GOAL_H, {
      ...goalOpts, label: 'goal-right',
    });

    Matter.Composite.add(world, [bodies.goals.left, bodies.goals.right]);
  }

  function createBlobs() {
    const Matter = window.Matter;
    const blobOpts = {
      restitution: 0.6,
      friction: 0.05,
      frictionAir: 0.02,
      density: 0.002,
    };

    for (const team of ['p1', 'p2']) {
      bodies.blobs[team] = BLOB_POSITIONS[team].map((pos, i) => {
        const blob = Matter.Bodies.circle(pos.x, pos.y, BLOB_R, {
          ...blobOpts,
          label: `blob-${team}-${i}`,
        });
        blob.team = team;
        blob.blobIndex = i;
        blob.eliminated = false;
        return blob;
      });
      Matter.Composite.add(world, bodies.blobs[team]);
    }
  }

  function createBall() {
    const Matter = window.Matter;
    bodies.ball = Matter.Bodies.circle(W / 2, H / 2, BALL_R, {
      restitution: 0.8,
      friction: 0.02,
      frictionAir: 0.015,
      density: 0.001,
      label: 'ball',
    });
    Matter.Composite.add(world, [bodies.ball]);
  }

  function handleCollision(bodyA, bodyB) {
    // Ball entering a goal
    if (bodyA.label === 'ball' && bodyB.label.startsWith('goal-')) {
      const side = bodyB.label === 'goal-left' ? 'left' : 'right';
      if (onGoal) onGoal(side);
    }

    // Blob entering a goal
    if (bodyA.label.startsWith('blob-') && bodyB.label.startsWith('goal-') && !bodyA.eliminated) {
      bodyA.eliminated = true;
      // Hide it by moving off-screen and making static
      const Matter = window.Matter;
      Matter.Body.setStatic(bodyA, true);
      Matter.Body.setPosition(bodyA, { x: -200, y: -200 });
      if (onBlobEliminated) onBlobEliminated(bodyA.team, bodyA.blobIndex);
    }
  }

  function applyMoves(moves) {
    // moves: { p1: [{blobIndex, fx, fy}, ...], p2: [...] }
    const Matter = window.Matter;
    for (const team of ['p1', 'p2']) {
      const teamMoves = moves[team] || [];
      for (const move of teamMoves) {
        if (!move) continue;
        const blob = bodies.blobs[team][move.blobIndex];
        if (!blob || blob.eliminated) continue;
        Matter.Body.applyForce(blob, blob.position, { x: move.fx, y: move.fy });
      }
    }
  }

  function step(delta) {
    const Matter = window.Matter;
    Matter.Engine.update(engine, delta);
  }

  function isSettled() {
    const Matter = window.Matter;
    const allBodies = [
      ...bodies.blobs.p1.filter(b => !b.eliminated),
      ...bodies.blobs.p2.filter(b => !b.eliminated),
      bodies.ball,
    ].filter(Boolean);

    return allBodies.every(b => {
      const speed = Math.sqrt(b.velocity.x ** 2 + b.velocity.y ** 2);
      return speed < 0.15;
    });
  }

  function reset() {
    const Matter = window.Matter;

    // Reset blobs to starting positions
    for (const team of ['p1', 'p2']) {
      bodies.blobs[team].forEach((blob, i) => {
        blob.eliminated = false;
        Matter.Body.setStatic(blob, false);
        Matter.Body.setPosition(blob, BLOB_POSITIONS[team][i]);
        Matter.Body.setVelocity(blob, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(blob, 0);
      });
    }

    // Reset ball
    Matter.Body.setPosition(bodies.ball, { x: W / 2, y: H / 2 });
    Matter.Body.setVelocity(bodies.ball, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(bodies.ball, 0);
  }

  function destroy() {
    if (engine) {
      const Matter = window.Matter;
      Matter.Engine.clear(engine);
      engine = null;
      world = null;
    }
  }

  function getBodies() { return bodies; }
  function getDimensions() { return { W, H, WALL_T, GOAL_W, GOAL_H, BLOB_R, BALL_R }; }
  function setOnGoal(cb) { onGoal = cb; }
  function setOnBlobEliminated(cb) { onBlobEliminated = cb; }

  return {
    init, step, applyMoves, isSettled, reset, destroy,
    getBodies, getDimensions,
    setOnGoal, setOnBlobEliminated,
    BLOB_POSITIONS,
  };
})();
