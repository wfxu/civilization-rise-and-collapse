// ============== World Generation ==============
// Generates terrain, climate, fertility, resources and rivers using value-noise.

declare const mulberry32: any;
declare const makeNoise2D: any;
declare const clamp: any;

function generateWorld(width: number, height: number, seed: number) {
  const rng = (window as any).__rng.mulberry32(seed);
  const elevNoise = (window as any).__rng.makeNoise2D((window as any).__rng.mulberry32(seed + 1));
  const moistNoise = (window as any).__rng.makeNoise2D((window as any).__rng.mulberry32(seed + 2));
  const tempNoise = (window as any).__rng.makeNoise2D((window as any).__rng.mulberry32(seed + 3));
  const cl = (window as any).__rng.clamp;

  const tiles: Tile[] = new Array(width * height);

  // Use radial falloff so we get a proper continent silhouette rather than tiling noise
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.55;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / 28;
      const ny = y / 28;

      // Two continent lobes for asymmetry
      let e = elevNoise.fbm(nx, ny, 6, 2.0, 0.5);
      // Bias by combined squared-falloff toward two centers
      const c1x = width * 0.38, c1y = height * 0.45;
      const c2x = width * 0.7, c2y = height * 0.6;
      const r1 = Math.hypot(x - c1x, y - c1y) / maxR;
      const r2 = Math.hypot(x - c2x, y - c2y) / (maxR * 0.85);
      const land = Math.min(r1, r2);
      e = e - cl(land - 0.35, 0, 1) * 0.85;

      // Latitude band for temperature
      const latNoise = tempNoise.fbm(nx * 0.6, ny * 0.6, 3) * 0.25;
      const lat = 1 - Math.abs((y / height) - 0.5) * 2; // 1=equator, 0=poles
      const temp = cl(lat * 0.85 + latNoise + 0.05, 0, 1);

      const moist = cl(
        moistNoise.fbm(nx * 1.2, ny * 1.2, 5) * 0.85 +
          (1 - Math.abs(temp - 0.55)) * 0.15,
        0, 1
      );

      let terrain: Terrain;
      if (e < -0.05) terrain = "ocean";
      else if (e < 0.02) terrain = "coast";
      else if (e > 0.32) terrain = "mountain";
      else if (temp < 0.18) terrain = "tundra";
      else if (moist < 0.32 && temp > 0.55) terrain = "desert";
      else if (moist > 0.62 && temp > 0.35) terrain = "forest";
      else if (moist > 0.45) terrain = "grass";
      else terrain = "plain";

      const isLand = terrain !== "ocean" && terrain !== "coast";
      let fertility = 0;
      if (isLand) {
        fertility = cl(moist * 0.6 + (1 - Math.abs(temp - 0.6)) * 0.5 - (terrain === "mountain" ? 0.5 : 0) - (terrain === "desert" ? 0.4 : 0) - (terrain === "tundra" ? 0.4 : 0), 0, 1);
      }
      const resources = isLand
        ? cl((terrain === "mountain" ? 0.7 : 0.2) + rng() * 0.5 + (terrain === "forest" ? 0.2 : 0), 0, 1)
        : 0;

      let movementCost = 1;
      if (terrain === "mountain") movementCost = 4.5;
      else if (terrain === "forest") movementCost = 2.2;
      else if (terrain === "desert") movementCost = 2.8;
      else if (terrain === "tundra") movementCost = 2.5;
      else if (terrain === "ocean" || terrain === "coast") movementCost = 99;

      const climateRisk = cl(
        (terrain === "desert" ? 0.7 : 0) +
          (terrain === "tundra" ? 0.6 : 0) +
          (1 - moist) * 0.3 +
          Math.abs(temp - 0.55) * 0.4,
        0, 1
      );

      tiles[y * width + x] = {
        x, y, terrain,
        elevation: e,
        moisture: moist,
        temperature: temp,
        fertility, resources,
        movementCost, climateRisk,
        river: false,
        ownerCiv: null,
      };
    }
  }

  // ---------- Rivers ----------
  // Trace rivers by descending elevation from high spots toward sea.
  const sourceCount = 18;
  for (let s = 0; s < sourceCount; s++) {
    let bestX = 0, bestY = 0, bestE = -Infinity;
    for (let attempt = 0; attempt < 80; attempt++) {
      const tx = Math.floor(rng() * width);
      const ty = Math.floor(rng() * height);
      const t = tiles[ty * width + tx];
      if (t.terrain === "mountain" && t.elevation > bestE) {
        bestE = t.elevation; bestX = tx; bestY = ty;
      }
    }
    let x = bestX, y = bestY;
    const visited = new Set<number>();
    for (let step = 0; step < 200; step++) {
      const idx = y * width + x;
      if (visited.has(idx)) break;
      visited.add(idx);
      const t = tiles[idx];
      if (!t || t.terrain === "ocean" || t.terrain === "coast") break;
      t.river = true;
      if (t.terrain !== "mountain") {
        // River corridor boosts moisture/fertility
        t.moisture = Math.min(1, t.moisture + 0.2);
        t.fertility = Math.min(1, t.fertility + 0.25);
      }
      // step downhill (4-neighborhood)
      const neigh = [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
      ];
      let nx = x, ny = y, ne = t.elevation;
      for (const [a, b] of neigh) {
        if (a < 0 || b < 0 || a >= width || b >= height) continue;
        const nt = tiles[b * width + a];
        if (nt.elevation < ne) { ne = nt.elevation; nx = a; ny = b; }
      }
      if (nx === x && ny === y) break;
      x = nx; y = ny;
    }
  }

  return { tiles, width, height, rng };
}

;(window as any).__world = { generateWorld };
