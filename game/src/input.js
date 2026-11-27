// Keyboard, mouse and touch input. The plane is steered three ways:
// Arrow keys / WASD (climb, descend, throttle), the mouse (the plane chases
// the pointer's height), and touch drag (same as the mouse). Space boosts,
// P pauses, M mutes, Enter/Space/click confirms on the title and game-over
// screens. All actions are consumed once per frame by takeActions().

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_BOOST = 8;

const KEYMAP = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'slow',
  KeyA: 'slow',
  ArrowRight: 'fast',
  KeyD: 'fast',
};

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{
 *   climb: () => number, throttle: () => number, boostHeld: () => boolean,
 *   pointerActive: () => boolean, pointerY: () => number,
 *   takeActions: () => number, attach: () => void
 * }}
 */
export function createInput(canvas) {
  const held = { up: false, down: false, slow: false, fast: false };
  let boost = false;
  let actions = 0;
  let pointerY = null;
  let pointerDown = false;

  function keyDown(event) {
    if (event.repeat) return;
    const name = KEYMAP[event.code];
    if (name) {
      held[name] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Space') {
      boost = true;
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
  }

  function keyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
    if (event.code === 'Space') boost = false;
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointerY = ((event.clientY - rect.top) / rect.height) * 720;
  }

  function pointerStart(event) {
    pointerDown = true;
    pointerMove(event);
    actions |= ACTION_CONFIRM;
  }

  function pointerEnd() {
    pointerDown = false;
    pointerY = null;
  }

  return {
    attach() {
      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
      canvas.addEventListener('pointermove', pointerMove);
      canvas.addEventListener('pointerdown', pointerStart);
      canvas.addEventListener('pointerup', pointerEnd);
      canvas.addEventListener('pointercancel', pointerEnd);
      canvas.addEventListener('pointerleave', pointerEnd);
    },
    /** -1 climb, +1 descend, 0 level — from keys, else from the pointer. */
    climb() {
      if (held.up) return -1;
      if (held.down) return 1;
      if (pointerY !== null) {
        const dy = pointerY - 300;
        if (dy < -14) return -1;
        if (dy > 14) return 1;
      }
      return 0;
    },
    /** -1 slower, +1 faster, 0 cruise. */
    throttle() {
      if (held.fast) return 1;
      if (held.slow) return -1;
      return 0;
    },
    boostHeld() {
      return boost;
    },
    pointerActive() {
      return pointerDown;
    },
    pointerY() {
      return pointerY;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
