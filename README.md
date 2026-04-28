# Civilization Rise & Collapse · Observatory

[中文](./README.zh-CN.md) · English

A real-time, museum-grade strategic-command-center simulator of multiple civilizations rising, trading, fighting, plaguing and collapsing on a procedurally generated continent. Pure code, no images / textures / videos / external maps.

**Live demo:** https://civilization-rise-and-collapse.vercel.app/
**Source:** https://github.com/wfxu/civilization-rise-and-collapse

---

## Stack

- React 18 + TypeScript + HTML Canvas
- Babel standalone (in-browser TS/TSX compilation) — **no build step**
- Static deploy (Vercel, GitHub Pages, any static host)

## Run locally

Just open `index.html` over HTTP (browsers refuse `file://` for module scripts):

```bash
npx serve .
# or
python -m http.server 8000
```

## Project structure

```
utils/        types, RNG, value-noise
data/         palette, civilization templates, name generator
simulation/   world (terrain / rivers), engine (civ / city / trade / war / disease / collapse)
rendering/    canvas renderer (contours, scanlines, glows, pulse rings)
components/   App, Panels
index.html    entry — loads modules in dependency order
styles.css
```

## Features

- Procedural map: dual-centroid continent + value-noise + river backtracking — ocean / coast / plain / grassland / forest / desert / mountain / tundra
- 6 civilizations with distinct ideologies
- Cities with food / population / wealth / disease / unrest; spontaneous plagues at high density; ruins on collapse
- Trade routes with animated caravans; spread disease; broken by war
- Wars: declaration, frontline jitter, city flips, peace
- Diseases: pulse rings, distance + trade propagation
- Collapse risk = instability + war fatigue + plague + climate + famine; 4 phases; civs may split or disappear
- Disaster triggers: drought / plague / invasion / resource depletion
- 9 toggleable layers, ×1–×16 speed, world reset
- Color-coded event log

## Origin

Generated end-to-end by [Claude Design](https://claude.ai/design) from a single Chinese prompt — see [PROMPT.md](./PROMPT.md).

## License

MIT — see [LICENSE](./LICENSE).
