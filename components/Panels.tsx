// ============== UI Components ==============
// Floating CIC-style panels overlaid on the canvas: header, control bar,
// civ leaderboard, civ detail, event log, layer toggles, disaster triggers.

declare const PALETTE: any;
const { useState: useStateUI, useEffect: useEffectUI, useRef: useRefUI, useMemo: useMemoUI } = (window as any).React;

function fmt(n: number, digits = 0) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(digits);
}

function HeaderBar({ state, speed, playing, onTogglePlay, onSpeed, layers, onLayer, onDisaster, onReset, fps }: any) {
  const aliveCivs = state.civs.filter((c: Civilization) => c.alive).length;
  const totalPop = state.civs.reduce((s: number, c: Civilization) => s + (c.alive ? c.population : 0), 0);
  const wars = state.wars.filter((w: War) => w.active).length;
  const outbreaks = state.outbreaks.filter((o: DiseaseOutbreak) => o.active).length;
  const stability = (state.globalStability * 100).toFixed(1);
  const yr = state.year;
  const yrStr = yr < 0 ? `公元前 ${-yr}` : `公元 ${yr}`;

  return (
    <div className="hud-top">
      <div className="hud-left">
        <div className="brand">
          <div className="brand-mark">◣◢</div>
          <div>
            <div className="brand-title">文明崛起与崩溃 · 监控终端</div>
            <div className="brand-sub">CIVILIZATION RISE / COLLAPSE OBSERVATORY · v0.3</div>
          </div>
        </div>
      </div>
      <div className="hud-stats">
        <Stat label="纪年"        value={yrStr} mono />
        <Stat label="存续文明"    value={`${aliveCivs} / ${state.civs.length}`} />
        <Stat label="世界人口"    value={fmt(totalPop * 1000)} />
        <Stat label="活跃战争"    value={String(wars)} accent={wars ? "red" : undefined} />
        <Stat label="瘟疫扩散"    value={String(outbreaks)} accent={outbreaks ? "magenta" : undefined} />
        <Stat label="全球稳定"    value={stability + "%"} accent={Number(stability) < 50 ? "red" : "cyan"} />
        <Stat label="FPS"         value={fps.toFixed(0)} mono dim />
      </div>
    </div>
  );
}

function Stat({ label, value, mono, dim, accent }: any) {
  const cls = ["stat"];
  if (mono) cls.push("mono");
  if (dim) cls.push("dim");
  if (accent) cls.push("accent-" + accent);
  return (
    <div className={cls.join(" ")}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function ControlBar({ playing, speed, onTogglePlay, onSpeed, onReset }: any) {
  return (
    <div className="control-bar">
      <button className="btn primary" onClick={onTogglePlay}>{playing ? "■ 暂停" : "▶ 播放"}</button>
      <div className="speed-group">
        {[1,2,4,8,16].map((s) => (
          <button key={s} className={"btn small" + (speed === s ? " on" : "")} onClick={() => onSpeed(s)}>×{s}</button>
        ))}
      </div>
      <button className="btn small" onClick={onReset}>↻ 重置世界</button>
    </div>
  );
}

function LayerPanel({ layers, onLayer }: any) {
  const items: { key: keyof Layers; label: string; color?: string }[] = [
    { key: "terrain", label: "地形" },
    { key: "borders", label: "文明边界", color: PALETTE.amber },
    { key: "cities", label: "城市" },
    { key: "trade", label: "贸易路线", color: PALETTE.cyan },
    { key: "war", label: "战争", color: PALETTE.red },
    { key: "disease", label: "疾病扩散", color: PALETTE.magenta },
    { key: "resources", label: "资源" },
    { key: "collapse", label: "崩溃风险", color: PALETTE.red },
    { key: "grid", label: "坐标网格" },
  ];
  return (
    <Panel title="图层" subtitle="LAYERS">
      <div className="layer-grid">
        {items.map((it) => (
          <label key={it.key} className={"layer-item" + (layers[it.key] ? " on" : "")}>
            <input
              type="checkbox"
              checked={layers[it.key]}
              onChange={(e) => onLayer(it.key, e.target.checked)}
            />
            <span className="layer-dot" style={{ background: it.color || "#7a8aa8" }} />
            <span>{it.label}</span>
          </label>
        ))}
      </div>
    </Panel>
  );
}

function DisasterPanel({ onDisaster }: any) {
  return (
    <Panel title="灾害触发" subtitle="DISASTER TRIGGERS" accent="amber">
      <div className="disaster-grid">
        <button className="btn disaster" onClick={() => onDisaster("drought")}>🜂 大旱</button>
        <button className="btn disaster" onClick={() => onDisaster("plague")}>🜍 瘟疫</button>
        <button className="btn disaster" onClick={() => onDisaster("invasion")}>⚔ 入侵</button>
        <button className="btn disaster" onClick={() => onDisaster("depletion")}>⌬ 资源枯竭</button>
      </div>
    </Panel>
  );
}

function Leaderboard({ state, selected, onSelect }: any) {
  const civs = [...state.civs].sort((a: Civilization, b: Civilization) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return b.population - a.population;
  });
  return (
    <Panel title="文明列表" subtitle="CIV REGISTRY">
      <div className="civ-list">
        <div className="civ-row head">
          <div></div>
          <div>名称</div>
          <div className="r">人口</div>
          <div className="r">财富</div>
          <div className="r">军力</div>
          <div className="r">崩溃</div>
        </div>
        {civs.map((c: Civilization) => {
          const sel = selected === c.id;
          const stage = c.collapseStage;
          return (
            <div
              key={c.id}
              className={"civ-row" + (sel ? " sel" : "") + (!c.alive ? " dead" : "")}
              onClick={() => onSelect(sel ? null : c.id)}
            >
              <div className="civ-color" style={{ background: c.color }} />
              <div className="civ-name">
                {c.name}
                <span className="civ-ideology"> · {c.ideology}</span>
                {!c.alive && <span className="dead-tag"> [崩溃]</span>}
                {c.alive && stage >= 2 && <span className="warn-tag"> [崩溃中]</span>}
                {c.alive && stage === 1 && <span className="warn-tag amb"> [压力]</span>}
              </div>
              <div className="r mono">{fmt(c.population)}</div>
              <div className="r mono">{fmt(c.wealth)}</div>
              <div className="r mono">{fmt(c.military)}</div>
              <div className="r mono">
                <RiskBar value={c.collapseRisk} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function RiskBar({ value }: { value: number }) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="risk-bar">
      <div className="risk-fill" style={{ width: `${v * 100}%`, background: v > 0.7 ? PALETTE.red : v > 0.45 ? PALETTE.amber : PALETTE.cyan }} />
      <span className="risk-text mono">{(v * 100).toFixed(0)}%</span>
    </div>
  );
}

function CivDetail({ state, civId }: any) {
  if (civId === null || civId === undefined) {
    return (
      <Panel title="文明详情" subtitle="CIV DETAIL" accent="cyan">
        <div className="muted small">点击右侧任一文明以查看详细数据</div>
      </Panel>
    );
  }
  const civ: Civilization = state.civs[civId];
  const cap = state.cities.find((c: City) => c.id === civ.capitalId);
  const cities = state.cities.filter((c: City) => c.civId === civId && c.alive);
  return (
    <Panel title={civ.name} subtitle={civ.ideology.toUpperCase()} accent="cyan" colorBar={civ.color}>
      <div className="detail-grid">
        <Metric label="存续年代" value={`${civ.age} 年`} />
        <Metric label="首都"     value={cap ? cap.name : "—"} />
        <Metric label="城市数"   value={String(cities.length)} />
        <Metric label="人口"     value={fmt(civ.population * 1000)} />
        <Metric label="财富"     value={fmt(civ.wealth)} />
        <Metric label="技术"     value={civ.tech.toFixed(1)} />
        <Metric label="军事"     value={civ.military.toFixed(0)} />
        <Metric label="稳定度"   value={(civ.stability * 100).toFixed(0) + "%"} />
      </div>
      <div className="bar-list">
        <BarRow label="战争疲劳" value={civ.warExhaustion} color={PALETTE.red} />
        <BarRow label="疾病压力" value={civ.diseaseStress} color={PALETTE.magenta} />
        <BarRow label="气候压力" value={civ.climateStress} color={PALETTE.amber} />
        <BarRow label="崩溃风险" value={civ.collapseRisk} color={PALETTE.red} big />
      </div>
      <div className="city-mini">
        <div className="mini-title">城市 ({cities.length})</div>
        <div className="city-mini-list">
          {cities.slice().sort((a: City, b: City) => b.population - a.population).slice(0, 8).map((c: City) => (
            <div key={c.id} className="city-row">
              <span className={"city-dot" + (c.id === civ.capitalId ? " cap" : "")} style={{ background: civ.color }} />
              <span className="cn">{c.name}</span>
              <span className="mono r">{fmt(c.population * 1000)}</span>
              {c.disease > 0.1 && <span className="badge mag">疫</span>}
              {c.unrest > 0.4 && <span className="badge amb">乱</span>}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Metric({ label, value }: any) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value mono">{value}</div>
    </div>
  );
}

function BarRow({ label, value, color, big }: any) {
  return (
    <div className={"bar-row" + (big ? " big" : "")}>
      <div className="bar-row-label">{label}</div>
      <div className="bar-row-track">
        <div className="bar-row-fill" style={{ width: `${value * 100}%`, background: color }} />
      </div>
      <div className="bar-row-val mono">{(value * 100).toFixed(0)}%</div>
    </div>
  );
}

function EventLog({ state }: any) {
  const SEV_COLOR = ["#7a8aa8", "#5ad6e8", "#ffb547", "#ff4855"];
  const TYPE_LABEL: Record<string, string> = {
    founding: "建国", war: "战争", peace: "和约", plague: "瘟疫",
    famine: "饥荒", collapse: "崩溃", fracture: "动乱", trade: "贸易",
    disaster: "灾害", milestone: "纪事",
  };
  return (
    <Panel title="事件日志" subtitle="EVENT FEED" accent="amber">
      <div className="event-log">
        {state.events.slice(0, 60).map((e: WorldEvent, i: number) => {
          const civ = e.civId !== undefined ? state.civs[e.civId] : null;
          return (
            <div key={i} className="event-row">
              <span className="ev-yr mono">{e.year < 0 ? "BC " + -e.year : "AD " + e.year}</span>
              <span className="ev-type mono" style={{ color: SEV_COLOR[e.severity] }}>{TYPE_LABEL[e.type] || e.type}</span>
              {civ && <span className="ev-civ-dot" style={{ background: civ.color }} />}
              <span className="ev-text">{e.text}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Panel({ title, subtitle, accent, colorBar, children }: any) {
  return (
    <div className={"panel" + (accent ? " a-" + accent : "")}>
      {colorBar && <div className="panel-color-bar" style={{ background: colorBar }} />}
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        {subtitle && <div className="panel-sub mono">{subtitle}</div>}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

;(window as any).__ui = { HeaderBar, ControlBar, LayerPanel, DisasterPanel, Leaderboard, CivDetail, EventLog, Panel };
