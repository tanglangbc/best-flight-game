// Every tuning number and colour for Runway Rings in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, groundBase: 648 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The plane sits at this x; the world scrolls past it. */
export const PLANE_X = 300;

export const PLANE = {
  radius: 20,
  climbAccel: 1500,
  descendAccel: 1700,
  gravity: 420,
  maxClimb: 380,
  maxDescend: 420,
  baseSpeed: 250,
  speedPerLevel: 22,
  maxSpeed: 520,
  boostMultiplier: 1.45,
  invulnerable: 2.0,
  trailEvery: 0.05,
};

export const LIVES = 3;

export const RING = {
  radius: 48,
  hitRadius: 40,
  spacing: 720,
  spacingJitter: 260,
  points: 100,
  minY: 130,
  maxY: 540,
};

export const STAR = {
  radius: 13,
  points: 25,
  perGap: 3,
};

export const OBSTACLE = {
  balloonRadius: 30,
  birdSpeed: 120,
  cloudRadius: 52,
  /** Chance an obstacle spawns in a ring gap, grows with level. */
  baseChance: 0.35,
  chancePerLevel: 0.06,
  maxChance: 0.8,
};

/** Seconds of play per level; speeds and spawn rates stop growing at max. */
export const LEVEL = { ringsPerLevel: 8, max: 10 };

/** Combo multiplier caps here (x5). */
export const COMBO_MAX = 5;

/** How many obstacles, rings, stars and particles can exist at once. */
export const POOL_SIZE = 96;

export const PALETTE = {
  skyTop: '#274b8f',
  skyMid: '#7fb4e8',
  skyLow: '#ffd9a0',
  sun: '#fff3c4',
  sunGlow: 'rgba(255, 214, 130, 0.55)',
  mountainFar: '#6d7fb0',
  mountainNear: '#4c6b52',
  hill: '#5d9b4f',
  ground: '#3e7d32',
  groundDark: '#2f6126',
  runway: '#3a3f4a',
  runwayLine: '#f5f0dc',
  cloud: 'rgba(255, 255, 255, 0.92)',
  planeBody: '#e8442e',
  planeBelly: '#f8f4ec',
  planeWing: '#c93320',
  planeGlass: '#bfe9ff',
  ring: '#ffc93c',
  ringGlow: 'rgba(255, 201, 60, 0.45)',
  star: '#ffe066',
  balloon: '#e84a7a',
  balloonBasket: '#7a4a21',
  bird: '#2b2b33',
  storm: '#5b6478',
  hudPanel: 'rgba(12, 20, 38, 0.62)',
  hudText: '#ffffff',
  hudAccent: '#ffd34d',
  hudDanger: '#ff5a4e',
  panel: 'rgba(10, 18, 36, 0.78)',
  text: '#f4f7fb',
  muted: '#b9c4d6',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'runway-rings.best';
