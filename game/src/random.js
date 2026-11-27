// A small seeded random source (mulberry32) so a ?seed=N run is identical
// every time: the same seed always stages the same screenshot scene.

/**
 * Build a random-number generator from a 32-bit seed.
 * @returns {{ next: () => number, range: (min: number, max: number) => number, pick: <T>(items: T[]) => T }}
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
