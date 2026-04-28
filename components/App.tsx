// ============== Main App ==============
declare const PALETTE: any;

const { useState, useEffect, useRef, useMemo, useCallback } = (window as any).React;

function App() {
  const TILE_SIZE = 5;
  const W_TILES = 220;
  const H_TILES = 130;

  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [state, setState] = useState<SimState>(() => (window as any).__sim.initSim(seed, W_TILES, H_TILES, 6));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [selectedCiv, setSelectedCiv] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [layers, setLayers] = useState<Layers>({
    terrain: true, borders: true, trade: true, war: true,
    disease: true, resources: false, collapse: false, cities: true, grid: true,
  });
  const [fps, setFps] = useState(60);

  const stateRef = useRef(state);
  stateRef.current = state;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, forceTick] = useState(0);

  // Animation + simulation loop
  useEffect(() => {
    let raf = 0;
    let frame = 0;
    let lastSimTime = performance.now();
    let lastFpsCheck = performance.now();
    let frames = 0;

    const loop = () => {
     try {
      frame++;
      frames++;
      const now = performance.now();

      // simulate based on speed (years per second)
      if (playingRef.current) {
        const yps = speedRef.current; // years per second
        const elapsed = now - lastSimTime;
        const stepsToRun = Math.floor((elapsed / 1000) * yps);
        if (stepsToRun > 0) {
          const s = stateRef.current;
          for (let i = 0; i < Math.min(stepsToRun, 20); i++) {
            (window as any).__sim.step(s);
          }
          lastSimTime = now;
          // trigger react re-render of panels (don't replace simState — mutate in place)
          forceTick(x => x + 1);
        }
      }

      // render
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d")!;
        (window as any).__render.renderWorld(
          ctx, stateRef.current, layers, TILE_SIZE, selectedCiv, hover, frame
        );
      }

      if (now - lastFpsCheck > 500) {
        setFps((frames * 1000) / (now - lastFpsCheck));
        frames = 0;
        lastFpsCheck = now;
      }

     } catch (e) { console.error("[CIV loop]", e); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layers, selectedCiv, hover]);

  // Resize canvas backing store to design size; CSS will scale it
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W_TILES * TILE_SIZE;
    c.height = H_TILES * TILE_SIZE;
    // initial paint so we don't wait for first RAF
    const ctx = c.getContext("2d")!;
    (window as any).__render.renderWorld(ctx, stateRef.current, layers, TILE_SIZE, selectedCiv, hover, 0);
  }, []);

  const onCanvasMouseMove = (e: any) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    const tx = Math.floor(sx * W_TILES);
    const ty = Math.floor(sy * H_TILES);
    setHover({ x: tx, y: ty });
  };
  const onCanvasMouseLeave = () => setHover(null);

  const onCanvasClick = (e: any) => {
    if (!hover) return;
    // pick the city closest to the click within radius
    const s = stateRef.current;
    let best: City | null = null;
    let bd = 6;
    for (const c of s.cities) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x - hover.x, c.y - hover.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      setSelectedCiv(best.civId);
    } else {
      const t = (window as any).__sim.tileAt(s, hover.x, hover.y);
      if (t && t.ownerCiv !== null) setSelectedCiv(t.ownerCiv);
      else setSelectedCiv(null);
    }
  };

  const handleReset = () => {
    const ns = Math.floor(Math.random() * 1e9);
    setSeed(ns);
    (window as any).__render.invalidateTerrainCache();
    const fresh = (window as any).__sim.initSim(ns, W_TILES, H_TILES, 6);
    setState(fresh);
    stateRef.current = fresh;
    setSelectedCiv(null);
  };

  const handleDisaster = (kind: string) => {
    (window as any).__sim.triggerDisaster(stateRef.current, kind);
    forceTick(x => x + 1);
  };

  const setLayer = (key: keyof Layers, val: boolean) => {
    setLayers((p: Layers) => ({ ...p, [key]: val }));
  };

  const ui = (window as any).__ui;

  return (
    <div className="app" ref={containerRef}>
      <ui.HeaderBar
        state={state}
        speed={speed}
        playing={playing}
        fps={fps}
      />

      <div className="main-grid">
        {/* Left column */}
        <div className="col left">
          <ui.ControlBar
            playing={playing}
            speed={speed}
            onTogglePlay={() => setPlaying((p: boolean) => !p)}
            onSpeed={(s: number) => setSpeed(s)}
            onReset={handleReset}
          />
          <ui.LayerPanel layers={layers} onLayer={setLayer} />
          <ui.DisasterPanel onDisaster={handleDisaster} />
          <ui.CivDetail state={state} civId={selectedCiv} />
        </div>

        {/* Center: map canvas */}
        <div className="col center">
          <div className="map-shell">
            <div className="map-corners">
              <span className="corner tl" /><span className="corner tr" />
              <span className="corner bl" /><span className="corner br" />
            </div>
            <div className="map-coords mono">
              <span>LAT 48°N — 12°S</span>
              <span>LON 0° — 360°</span>
              <span>SECTOR · OIKOS-1</span>
            </div>
            <canvas
              ref={canvasRef}
              className="map-canvas"
              onMouseMove={onCanvasMouseMove}
              onMouseLeave={onCanvasMouseLeave}
              onClick={onCanvasClick}
            />
            <div className="map-readout mono">
              {hover ? (
                <span>
                  X:{String(hover.x).padStart(3, "0")} Y:{String(hover.y).padStart(3, "0")}
                  {(() => {
                    const t = stateRef.current.tiles[hover.y * W_TILES + hover.x];
                    if (!t) return null;
                    const civ = t.ownerCiv !== null ? stateRef.current.civs[t.ownerCiv] : null;
                    return (
                      <>
                        {" · "} <span className="readout-terrain">{terrainLabel(t.terrain)}</span>
                        {" · 肥沃 "}{(t.fertility * 100).toFixed(0)}
                        {" · 资源 "}{(t.resources * 100).toFixed(0)}
                        {civ && <> {" · "} <span style={{ color: civ.color }}>{civ.name}</span></>}
                      </>
                    );
                  })()}
                </span>
              ) : <span>移动光标查看坐标 / 点击文明查看详情</span>}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col right">
          <ui.Leaderboard state={state} selected={selectedCiv} onSelect={setSelectedCiv} />
          <ui.EventLog state={state} />
        </div>
      </div>
    </div>
  );
}

function terrainLabel(t: Terrain) {
  return ({
    ocean: "海洋", coast: "近海", plain: "平原", grass: "草原",
    forest: "森林", desert: "沙漠", mountain: "山脉", tundra: "苔原", river: "河流",
  } as Record<string, string>)[t] || t;
}

;(window as any).__App = App;
