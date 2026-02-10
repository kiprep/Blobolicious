// Input module — handles click-and-drag aiming on blobs
const Input = (() => {
  let canvas;
  let enabled = false;
  let myTeam = 'p1'; // set by game
  let dragging = null; // { blobIndex, startX, startY }
  let currentMouse = null;
  let moves = [null, null, null]; // per-blob move data

  let onAimUpdate = null; // callback for rendering aim arrow
  let onMoveSet = null;   // callback when a move is finalized

  const FORCE_SCALE = 0.00008;
  const MAX_FORCE = 0.012;

  function init(canvasEl, team) {
    canvas = canvasEl;
    myTeam = team;
    moves = [null, null, null];

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);

    // Touch support
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  }

  function enable() { enabled = true; }
  function disable() { enabled = false; dragging = null; currentMouse = null; }

  function clearMoves() { moves = [null, null, null]; }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function findBlobAt(x, y) {
    const bodies = Physics.getBodies();
    const blobs = bodies.blobs[myTeam];
    const { BLOB_R } = Physics.getDimensions();

    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      if (blob.eliminated) continue;
      const dx = blob.position.x - x;
      const dy = blob.position.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= BLOB_R + 10) {
        return i;
      }
    }
    return -1;
  }

  function calcForce(blobX, blobY, mouseX, mouseY) {
    const dx = blobX - mouseX;
    const dy = blobY - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return { fx: 0, fy: 0, power: 0 };

    let fx = dx * FORCE_SCALE;
    let fy = dy * FORCE_SCALE;
    const force = Math.sqrt(fx * fx + fy * fy);

    if (force > MAX_FORCE) {
      fx = (fx / force) * MAX_FORCE;
      fy = (fy / force) * MAX_FORCE;
    }

    const power = Math.min(force / MAX_FORCE, 1);
    return { fx, fy, power };
  }

  function onMouseDown(e) {
    if (!enabled) return;
    const pos = getCanvasPos(e);
    const blobIdx = findBlobAt(pos.x, pos.y);
    if (blobIdx === -1) return;

    const blob = Physics.getBodies().blobs[myTeam][blobIdx];
    dragging = { blobIndex: blobIdx, startX: blob.position.x, startY: blob.position.y };
    currentMouse = pos;
  }

  function onMouseMove(e) {
    if (!enabled || !dragging) return;
    currentMouse = getCanvasPos(e);
    const { fx, fy, power } = calcForce(dragging.startX, dragging.startY, currentMouse.x, currentMouse.y);

    if (onAimUpdate) {
      onAimUpdate({
        fromX: dragging.startX,
        fromY: dragging.startY,
        toX: currentMouse.x,
        toY: currentMouse.y,
        power,
      });
    }
  }

  function onMouseUp(e) {
    if (!enabled || !dragging) return;
    const pos = getCanvasPos(e);
    const { fx, fy, power } = calcForce(dragging.startX, dragging.startY, pos.x, pos.y);

    if (power > 0.05) {
      moves[dragging.blobIndex] = { blobIndex: dragging.blobIndex, fx, fy };
    } else {
      moves[dragging.blobIndex] = null; // too weak, cancel
    }

    dragging = null;
    currentMouse = null;

    if (onAimUpdate) onAimUpdate(null);
    if (onMoveSet) onMoveSet([...moves]);
  }

  // Touch handlers
  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      onMouseDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      onMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    if (e.changedTouches.length > 0) {
      onMouseUp({ clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
    }
  }

  function getMoves() { return [...moves]; }
  function setOnAimUpdate(cb) { onAimUpdate = cb; }
  function setOnMoveSet(cb) { onMoveSet = cb; }

  function destroy() {
    if (canvas) {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    }
    dragging = null;
    currentMouse = null;
    moves = [null, null, null];
  }

  return {
    init, enable, disable, clearMoves, getMoves, destroy,
    setOnAimUpdate, setOnMoveSet,
  };
})();
