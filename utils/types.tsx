// ============== Core Types ==============
// All shared type definitions and a few small utility functions.

type Terrain =
  | "ocean"
  | "coast"
  | "plain"
  | "grass"
  | "forest"
  | "desert"
  | "mountain"
  | "tundra"
  | "river";

interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  elevation: number;     // 0..1
  moisture: number;      // 0..1
  temperature: number;   // 0..1
  fertility: number;     // 0..1
  resources: number;     // 0..1
  movementCost: number;  // 1..5
  climateRisk: number;   // 0..1
  river: boolean;
  ownerCiv: number | null;
}

interface City {
  id: number;
  civId: number;
  name: string;
  x: number;
  y: number;
  population: number;     // thousands
  food: number;           // 0..200
  wealth: number;         // 0..1000
  defense: number;        // 0..200
  disease: number;        // 0..1 infection level
  unrest: number;         // 0..1
  founded: number;        // year
  alive: boolean;
}

interface Civilization {
  id: number;
  name: string;
  color: string;
  hue: number;
  capitalId: number;
  cityIds: number[];
  population: number;
  wealth: number;
  food: number;
  tech: number;          // 0..100
  military: number;      // 0..200
  stability: number;     // 0..1 (1=stable)
  collapseRisk: number;  // 0..1
  warExhaustion: number; // 0..1
  climateStress: number; // 0..1
  diseaseStress: number; // 0..1
  alive: boolean;
  collapseStage: 0 | 1 | 2 | 3; // 0 thriving, 1 strain, 2 fracturing, 3 collapsed
  age: number;          // years since founding
  ideology: string;
}

interface TradeRoute {
  id: number;
  fromCity: number;
  toCity: number;
  volume: number;       // 0..1
  active: boolean;
  diseaseLoad: number;  // 0..1
  pulse: number;        // animation phase
}

interface War {
  id: number;
  attacker: number;
  defender: number;
  startYear: number;
  intensity: number;    // 0..1
  frontPoints: { x: number; y: number; t: number }[];
  casualties: number;
  active: boolean;
}

interface DiseaseOutbreak {
  id: number;
  originCityId: number;
  startYear: number;
  virulence: number;     // 0..1
  spread: number;        // 0..1 global progress
  affectedCities: Set<number>;
  name: string;
  active: boolean;
  ringPhase: number;
}

interface WorldEvent {
  year: number;
  type: "founding" | "war" | "peace" | "plague" | "famine" | "collapse" | "fracture" | "trade" | "disaster" | "milestone";
  text: string;
  civId?: number;
  severity: 0 | 1 | 2 | 3;
}

interface SimState {
  width: number;
  height: number;
  tiles: Tile[];
  cities: City[];
  civs: Civilization[];
  routes: TradeRoute[];
  wars: War[];
  outbreaks: DiseaseOutbreak[];
  events: WorldEvent[];
  year: number;
  nextCityId: number;
  nextRouteId: number;
  nextWarId: number;
  nextOutbreakId: number;
  globalStability: number;
  rng: () => number;
  // ephemeral effects
  effects: VisualEffect[];
  // global counters / debug
  totalDeaths: number;
}

interface VisualEffect {
  kind: "explosion" | "plagueRing" | "founding" | "collapse";
  x: number;
  y: number;
  age: number;
  life: number;
  color: string;
  size: number;
}

interface Layers {
  terrain: boolean;
  borders: boolean;
  trade: boolean;
  war: boolean;
  disease: boolean;
  resources: boolean;
  collapse: boolean;
  cities: boolean;
  grid: boolean;
}

// expose to other babel scripts
;(window as any).__types = true;
