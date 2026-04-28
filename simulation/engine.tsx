// ============== Simulation Engine ==============
// One file containing all of: civ init, city growth, trade, war, disease, collapse.
// Kept here as a single module so cross-system interactions are obvious.

declare const PALETTE: any;
declare const CIV_TEMPLATES: any;
declare const makeCityName: any;
declare const plagueName: any;
declare const generateWorld: any;

function tileAt(state: SimState, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  return state.tiles[y * state.width + x];
}

function findCityById(state: SimState, id: number): City | undefined {
  return state.cities.find((c) => c.id === id);
}

function pushEvent(state: SimState, ev: Omit<WorldEvent, "year">) {
  state.events.unshift({ year: state.year, ...ev });
  if (state.events.length > 200) state.events.length = 200;
}

// -------- Initialisation --------
function initSim(seed: number, width: number, height: number, civCount: number): SimState {
  const w = (window as any).__world.generateWorld(width, height, seed);
  const tiles: Tile[] = w.tiles;
  const rng = w.rng;
  const cl = (window as any).__rng.clamp;

  const state: SimState = {
    width, height, tiles,
    cities: [], civs: [], routes: [], wars: [], outbreaks: [], events: [],
    year: -3000,
    nextCityId: 1, nextRouteId: 1, nextWarId: 1, nextOutbreakId: 1,
    globalStability: 0.85,
    rng,
    effects: [],
    totalDeaths: 0,
  };

  // place initial cities at fertile, accessible tiles
  const candidates: Tile[] = tiles.filter(t =>
    t.terrain !== "ocean" && t.terrain !== "coast" && t.terrain !== "mountain" && t.fertility > 0.45
  );
  candidates.sort((a, b) => b.fertility - a.fertility);

  const civs: Civilization[] = [];
  for (let i = 0; i < civCount; i++) {
    const tpl = CIV_TEMPLATES[i % CIV_TEMPLATES.length];
    // pick a tile far from existing capitals
    let chosen: Tile | null = null;
    for (const t of candidates) {
      let ok = true;
      for (const c of civs) {
        const cap = state.cities.find(ci => ci.id === c.capitalId)!;
        if ((window as any).__rng.dist(t.x, t.y, cap.x, cap.y) < Math.min(width, height) * 0.22) {
          ok = false; break;
        }
      }
      if (ok) { chosen = t; break; }
    }
    if (!chosen) chosen = candidates[i * 17 % candidates.length];

    const capital: City = {
      id: state.nextCityId++,
      civId: i,
      name: makeCityName(rng),
      x: chosen.x, y: chosen.y,
      population: 4 + rng() * 3,
      food: 80,
      wealth: 60,
      defense: 30,
      disease: 0,
      unrest: 0,
      founded: state.year,
      alive: true,
    };
    state.cities.push(capital);
    chosen.ownerCiv = i;

    civs.push({
      id: i, name: tpl.name, ideology: tpl.ideology,
      color: tpl.color, hue: tpl.hue,
      capitalId: capital.id, cityIds: [capital.id],
      population: capital.population,
      wealth: capital.wealth, food: capital.food,
      tech: 4 + rng() * 4,
      military: 20 + rng() * 15,
      stability: 0.85 + rng() * 0.1,
      collapseRisk: 0.05,
      warExhaustion: 0, climateStress: 0, diseaseStress: 0,
      alive: true, collapseStage: 0, age: 0,
    });
    pushEvent(state, { type: "founding", text: `${tpl.name} 在 ${capital.name} 立国`, civId: i, severity: 0 });
  }
  state.civs = civs;
  // expand initial owner radius around each capital
  expandTerritories(state, 6);
  return state;
}

// -------- Territory expansion (flood-fill weighted by movement cost / fertility) --------
function expandTerritories(state: SimState, rounds: number) {
  for (let r = 0; r < rounds; r++) {
    const growth: { x: number; y: number; civ: number }[] = [];
    for (const civ of state.civs) {
      if (!civ.alive) continue;
      // claim adjacent unowned land tiles around any owned tile
      for (let i = 0; i < state.tiles.length; i += Math.max(1, Math.floor(state.tiles.length / 4000))) {
        const t = state.tiles[i];
        if (t.ownerCiv !== civ.id) continue;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nt = tileAt(state, t.x + dx, t.y + dy);
          if (!nt || nt.ownerCiv !== null) continue;
          if (nt.terrain === "ocean" || nt.terrain === "coast") continue;
          if (state.rng() < 0.5) growth.push({ x: nt.x, y: nt.y, civ: civ.id });
        }
      }
    }
    for (const g of growth) {
      const t = tileAt(state, g.x, g.y);
      if (t && t.ownerCiv === null) t.ownerCiv = g.civ;
    }
  }
}

// -------- One simulation tick (one year) --------
function step(state: SimState) {
  state.year += 1;
  const cl = (window as any).__rng.clamp;
  const rng = state.rng;

  // ---- City dynamics ----
  for (const city of state.cities) {
    if (!city.alive) continue;
    const tile = tileAt(state, city.x, city.y)!;
    const civ = state.civs[city.civId];
    if (!civ.alive) continue;

    // food production
    const foodGain = tile.fertility * 6 + (tile.river ? 2 : 0) + civ.tech * 0.05;
    const foodConsume = city.population * 0.9;
    city.food = cl(city.food + foodGain - foodConsume * 0.18, 0, 200);

    // population growth (logistic-ish)
    const carry = 30 + tile.fertility * 80 + civ.tech * 0.4;
    const grow = (city.food > 30 ? 0.025 : -0.04) * city.population * (1 - city.population / carry);
    city.population = cl(city.population + grow - city.disease * 0.3 - city.unrest * 0.1, 0, 600);

    // disease pressure rises with density
    const density = city.population / Math.max(20, carry);
    if (density > 0.7 && rng() < 0.004 + (density - 0.7) * 0.02) {
      // spontaneous outbreak
      spawnOutbreak(state, city.id, 0.3 + rng() * 0.4);
    }
    // background disease decay
    city.disease = cl(city.disease - 0.01, 0, 1);
    if (city.disease > 0) {
      const deaths = city.population * city.disease * 0.04;
      city.population = Math.max(0, city.population - deaths);
      state.totalDeaths += deaths * 1000;
    }

    // wealth via trade & resources
    city.wealth = cl(city.wealth + tile.resources * 0.5 + civ.tech * 0.04 - city.disease * 2, 0, 1500);

    // unrest
    city.unrest = cl(city.unrest + (city.food < 20 ? 0.02 : -0.005) + city.disease * 0.01 - civ.stability * 0.005, 0, 1);

    // city death
    if (city.population < 0.4) {
      city.alive = false;
      pushEvent(state, { type: "collapse", text: `${city.name} (${civ.name}) 已成废墟`, civId: civ.id, severity: 2 });
      state.effects.push({ kind: "collapse", x: city.x, y: city.y, age: 0, life: 60, color: civ.color, size: 18 });
    }
  }

  // ---- New city founding ----
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    if (civ.cityIds.length >= 8) continue;
    if (rng() > 0.04 + civ.tech * 0.001) continue;
    // pick best unowned-or-own border tile near an existing city
    const seedCity = state.cities.find(c => c.id === civ.cityIds[Math.floor(rng() * civ.cityIds.length)]);
    if (!seedCity) continue;
    const radius = 14;
    let best: Tile | null = null;
    let bestScore = -Infinity;
    for (let k = 0; k < 30; k++) {
      const dx = (rng() * 2 - 1) * radius;
      const dy = (rng() * 2 - 1) * radius;
      const t = tileAt(state, Math.round(seedCity.x + dx), Math.round(seedCity.y + dy));
      if (!t || t.terrain === "ocean" || t.terrain === "coast" || t.terrain === "mountain") continue;
      // not too close to any existing city
      let tooClose = false;
      for (const c of state.cities) {
        if (!c.alive) continue;
        if (Math.hypot(c.x - t.x, c.y - t.y) < 9) { tooClose = true; break; }
      }
      if (tooClose) continue;
      // not deep in foreign territory
      if (t.ownerCiv !== null && t.ownerCiv !== civ.id) continue;
      const score = t.fertility * 2 + t.resources + (t.river ? 0.5 : 0) - t.climateRisk * 0.5;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    if (best && bestScore > 0.7) {
      const c: City = {
        id: state.nextCityId++,
        civId: civ.id,
        name: makeCityName(rng),
        x: best.x, y: best.y,
        population: 1.5 + rng(),
        food: 40, wealth: 20, defense: 10,
        disease: 0, unrest: 0,
        founded: state.year,
        alive: true,
      };
      state.cities.push(c);
      civ.cityIds.push(c.id);
      best.ownerCiv = civ.id;
      state.effects.push({ kind: "founding", x: c.x, y: c.y, age: 0, life: 40, color: civ.color, size: 14 });
      if (state.year % 7 === 0) {
        pushEvent(state, { type: "founding", text: `${civ.name} 建立 ${c.name}`, civId: civ.id, severity: 0 });
      }
    }
  }

  // territory creep
  if (state.year % 2 === 0) expandTerritories(state, 1);

  // ---- Trade routes ----
  // periodically create routes between same-civ cities and between neighboring civs at peace
  if (state.year % 4 === 0) {
    tryFormRoutes(state);
  }
  for (const r of state.routes) {
    if (!r.active) continue;
    const a = findCityById(state, r.fromCity);
    const b = findCityById(state, r.toCity);
    if (!a || !b || !a.alive || !b.alive) { r.active = false; continue; }
    const civA = state.civs[a.civId];
    const civB = state.civs[b.civId];
    // war between civs breaks route
    if (civA.id !== civB.id && atWar(state, civA.id, civB.id)) { r.active = false; continue; }
    r.volume = cl(r.volume + 0.01, 0, 1);
    a.wealth = cl(a.wealth + r.volume * 0.4, 0, 1500);
    b.wealth = cl(b.wealth + r.volume * 0.4, 0, 1500);
    civA.tech = cl(civA.tech + r.volume * 0.02, 0, 100);
    civB.tech = cl(civB.tech + r.volume * 0.02, 0, 100);
    // disease propagation
    if (a.disease > 0.1 && rng() < a.disease * 0.5 * r.volume) {
      b.disease = Math.min(1, b.disease + a.disease * 0.4);
      r.diseaseLoad = a.disease;
    } else if (b.disease > 0.1 && rng() < b.disease * 0.5 * r.volume) {
      a.disease = Math.min(1, a.disease + b.disease * 0.4);
      r.diseaseLoad = b.disease;
    } else {
      r.diseaseLoad = Math.max(0, r.diseaseLoad - 0.02);
    }
    r.pulse += 0.05 + r.volume * 0.05;
  }

  // neighbor disease spread
  for (const c of state.cities) {
    if (!c.alive || c.disease < 0.15) continue;
    for (const n of state.cities) {
      if (!n.alive || n === c) continue;
      const d = Math.hypot(c.x - n.x, c.y - n.y);
      if (d < 14 && rng() < c.disease * 0.04) {
        n.disease = Math.min(1, n.disease + c.disease * 0.3);
      }
    }
  }

  // outbreak progression / decay
  for (const o of state.outbreaks) {
    if (!o.active) continue;
    o.spread = cl(o.spread + 0.01, 0, 1);
    o.ringPhase += 0.06;
    let totalInf = 0;
    for (const cid of o.affectedCities) {
      const c = findCityById(state, cid);
      if (c && c.alive) totalInf += c.disease;
    }
    if (totalInf < 0.05 || state.year - o.startYear > 25) {
      o.active = false;
    }
  }

  // ---- War dynamics ----
  // possible war declaration between contacted civs
  if (state.year % 3 === 0) maybeDeclareWar(state);
  for (const w of state.wars) {
    if (!w.active) continue;
    advanceWar(state, w);
  }

  // ---- Civ aggregate updates ----
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    civ.age += 1;
    civ.cityIds = civ.cityIds.filter(id => {
      const c = findCityById(state, id);
      return c && c.alive;
    });
    if (civ.cityIds.length === 0) {
      civ.alive = false;
      civ.collapseStage = 3;
      pushEvent(state, { type: "collapse", text: `${civ.name} 已经从历史中消失`, civId: civ.id, severity: 3 });
      // unclaim
      for (const t of state.tiles) if (t.ownerCiv === civ.id) t.ownerCiv = null;
      continue;
    }
    let pop = 0, food = 0, wealth = 0, disease = 0;
    for (const id of civ.cityIds) {
      const c = findCityById(state, id)!;
      pop += c.population; food += c.food; wealth += c.wealth; disease += c.disease;
    }
    civ.population = pop;
    civ.food = food;
    civ.wealth = wealth;
    civ.diseaseStress = cl(disease / Math.max(1, civ.cityIds.length), 0, 1);
    // climate stress = avg climateRisk of capitals
    const cap = findCityById(state, civ.capitalId);
    if (cap) civ.climateStress = cl(tileAt(state, cap.x, cap.y)!.climateRisk * 0.7 + civ.climateStress * 0.3, 0, 1);

    civ.tech = cl(civ.tech + 0.05 + civ.wealth * 0.00005, 0, 100);
    civ.military = cl(civ.military + civ.wealth * 0.0008 - civ.warExhaustion * 0.05, 0, 400);
    // war exhaustion decays in peacetime
    const inWar = state.wars.some(w => w.active && (w.attacker === civ.id || w.defender === civ.id));
    civ.warExhaustion = cl(civ.warExhaustion + (inWar ? 0.01 : -0.005), 0, 1);

    // stability ~= function of food per capita, unrest avg, disease, war
    let unrest = 0;
    for (const id of civ.cityIds) unrest += findCityById(state, id)!.unrest;
    unrest /= Math.max(1, civ.cityIds.length);
    const foodPerCap = civ.food / Math.max(1, civ.population);
    const stabilityTarget =
      cl(0.5 + foodPerCap * 0.05 - unrest * 0.5 - civ.diseaseStress * 0.4 - civ.warExhaustion * 0.3 - civ.climateStress * 0.2, 0, 1);
    civ.stability = cl(civ.stability * 0.9 + stabilityTarget * 0.1, 0, 1);

    // collapse risk
    civ.collapseRisk = cl(
      (1 - civ.stability) * 0.5 +
      civ.warExhaustion * 0.25 +
      civ.diseaseStress * 0.2 +
      civ.climateStress * 0.15 +
      (foodPerCap < 4 ? 0.2 : 0),
      0, 1
    );

    // collapse stages
    if (civ.collapseRisk > 0.85 && civ.collapseStage < 2) {
      civ.collapseStage = 2;
      pushEvent(state, { type: "fracture", text: `${civ.name} 进入崩溃阶段`, civId: civ.id, severity: 3 });
    } else if (civ.collapseRisk > 0.6 && civ.collapseStage < 1) {
      civ.collapseStage = 1;
      pushEvent(state, { type: "fracture", text: `${civ.name} 出现严重压力`, civId: civ.id, severity: 2 });
    } else if (civ.collapseRisk < 0.4 && civ.collapseStage > 0 && civ.collapseStage < 3) {
      civ.collapseStage = 0;
    }

    // active fragmentation: in stage 2, lose distant cities
    if (civ.collapseStage >= 2 && rng() < 0.04) {
      // city revolts -> may go independent (becomes part of nearest other civ or destroyed)
      const cityId = civ.cityIds[Math.floor(rng() * civ.cityIds.length)];
      const c = findCityById(state, cityId);
      if (c && c.id !== civ.capitalId) {
        // try transfer to nearest alive civ; otherwise destroy
        let nearest: Civilization | null = null;
        let nd = Infinity;
        for (const o of state.civs) {
          if (!o.alive || o.id === civ.id) continue;
          for (const oid of o.cityIds) {
            const oc = findCityById(state, oid);
            if (!oc) continue;
            const d = Math.hypot(oc.x - c.x, oc.y - c.y);
            if (d < nd) { nd = d; nearest = o; }
          }
        }
        if (nearest && nd < 30) {
          c.civId = nearest.id;
          civ.cityIds = civ.cityIds.filter(id => id !== c.id);
          nearest.cityIds.push(c.id);
          // re-flag tiles around it
          for (let dx = -3; dx <= 3; dx++)
            for (let dy = -3; dy <= 3; dy++) {
              const t = tileAt(state, c.x + dx, c.y + dy);
              if (t && t.ownerCiv === civ.id && Math.hypot(dx, dy) < 4) t.ownerCiv = nearest!.id;
            }
          pushEvent(state, { type: "fracture", text: `${c.name} 脱离 ${civ.name}, 投靠 ${nearest.name}`, civId: civ.id, severity: 2 });
        } else {
          c.alive = false;
          pushEvent(state, { type: "fracture", text: `${c.name} 在 ${civ.name} 内乱中陷落`, civId: civ.id, severity: 2 });
        }
      }
    }
  }

  // global stability
  const alive = state.civs.filter(c => c.alive);
  state.globalStability = alive.length === 0 ? 0
    : alive.reduce((s, c) => s + c.stability, 0) / alive.length;

  // age effects
  state.effects = state.effects.filter(e => { e.age += 1; return e.age < e.life; });
}

function tryFormRoutes(state: SimState) {
  const cl = (window as any).__rng.clamp;
  const rng = state.rng;
  for (let attempts = 0; attempts < 5; attempts++) {
    const a = state.cities[Math.floor(rng() * state.cities.length)];
    const b = state.cities[Math.floor(rng() * state.cities.length)];
    if (!a || !b || a === b || !a.alive || !b.alive) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 6 || d > 35) continue;
    if (a.civId !== b.civId) {
      if (atWar(state, a.civId, b.civId)) continue;
    }
    // dedupe
    if (state.routes.some(r => r.active && ((r.fromCity === a.id && r.toCity === b.id) || (r.fromCity === b.id && r.toCity === a.id)))) continue;
    state.routes.push({
      id: state.nextRouteId++,
      fromCity: a.id, toCity: b.id,
      volume: 0.2, active: true, diseaseLoad: 0, pulse: rng() * Math.PI * 2,
    });
    if (a.civId !== b.civId && rng() < 0.25) {
      pushEvent(state, { type: "trade", text: `${state.civs[a.civId].name} 与 ${state.civs[b.civId].name} 开通商路`, civId: a.civId, severity: 0 });
    }
  }
}

function atWar(state: SimState, ca: number, cb: number) {
  return state.wars.some(w => w.active && ((w.attacker === ca && w.defender === cb) || (w.attacker === cb && w.defender === ca)));
}

function maybeDeclareWar(state: SimState) {
  const rng = state.rng;
  for (const a of state.civs) {
    if (!a.alive) continue;
    for (const b of state.civs) {
      if (!b.alive || a.id >= b.id) continue;
      if (atWar(state, a.id, b.id)) continue;
      // need contact - some adjacent tiles between them
      let contact = false;
      const sample = Math.max(40, Math.floor(state.tiles.length / 200));
      for (let i = 0; i < state.tiles.length; i += sample) {
        const t = state.tiles[i];
        if (t.ownerCiv !== a.id) continue;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[2,0],[0,2]]) {
          const nt = tileAt(state, t.x + dx, t.y + dy);
          if (nt && nt.ownerCiv === b.id) { contact = true; break; }
        }
        if (contact) break;
      }
      if (!contact) continue;
      const aggA = (1 - a.stability) * 0.5 + a.collapseRisk * 0.3 + (a.military / 200) * 0.3;
      const baseChance = 0.012 + aggA * 0.05;
      if (rng() < baseChance) {
        const attacker = a.military > b.military ? a : b;
        const defender = attacker === a ? b : a;
        const w: War = {
          id: state.nextWarId++,
          attacker: attacker.id, defender: defender.id,
          startYear: state.year,
          intensity: 0.4 + rng() * 0.3,
          frontPoints: [],
          casualties: 0,
          active: true,
        };
        // initial frontline points
        const aCap = findCityById(state, attacker.capitalId)!;
        const dCap = findCityById(state, defender.capitalId)!;
        for (let k = 0; k < 6; k++) {
          const t = k / 5;
          w.frontPoints.push({
            x: aCap.x + (dCap.x - aCap.x) * t + (rng() - 0.5) * 6,
            y: aCap.y + (dCap.y - aCap.y) * t + (rng() - 0.5) * 6,
            t: rng() * Math.PI * 2,
          });
        }
        state.wars.push(w);
        pushEvent(state, { type: "war", text: `${attacker.name} 向 ${defender.name} 宣战`, civId: attacker.id, severity: 2 });
      }
    }
  }
}

function advanceWar(state: SimState, w: War) {
  const cl = (window as any).__rng.clamp;
  const rng = state.rng;
  const attacker = state.civs[w.attacker];
  const defender = state.civs[w.defender];
  if (!attacker.alive || !defender.alive) { w.active = false; return; }

  // both sides bleed
  const ratio = attacker.military / Math.max(20, defender.military);
  const cas = w.intensity * 0.04;
  for (const cid of attacker.cityIds) {
    const c = findCityById(state, cid)!;
    c.population = Math.max(0, c.population - c.population * cas * 0.4);
  }
  for (const cid of defender.cityIds) {
    const c = findCityById(state, cid)!;
    c.population = Math.max(0, c.population - c.population * cas * 0.5 * (1/ratio));
  }
  attacker.military = Math.max(0, attacker.military - 1.5 - rng());
  defender.military = Math.max(0, defender.military - 1.5 - rng());
  attacker.wealth = Math.max(0, attacker.wealth - 5);
  defender.wealth = Math.max(0, defender.wealth - 5);
  w.casualties += cas * 1000;
  w.intensity = cl(w.intensity + (rng() - 0.5) * 0.05, 0.1, 1);

  // animate frontline jitter
  for (const f of w.frontPoints) {
    f.x += (rng() - 0.5) * 0.4;
    f.y += (rng() - 0.5) * 0.4;
    f.t += 0.1;
  }

  // capture: occasionally flip border tiles
  if (rng() < 0.25) {
    const fpt = w.frontPoints[Math.floor(rng() * w.frontPoints.length)];
    const radius = 2 + Math.floor(rng() * 2);
    for (let dx = -radius; dx <= radius; dx++)
      for (let dy = -radius; dy <= radius; dy++) {
        const t = tileAt(state, Math.round(fpt.x + dx), Math.round(fpt.y + dy));
        if (!t) continue;
        if (Math.hypot(dx, dy) > radius) continue;
        if (t.ownerCiv === defender.id && rng() < 0.5 && ratio > 0.7) {
          t.ownerCiv = attacker.id;
        } else if (t.ownerCiv === attacker.id && rng() < 0.4 && ratio < 1.3) {
          t.ownerCiv = defender.id;
        }
      }
    // possibly capture defender's nearest city
    for (const cid of [...defender.cityIds]) {
      const c = findCityById(state, cid)!;
      if (Math.hypot(c.x - fpt.x, c.y - fpt.y) < 4 && rng() < 0.05 && ratio > 1.1) {
        if (c.id === defender.capitalId) continue;
        c.civId = attacker.id;
        defender.cityIds = defender.cityIds.filter(id => id !== c.id);
        attacker.cityIds.push(c.id);
        c.population = Math.max(0.5, c.population * 0.6);
        pushEvent(state, { type: "war", text: `${attacker.name} 攻陷 ${c.name}`, civId: attacker.id, severity: 3 });
        state.effects.push({ kind: "explosion", x: c.x, y: c.y, age: 0, life: 35, color: PALETTE.red, size: 22 });
        break;
      }
    }
  }

  // war ends when one side exhausted, after time, or stability collapse
  const elapsed = state.year - w.startYear;
  if (elapsed > 20 || attacker.warExhaustion > 0.85 || defender.warExhaustion > 0.85 || rng() < 0.01) {
    w.active = false;
    pushEvent(state, { type: "peace", text: `${attacker.name} 与 ${defender.name} 议和`, civId: attacker.id, severity: 1 });
  }
}

// -------- Disease outbreak helpers --------
function spawnOutbreak(state: SimState, originCityId: number, virulence: number) {
  const c = findCityById(state, originCityId);
  if (!c || !c.alive) return;
  c.disease = Math.min(1, c.disease + virulence);
  const o: DiseaseOutbreak = {
    id: state.nextOutbreakId++,
    originCityId,
    startYear: state.year,
    virulence,
    spread: 0,
    affectedCities: new Set([originCityId]),
    name: plagueName(state.rng),
    active: true,
    ringPhase: 0,
  };
  state.outbreaks.push(o);
  state.effects.push({ kind: "plagueRing", x: c.x, y: c.y, age: 0, life: 80, color: PALETTE.magenta, size: 30 });
  const civ = state.civs[c.civId];
  pushEvent(state, { type: "plague", text: `${civ.name} 的 ${c.name} 爆发 ${o.name}`, civId: civ.id, severity: 2 });
}

// -------- Disaster triggers (user-initiated) --------
function triggerDisaster(state: SimState, kind: "drought" | "plague" | "invasion" | "depletion") {
  const rng = state.rng;
  if (kind === "drought") {
    // pick civ with highest climateStress
    const civ = state.civs.filter(c => c.alive).sort((a, b) => b.climateStress - a.climateStress)[0];
    if (!civ) return;
    civ.climateStress = Math.min(1, civ.climateStress + 0.4);
    civ.food = Math.max(0, civ.food - 200);
    for (const id of civ.cityIds) {
      const c = findCityById(state, id);
      if (c) c.food = Math.max(0, c.food - 40);
    }
    pushEvent(state, { type: "disaster", text: `大旱袭击 ${civ.name}`, civId: civ.id, severity: 3 });
  } else if (kind === "plague") {
    // pick random densely populated city
    const cities = state.cities.filter(c => c.alive).sort((a, b) => b.population - a.population);
    const target = cities[Math.floor(rng() * Math.min(3, cities.length))];
    if (target) spawnOutbreak(state, target.id, 0.6 + rng() * 0.3);
  } else if (kind === "invasion") {
    // create war on weakest civ from strongest one
    const alive = state.civs.filter(c => c.alive);
    if (alive.length < 2) return;
    const strong = [...alive].sort((a, b) => b.military - a.military)[0];
    const weak = [...alive].sort((a, b) => a.stability - b.stability)[0];
    if (strong.id === weak.id) return;
    if (atWar(state, strong.id, weak.id)) return;
    const w: War = {
      id: state.nextWarId++,
      attacker: strong.id, defender: weak.id,
      startYear: state.year, intensity: 0.7,
      frontPoints: [],
      casualties: 0, active: true,
    };
    const aCap = findCityById(state, strong.capitalId)!;
    const dCap = findCityById(state, weak.capitalId)!;
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      w.frontPoints.push({
        x: aCap.x + (dCap.x - aCap.x) * t + (rng() - 0.5) * 6,
        y: aCap.y + (dCap.y - aCap.y) * t + (rng() - 0.5) * 6,
        t: rng() * Math.PI * 2,
      });
    }
    state.wars.push(w);
    pushEvent(state, { type: "war", text: `${strong.name} 大举入侵 ${weak.name}`, civId: strong.id, severity: 3 });
  } else if (kind === "depletion") {
    // halve resources globally
    for (const t of state.tiles) t.resources *= 0.5;
    pushEvent(state, { type: "disaster", text: `全球资源出现枯竭征兆`, severity: 3 });
  }
}

;(window as any).__sim = { initSim, step, triggerDisaster, spawnOutbreak, findCityById, tileAt, atWar };
