// ============== Canvas Renderer ==============
// Draws terrain, civ borders, trade, war, disease, cities, effects, grid, scanlines.

declare const PALETTE: any;

// Cache the static terrain layer so we don't repaint per-pixel each frame.
let terrainCache: HTMLCanvasElement | null = null;
let terrainCacheKey = "";

function paintTerrainCache(state: SimState, tileSize: number) {
  const key = `${state.width}x${state.height}@${tileSize}`;
  if (terrainCache && terrainCacheKey === key) return terrainCache;
  const c = document.createElement("canvas");
  c.width = state.width * tileSize;
  c.height = state.height * tileSize;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const t = state.tiles[y * state.width + x];
      const col = colorForTile(t);
      ctx.fillStyle = col;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  // contour overlay for elevation (mountain ranges)
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const t = state.tiles[y * state.width + x];
      if (t.terrain === "ocean" || t.terrain === "coast") continue;
      const e = t.elevation;
      // every 0.06 step, dot a contour line
      const band = Math.floor(e * 16);
      if (band % 3 === 0 && (x + y) % 2 === 0) {
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
  }
  ctx.globalAlpha = 1;

  // rivers as separate pass (slightly brighter)
  ctx.fillStyle = PALETTE.terrain.river;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const t = state.tiles[y * state.width + x];
      if (t.river) ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  terrainCache = c;
  terrainCacheKey = key;
  return c;
}

function colorForTile(t: Tile): string {
  switch (t.terrain) {
    case "ocean":   return t.elevation < -0.25 ? PALETTE.terrain.ocean_deep : PALETTE.terrain.ocean;
    case "coast":   return PALETTE.terrain.coast;
    case "plain":   return PALETTE.terrain.plain;
    case "grass":   return PALETTE.terrain.grass;
    case "forest":  return PALETTE.terrain.forest;
    case "desert":  return PALETTE.terrain.desert;
    case "mountain": return t.elevation > 0.45 ? PALETTE.terrain.mountain_high : PALETTE.terrain.mountain;
    case "tundra":  return PALETTE.terrain.tundra;
    default:        return "#222";
  }
}

function invalidateTerrainCache() { terrainCache = null; terrainCacheKey = ""; }

function renderWorld(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  layers: Layers,
  tileSize: number,
  selectedCiv: number | null,
  hoverPos: { x: number; y: number } | null,
  frame: number
) {
  const W = state.width * tileSize;
  const H = state.height * tileSize;

  // background
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, W, H);

  // terrain
  if (layers.terrain) {
    const cache = paintTerrainCache(state, tileSize);
    ctx.drawImage(cache, 0, 0);
  } else {
    // dimmed terrain so other layers stand out
    const cache = paintTerrainCache(state, tileSize);
    ctx.globalAlpha = 0.25;
    ctx.drawImage(cache, 0, 0);
    ctx.globalAlpha = 1;
  }

  // resource overlay (heatmap of dots)
  if (layers.resources) {
    ctx.fillStyle = "rgba(255,181,71,0.85)";
    for (let y = 0; y < state.height; y += 2) {
      for (let x = 0; x < state.width; x += 2) {
        const t = state.tiles[y * state.width + x];
        if (t.resources > 0.55) {
          const r = (t.resources - 0.55) * 4;
          ctx.fillRect(x * tileSize, y * tileSize, Math.max(1, r * tileSize), Math.max(1, r * tileSize));
        }
      }
    }
  }

  // borders
  if (layers.borders) {
    drawBorders(ctx, state, tileSize, selectedCiv);
  }

  // collapse risk overlay (red wash inside borders by stage)
  if (layers.collapse) {
    drawCollapseHeat(ctx, state, tileSize);
  }

  // disease overlay
  if (layers.disease) {
    drawDisease(ctx, state, tileSize, frame);
  }

  // trade routes
  if (layers.trade) {
    drawTradeRoutes(ctx, state, tileSize, frame);
  }

  // war
  if (layers.war) {
    drawWars(ctx, state, tileSize, frame);
  }

  // cities
  if (layers.cities) {
    drawCities(ctx, state, tileSize, selectedCiv, frame);
  }

  // effects (explosions, plague rings, foundings)
  drawEffects(ctx, state, tileSize, frame);

  // grid + crosshair
  if (layers.grid) {
    drawGrid(ctx, W, H);
  }

  // hover crosshair
  if (hoverPos) {
    ctx.strokeStyle = "rgba(255,181,71,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hoverPos.y * tileSize + tileSize/2);
    ctx.lineTo(W, hoverPos.y * tileSize + tileSize/2);
    ctx.moveTo(hoverPos.x * tileSize + tileSize/2, 0);
    ctx.lineTo(hoverPos.x * tileSize + tileSize/2, H);
    ctx.stroke();
  }

  // scanlines
  drawScanlines(ctx, W, H, frame);
  // vignette
  drawVignette(ctx, W, H);
}

function drawBorders(ctx: CanvasRenderingContext2D, state: SimState, ts: number, selected: number | null) {
  // shaded interior + outline
  // 1) translucent fill inside owned tiles
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const t = state.tiles[y * state.width + x];
      if (t.ownerCiv === null) continue;
      const civ = state.civs[t.ownerCiv];
      if (!civ.alive) continue;
      const sel = selected === null || selected === civ.id;
      ctx.fillStyle = withAlpha(civ.color, sel ? 0.16 : 0.06);
      ctx.fillRect(x * ts, y * ts, ts, ts);
    }
  }
  // 2) outline tiles whose neighbor differs
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const t = state.tiles[y * state.width + x];
      if (t.ownerCiv === null) continue;
      const civ = state.civs[t.ownerCiv];
      if (!civ.alive) continue;
      const sel = selected === null || selected === civ.id;
      ctx.fillStyle = withAlpha(civ.color, sel ? 0.95 : 0.4);
      const right = state.tiles[y * state.width + Math.min(state.width - 1, x + 1)];
      const down  = state.tiles[Math.min(state.height - 1, y + 1) * state.width + x];
      if (right.ownerCiv !== t.ownerCiv) ctx.fillRect((x + 1) * ts - 1, y * ts, 1, ts);
      if (down.ownerCiv !== t.ownerCiv) ctx.fillRect(x * ts, (y + 1) * ts - 1, ts, 1);
      if (x === 0 || state.tiles[y * state.width + x - 1].ownerCiv !== t.ownerCiv) ctx.fillRect(x * ts, y * ts, 1, ts);
      if (y === 0 || state.tiles[(y-1) * state.width + x].ownerCiv !== t.ownerCiv) ctx.fillRect(x * ts, y * ts, ts, 1);
    }
  }
}

function drawCollapseHeat(ctx: CanvasRenderingContext2D, state: SimState, ts: number) {
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    if (civ.collapseRisk < 0.3) continue;
    const a = (civ.collapseRisk - 0.3) * 0.5;
    ctx.fillStyle = `rgba(255,72,85,${a.toFixed(3)})`;
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const t = state.tiles[y * state.width + x];
        if (t.ownerCiv === civ.id && (x + y) % 2 === 0) {
          ctx.fillRect(x * ts, y * ts, ts, ts);
        }
      }
    }
  }
}

function drawDisease(ctx: CanvasRenderingContext2D, state: SimState, ts: number, frame: number) {
  for (const c of state.cities) {
    if (!c.alive || c.disease < 0.05) continue;
    const cx = c.x * ts + ts/2;
    const cy = c.y * ts + ts/2;
    const r = 4 + c.disease * 26;
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    grad.addColorStop(0, `rgba(255,85,119,${0.18 + c.disease * 0.4})`);
    grad.addColorStop(1, "rgba(255,85,119,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // pulsing ring
    const ringR = r + (Math.sin(frame * 0.1 + c.id) + 1) * 2;
    ctx.strokeStyle = `rgba(255,85,119,${0.4 * c.disease})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI*2); ctx.stroke();
  }
}

function drawTradeRoutes(ctx: CanvasRenderingContext2D, state: SimState, ts: number, frame: number) {
  for (const r of state.routes) {
    if (!r.active) continue;
    const a = state.cities.find(c => c.id === r.fromCity);
    const b = state.cities.find(c => c.id === r.toCity);
    if (!a || !b || !a.alive || !b.alive) continue;
    const ax = a.x * ts + ts/2, ay = a.y * ts + ts/2;
    const bx = b.x * ts + ts/2, by = b.y * ts + ts/2;
    // dashed line
    ctx.strokeStyle = `rgba(90,214,232,${0.25 + r.volume * 0.5})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -frame * 0.3;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
    // moving caravan dot
    const t = ((frame * 0.005 + r.pulse) % 1);
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    ctx.fillStyle = r.diseaseLoad > 0.2 ? PALETTE.magenta : PALETTE.cyan;
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
}

function drawWars(ctx: CanvasRenderingContext2D, state: SimState, ts: number, frame: number) {
  for (const w of state.wars) {
    if (!w.active) continue;
    // line linking attacker capital to defender capital
    const a = state.civs[w.attacker];
    const d = state.civs[w.defender];
    const aCap = state.cities.find(c => c.id === a.capitalId);
    const dCap = state.cities.find(c => c.id === d.capitalId);
    if (!aCap || !dCap) continue;

    // jagged frontline
    ctx.strokeStyle = `rgba(255,72,85,${0.5 + 0.3 * Math.sin(frame * 0.15)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < w.frontPoints.length; i++) {
      const p = w.frontPoints[i];
      const x = p.x * ts + ts/2 + Math.sin(frame * 0.2 + p.t) * 1.5;
      const y = p.y * ts + ts/2 + Math.cos(frame * 0.2 + p.t) * 1.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // explosion sparks at points
    for (const p of w.frontPoints) {
      if ((frame + Math.floor(p.t * 100)) % 18 === 0) {
        ctx.fillStyle = PALETTE.amber;
        ctx.fillRect(p.x * ts + ts/2 - 1, p.y * ts + ts/2 - 1, 2, 2);
      }
    }
  }
}

function drawCities(ctx: CanvasRenderingContext2D, state: SimState, ts: number, selected: number | null, frame: number) {
  for (const c of state.cities) {
    if (!c.alive) continue;
    const civ = state.civs[c.civId];
    if (!civ.alive) continue;
    const sel = selected === null || selected === c.civId;
    const cx = c.x * ts + ts/2;
    const cy = c.y * ts + ts/2;
    const isCap = civ.capitalId === c.id;
    const sz = isCap ? 5 : 3 + Math.min(2, c.population / 50);

    // halo
    ctx.fillStyle = withAlpha(civ.color, sel ? 0.3 : 0.1);
    ctx.beginPath(); ctx.arc(cx, cy, sz + 4, 0, Math.PI*2); ctx.fill();
    // dot
    ctx.fillStyle = sel ? civ.color : withAlpha(civ.color, 0.5);
    ctx.fillRect(cx - sz/2, cy - sz/2, sz, sz);
    if (isCap) {
      ctx.strokeStyle = sel ? "#fff" : "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - sz/2 - 1.5, cy - sz/2 - 1.5, sz + 3, sz + 3);
    }
    // unrest tick
    if (c.unrest > 0.4) {
      ctx.fillStyle = PALETTE.amber;
      ctx.fillRect(cx + sz/2 + 1, cy - sz/2, 1, 2);
    }
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, state: SimState, ts: number, frame: number) {
  for (const e of state.effects) {
    const t = e.age / e.life;
    const cx = e.x * ts + ts/2;
    const cy = e.y * ts + ts/2;
    if (e.kind === "explosion") {
      const r = e.size * (0.3 + t * 1.5);
      ctx.strokeStyle = `rgba(255,72,85,${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = `rgba(255,181,71,${(1-t) * 0.6})`;
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    } else if (e.kind === "plagueRing") {
      for (let k = 0; k < 3; k++) {
        const tt = (t + k * 0.33) % 1;
        const r = e.size * tt;
        ctx.strokeStyle = `rgba(255,85,119,${(1 - tt) * 0.7})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
      }
    } else if (e.kind === "founding") {
      const r = e.size * (1 - t);
      ctx.strokeStyle = withAlpha(e.color, 1 - t);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    } else if (e.kind === "collapse") {
      const r = e.size * t;
      ctx.strokeStyle = `rgba(255,72,85,${1-t})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = a * Math.PI / 3;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      }
      ctx.stroke();
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.strokeStyle = "rgba(122,138,168,0.06)";
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawScanlines(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#000";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.globalAlpha = 1;
  // moving sweep
  const sweep = (frame * 1.5) % (H + 60) - 60;
  const grad = ctx.createLinearGradient(0, sweep - 30, 0, sweep + 60);
  grad.addColorStop(0, "rgba(90,214,232,0)");
  grad.addColorStop(0.5, "rgba(90,214,232,0.05)");
  grad.addColorStop(1, "rgba(90,214,232,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, sweep - 30, W, 90);
}

function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W, H) * 0.4, W/2, H/2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function withAlpha(hex: string, a: number) {
  // hex like #rrggbb -> rgba
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

;(window as any).__render = { renderWorld, invalidateTerrainCache };
