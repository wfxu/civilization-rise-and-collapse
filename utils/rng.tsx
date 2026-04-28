// ============== Deterministic RNG + Value Noise ==============

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise2D(rng: () => number) {
  // value-noise lattice
  const SIZE = 256;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const fade = (t: number) => t * t * (3 - 2 * t);

  function sample(x: number, y: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const aa = grid[((xi & 255) + ((yi & 255) << 8)) & (SIZE * SIZE - 1)];
    const ba = grid[(((xi + 1) & 255) + ((yi & 255) << 8)) & (SIZE * SIZE - 1)];
    const ab = grid[((xi & 255) + (((yi + 1) & 255) << 8)) & (SIZE * SIZE - 1)];
    const bb = grid[(((xi + 1) & 255) + (((yi + 1) & 255) << 8)) & (SIZE * SIZE - 1)];
    const u = fade(xf);
    const v = fade(yf);
    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
  }

  function fbm(x: number, y: number, oct = 5, lac = 2.0, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * sample(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lac;
    }
    return sum / norm;
  }

  return { sample, fbm };
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

;(window as any).__rng = { mulberry32, makeNoise2D, clamp, lerp, dist };
