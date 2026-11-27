// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (aim for the next ring, climb away from the ground, dodge
// the nearest hazard), so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { FIELD, PLANE_X, STEP, RING } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 30;
const END_LIMIT_SECONDS = 600;
/**
 * How far ahead, in seconds, the autopilot looks for a hazard: the play
 * scene's pilot looks well ahead and keeps all its lives; the end scene's
 * looks only a moment ahead, so it is caught out once the course speeds up.
 */
const HORIZON_PLAY = 0.8;
const HORIZON_END = 0.3;

/** The next ring the plane has not passed yet, or null. */
function nextRing(state) {
  for (const ring of state.rings) {
    if (!ring.passed && ring.x - state.distance > PLANE_X - 40) return ring;
  }
  return null;
}

/** The nearest hazard ahead of the plane within the look-ahead window. */
function hazardAhead(state, horizonSeconds) {
  const ahead = state.speed * horizonSeconds;
  let nearest = null;
  for (const ob of state.obstacles) {
    const sx = ob.x - state.distance;
    if (sx > PLANE_X && sx < PLANE_X + ahead) {
      if (nearest === null || sx < nearest.x - state.distance) nearest = ob;
    }
  }
  return nearest;
}

/**
 * Steer toward the next ring, climb out of a hazard's way, and never scrape
 * the ground: returns the control the autopilot would hold this step.
 */
function autopilot(world, horizon) {
  const state = world.state;
  const plane = state.plane;
  const groundY = world.terrainHeightAt(state.distance + PLANE_X);
  let targetY = 300;

  const ring = nextRing(state);
  if (ring) targetY = ring.y;

  const hazard = hazardAhead(state, horizon);
  if (hazard) {
    // Climb over it, or duck under it, whichever side the plane is on.
    const clearance = hazard.radius + 70;
    targetY = plane.y <= hazard.y ? hazard.y - clearance : hazard.y + clearance;
  }
  // Never fly into the hillside.
  if (plane.y > groundY - 90) targetY = groundY - 170;
  // Never clip the top of the screen.
  if (plane.y < 90) targetY = 160;

  const climb = targetY < plane.y - 12 ? -1 : targetY > plane.y + 12 ? 1 : 0;
  return { climb, throttle: 0, boost: false };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { climb: 0, throttle: 0, boost: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.step(STEP, autopilot(world, horizon), false) & EVENT_OVER) break;
  }
  // The last crash leaves a red flash over the frame; clear it so the
  // game-over scene is not tinted.
  world.state.flash = 0;
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
