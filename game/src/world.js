// The flight itself: the plane, the scrolling terrain, rings, stars and
// hazards, scoring, lives and levels. Everything is deterministic for a
// given seed: the same seed always flies the same course.
//
// Coordinates: the plane sits at a fixed screen x (PLANE_X) and the world
// scrolls past it. Entities live in world-x; screen x is world-x minus the
// distance flown. Terrain is a chain of control points every 240 px, joined
// with smooth cosine interpolation, with a flat runway stretch every 3,600 px.

import {
  FIELD, PLANE, PLANE_X, RING, STAR, OBSTACLE, LEVEL, LIVES, COMBO_MAX, POOL_SIZE,
} from './config.js';

export const EVENT_CRASH = 1;
export const EVENT_RING = 2;
export const EVENT_STAR = 4;
export const EVENT_OVER = 8;
export const EVENT_LEVEL = 16;

const TERRAIN_STEP = 240;
const RUNWAY_EVERY = 3600;
const RUNWAY_AT = 1200;
const RUNWAY_LEN = 620;

/** A flat runway stretch, or a rolling hill. */
function terrainPointHeight(random, worldX) {
  const inRunway = ((worldX % RUNWAY_EVERY) + RUNWAY_EVERY) % RUNWAY_EVERY;
  if (inRunway >= RUNWAY_AT && inRunway < RUNWAY_AT + RUNWAY_LEN) return FIELD.groundBase;
  return random.range(575, FIELD.groundBase);
}

/** Smooth (cosine) interpolation between two control heights. */
function smooth(a, b, t) {
  const u = (1 - Math.cos(t * Math.PI)) / 2;
  return a + (b - a) * u;
}

export function createWorld(random) {
  const state = {
    distance: 0,
    time: 0,
    speed: PLANE.baseSpeed,
    plane: { y: 320, vy: 0 },
    score: 0,
    ringsHit: 0,
    ringsMissed: 0,
    stars: 0,
    combo: 0,
    bestCombo: 0,
    lives: LIVES,
    level: 1,
    invulnerable: 0,
    over: false,
    trailTimer: 0,
    nextRingX: 0,
    prevRingY: 300,
    rings: [],
    starItems: [],
    obstacles: [],
    particles: [],
    clouds: [],
    terrain: [],
    terrainUntil: 0,
    flash: 0,
    message: '',
    messageTimer: 0,
  };

  function ensureTerrain(untilX) {
    while (state.terrainUntil < untilX) {
      const x = state.terrainUntil;
      const h = terrainPointHeight(random, x);
      state.terrain.push({ x, h });
      state.terrainUntil += TERRAIN_STEP;
    }
    while (state.terrain.length > 2 && state.terrain[1].x < state.distance - 400) {
      state.terrain.shift();
    }
  }

  /** Ground height at a world-x, from the control points. */
  function terrainHeightAt(worldX) {
    const points = state.terrain;
    if (points.length === 0) return FIELD.groundBase;
    let index = 0;
    while (index < points.length - 2 && points[index + 1].x <= worldX) index += 1;
    const a = points[index];
    const b = points[Math.min(index + 1, points.length - 1)];
    const span = Math.max(1, b.x - a.x);
    const t = Math.min(1, Math.max(0, (worldX - a.x) / span));
    return smooth(a.h, b.h, t);
  }

  /** True while the given world-x lies on a runway stretch. */
  function isRunwayAt(worldX) {
    const inRunway = ((worldX % RUNWAY_EVERY) + RUNWAY_EVERY) % RUNWAY_EVERY;
    return inRunway >= RUNWAY_AT && inRunway < RUNWAY_AT + RUNWAY_LEN;
  }

  function spawnClouds() {
    state.clouds = [];
    for (let i = 0; i < 14; i += 1) {
      state.clouds.push({
        x: random.range(0, FIELD.width * 2),
        y: random.range(40, 260),
        scale: random.range(0.6, 1.6),
        drift: random.range(8, 26),
      });
    }
  }

  function spawnRing(worldX) {
    const y = Math.min(
      RING.maxY,
      Math.max(RING.minY, state.prevRingY + random.range(-210, 210)),
    );
    state.rings.push({ x: worldX, y, passed: false, hit: false, sparkle: 0 });
    state.prevRingY = y;
    return y;
  }

  function spawnStars(fromX, toX, ringY) {
    for (let i = 0; i < STAR.perGap; i += 1) {
      const t = (i + 1) / (STAR.perGap + 1);
      const x = fromX + (toX - fromX) * t;
      const y = Math.min(560, Math.max(110, ringY + Math.sin(t * Math.PI * 2) * random.range(40, 110)));
      state.starItems.push({ x, y, taken: false, phase: random.range(0, Math.PI * 2) });
    }
  }

  function spawnObstacle(gapStartX, gapEndX) {
    const chance = Math.min(OBSTACLE.maxChance, OBSTACLE.baseChance + (state.level - 1) * OBSTACLE.chancePerLevel);
    if (random.next() > chance) return;
    const kind = random.pick(['balloon', 'balloon', 'bird', 'storm']);
    const x = random.range(gapStartX + 120, gapEndX - 120);
    if (kind === 'balloon') {
      state.obstacles.push({ kind, x, y: random.range(160, 500), baseY: 0, radius: OBSTACLE.balloonRadius, phase: random.range(0, Math.PI * 2) });
      state.obstacles[state.obstacles.length - 1].baseY = state.obstacles[state.obstacles.length - 1].y;
    } else if (kind === 'bird') {
      state.obstacles.push({ kind, x, y: random.range(140, 480), radius: 16, phase: random.range(0, Math.PI * 2) });
    } else {
      state.obstacles.push({ kind, x, y: random.range(100, 210), radius: OBSTACLE.cloudRadius, phase: random.range(0, Math.PI * 2) });
    }
  }

  function burst(x, y, count, color, speed) {
    for (let i = 0; i < count && state.particles.length < POOL_SIZE; i += 1) {
      const angle = random.range(0, Math.PI * 2);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: random.range(0.4, 0.9),
        maxLife: 0.9,
        size: random.range(3, 8),
        color,
      });
    }
  }

  function crash() {
    if (state.invulnerable > 0 || state.over) return EVENT_CRASH;
    state.lives -= 1;
    state.combo = 0;
    state.invulnerable = PLANE.invulnerable;
    state.flash = 0.35;
    state.speed = PLANE.baseSpeed * 0.6;
    state.plane.vy = -260;
    burst(PLANE_X, state.plane.y, 26, '#ff7a3c', 260);
    burst(PLANE_X, state.plane.y, 14, '#5b6478', 180);
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_CRASH | EVENT_OVER;
    }
    return EVENT_CRASH;
  }

  function reset() {
    state.distance = 0;
    state.time = 0;
    state.speed = PLANE.baseSpeed;
    state.plane.y = 320;
    state.plane.vy = 0;
    state.score = 0;
    state.ringsHit = 0;
    state.ringsMissed = 0;
    state.stars = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.lives = LIVES;
    state.level = 1;
    state.invulnerable = 0;
    state.over = false;
    state.trailTimer = 0;
    state.nextRingX = 900;
    state.prevRingY = 300;
    state.rings = [];
    state.starItems = [];
    state.obstacles = [];
    state.particles = [];
    state.terrain = [];
    state.terrainUntil = 0;
    state.flash = 0;
    state.message = '';
    state.messageTimer = 0;
    ensureTerrain(2200);
    spawnClouds();
    let prevX = 0;
    while (state.nextRingX < 2000) {
      const y = spawnRing(state.nextRingX);
      spawnStars(prevX + 200, state.nextRingX, y);
      spawnObstacle(prevX + 200, state.nextRingX);
      prevX = state.nextRingX;
      state.nextRingX += RING.spacing + random.range(-RING.spacingJitter, RING.spacingJitter);
    }
  }

  /**
   * Advance the world one fixed step.
   * @param {number} dt step seconds
   * @param {{ climb: number, throttle: number, boost: boolean }} control
   * @param {boolean} attract title-screen demo flight: no scoring, no crashes
   * @returns {number} event bitmask
   */
  function step(dt, control, attract) {
    state.time += dt;
    if (state.flash > 0) state.flash -= dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.invulnerable > 0) state.invulnerable -= dt;

    // On the title screen the plane flies itself, holding a gentle cruise
    // altitude so it stays in frame instead of sinking to the ground.
    if (attract) {
      control = {
        climb: state.plane.y > 310 ? -1 : state.plane.y < 290 ? 1 : 0,
        throttle: 0,
        boost: false,
      };
    }

    // Speed: base grows with level, throttle nudges it, boost multiplies it.
    let target = Math.min(PLANE.maxSpeed, PLANE.baseSpeed + (state.level - 1) * PLANE.speedPerLevel);
    target += control.throttle * 70;
    if (control.boost) target *= PLANE.boostMultiplier;
    state.speed += (target - state.speed) * Math.min(1, dt * 2.5);
    state.distance += state.speed * dt;

    // Vertical flight: climb/descent input against gravity, capped.
    const plane = state.plane;
    if (control.climb < 0) plane.vy -= PLANE.climbAccel * dt;
    else if (control.climb > 0) plane.vy += PLANE.descendAccel * dt;
    else plane.vy += PLANE.gravity * 0.35 * dt;
    plane.vy += PLANE.gravity * dt * 0.55;
    plane.vy = Math.max(-PLANE.maxClimb, Math.min(PLANE.maxDescend, plane.vy));
    plane.y += plane.vy * dt;
    if (plane.y < 46) {
      plane.y = 46;
      plane.vy = Math.max(0, plane.vy);
    }
    if (plane.y > FIELD.height - 8) {
      plane.y = FIELD.height - 8;
      plane.vy = Math.min(0, plane.vy);
    }

    // Smoke trail.
    state.trailTimer -= dt;
    if (state.trailTimer <= 0 && !attract) {
      state.trailTimer = PLANE.trailEvery;
      if (state.particles.length < POOL_SIZE) {
        state.particles.push({
          x: PLANE_X - 34, y: plane.y + 4,
          vx: -60 - state.speed * 0.25, vy: random.range(-8, 8),
          life: 0.55, maxLife: 0.55, size: random.range(3, 6), color: 'rgba(255,255,255,0.5)',
        });
      }
    }

    ensureTerrain(state.distance + 2200);

    // Spawn the next ring, stars and maybe a hazard ahead of the screen.
    while (state.nextRingX < state.distance + FIELD.width + 500) {
      const prevX = state.nextRingX - (RING.spacing + random.range(-RING.spacingJitter, RING.spacingJitter));
      const y = spawnRing(state.nextRingX);
      spawnStars(Math.max(prevX, state.distance), state.nextRingX, y);
      spawnObstacle(Math.max(prevX, state.distance) + 100, state.nextRingX);
      state.nextRingX += RING.spacing + random.range(-RING.spacingJitter, RING.spacingJitter);
    }

    // Clouds drift slowly (parallax) and wrap around.
    for (const cloud of state.clouds) {
      cloud.x -= (state.speed * 0.18 + cloud.drift) * dt;
      if (cloud.x < -180) {
        cloud.x = FIELD.width + random.range(40, 300);
        cloud.y = random.range(40, 260);
        cloud.scale = random.range(0.6, 1.6);
      }
    }

    // Particles age.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    let events = 0;
    const groundAtPlane = terrainHeightAt(state.distance + PLANE_X);

    // Rings: flown through, or missed.
    for (const ring of state.rings) {
      const sx = ring.x - state.distance;
      if (ring.passed) continue;
      if (Math.abs(sx - PLANE_X) < RING.hitRadius && Math.abs(plane.y - ring.y) < RING.hitRadius) {
        ring.passed = true;
        ring.hit = true;
        ring.sparkle = 0.6;
        if (!attract) {
          state.ringsHit += 1;
          state.combo += 1;
          state.bestCombo = Math.max(state.bestCombo, state.combo);
          const mult = Math.min(state.combo, COMBO_MAX);
          state.score += RING.points * mult;
          events |= EVENT_RING;
          burst(PLANE_X, ring.y, 12, '#ffc93c', 200);
          const newLevel = Math.min(LEVEL.max, Math.floor(state.ringsHit / LEVEL.ringsPerLevel) + 1);
          if (newLevel > state.level) {
            state.level = newLevel;
            state.message = `LEVEL ${newLevel} — FASTER!`;
            state.messageTimer = 2.2;
            events |= EVENT_LEVEL;
          }
        }
      } else if (sx < PLANE_X - RING.radius - 10) {
        ring.passed = true;
        if (!attract) {
          state.ringsMissed += 1;
          state.combo = 0;
        }
      }
      if (ring.sparkle > 0) ring.sparkle -= dt;
    }

    // Stars.
    for (const star of state.starItems) {
      if (star.taken) continue;
      const sx = star.x - state.distance;
      const dx = sx - PLANE_X;
      const dy = star.y - plane.y;
      if (dx * dx + dy * dy < (STAR.radius + PLANE.radius) * (STAR.radius + PLANE.radius)) {
        star.taken = true;
        if (!attract) {
          state.stars += 1;
          state.score += STAR.points;
          events |= EVENT_STAR;
          burst(sx, star.y, 6, '#ffe066', 140);
        }
      }
    }

    // Hazards: balloons bob, birds fly left, storm clouds hang low.
    for (const ob of state.obstacles) {
      if (ob.kind === 'balloon') ob.y = ob.baseY + Math.sin(state.time * 1.4 + ob.phase) * 18;
      else if (ob.kind === 'bird') ob.x -= OBSTACLE.birdSpeed * dt;
      else ob.y += Math.sin(state.time * 0.8 + ob.phase) * 6 * dt;
      const sx = ob.x - state.distance;
      if (!attract && state.invulnerable <= 0) {
        const dx = sx - PLANE_X;
        const dy = ob.y - plane.y;
        const rr = ob.radius + PLANE.radius - 6;
        if (dx * dx + dy * dy < rr * rr) events |= crash();
      }
    }

    // Terrain: the ground (and the runway flats) are solid.
    if (!attract && state.invulnerable <= 0 && plane.y + PLANE.radius - 4 > groundAtPlane) {
      events |= crash();
    }

    // Drop anything far behind the plane.
    const behind = state.distance - 200;
    state.rings = state.rings.filter((r) => r.x > behind);
    state.starItems = state.starItems.filter((s) => s.x > behind);
    state.obstacles = state.obstacles.filter((o) => o.x > behind - 300);

    return events;
  }

  reset();

  return {
    state,
    reset,
    step,
    terrainHeightAt,
    isRunwayAt,
    /** Flight readouts for the HUD. */
    readouts() {
      const alt = Math.max(0, Math.round((FIELD.groundBase - state.plane.y) * 8));
      const knots = Math.round(state.speed * 0.92);
      const heading = 90 + Math.round((state.plane.vy / PLANE.maxClimb) * 14);
      return {
        alt, knots, heading,
        distanceKm: state.distance / 100,
        score: state.score,
        rings: state.ringsHit,
        combo: state.combo,
        lives: state.lives,
        level: state.level,
      };
    },
  };
}
