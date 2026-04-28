// ============== Constants, Palette, Names ==============

const PALETTE = {
  bg: "#0a0e18",
  bgPanel: "#0f1524",
  bgSurface: "#141b2e",
  border: "#1f2a44",
  borderSoft: "#172033",
  text: "#dde6f5",
  textDim: "#7a8aa8",
  textVeryDim: "#465069",
  amber: "#ffb547",
  amberDim: "#8a5d1f",
  cyan: "#5ad6e8",
  cyanDim: "#2c6e7a",
  magenta: "#ff5577",
  green: "#7adf8e",
  red: "#ff4855",
  yellow: "#ffd24a",
  // terrain
  terrain: {
    ocean_deep: "#0a1830",
    ocean: "#0e2348",
    coast: "#19416a",
    plain: "#7a8a4a",
    grass: "#5d7a3a",
    forest: "#2c4a2a",
    desert: "#a08a4a",
    mountain: "#5a5450",
    mountain_high: "#8a8680",
    tundra: "#7a8090",
    river: "#3a78b8",
  } as Record<string, string>,
};

// 6 civilizations with curated hues; we generate same chroma+lightness in oklch via HSL fallback for reliability
const CIV_TEMPLATES: { name: string; ideology: string; hue: number; color: string }[] = [
  { name: "红河文明",  ideology: "灌溉王权",  hue: 12,  color: "#ff5d5d" },
  { name: "北境帝国",  ideology: "钢铁律法",  hue: 200, color: "#5cb8e8" },
  { name: "沙海联盟",  ideology: "商路议会",  hue: 42,  color: "#ffb547" },
  { name: "翠岭王朝",  ideology: "山林神权",  hue: 140, color: "#6cd49a" },
  { name: "黑曜共主",  ideology: "祭祀帝国",  hue: 300, color: "#c97aff" },
  { name: "白雾酋长",  ideology: "游牧氏族",  hue: 230, color: "#9aa8ff" },
];

const CITY_PREFIX = ["阿","巴","卡","德","埃","菲","古","赫","伊","卡","拉","摩","内","奥","佩","奎","瑞","萨","特","乌"];
const CITY_SUFFIX = ["卡","拉","姆","图","西","拿","贝","隆","尔","尼","萨","亚","堡","城","津","港"];

function makeCityName(rng: () => number) {
  const a = CITY_PREFIX[Math.floor(rng() * CITY_PREFIX.length)];
  const b = CITY_SUFFIX[Math.floor(rng() * CITY_SUFFIX.length)];
  const c = rng() < 0.4 ? CITY_SUFFIX[Math.floor(rng() * CITY_SUFFIX.length)] : "";
  return a + b + c;
}

const PLAGUE_NAMES = ["黑瘴热","赤斑症","咳血症","盐疫","蓝喉病","骨腐症","眠汗热","灰肺症"];
function plagueName(rng: () => number) {
  return PLAGUE_NAMES[Math.floor(rng() * PLAGUE_NAMES.length)];
}

;(window as any).__data = { PALETTE, CIV_TEMPLATES, makeCityName, plagueName };
;(window as any).PALETTE = PALETTE;
;(window as any).CIV_TEMPLATES = CIV_TEMPLATES;
;(window as any).makeCityName = makeCityName;
;(window as any).plagueName = plagueName;
