import {
  defaults,
  clone,
  uid,
  type Project,
  type Settings,
  type Item,
  type Mark,
  type Action,
  type V3,
  type Light,
} from "./model";

export type Brush = "ink" | "pencil" | "marker" | "brush";
export const brushes: [string, string][] = [
  ["ink", "圆珠 / 墨水笔"],
  ["pencil", "石墨铅笔"],
  ["marker", "半透明荧光笔"],
  ["brush", "压力毛笔"],
];
export const fonts = [
  "Microsoft YaHei",
  "SimSun",
  "KaiTi",
  "SimHei",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Segoe UI",
];
export const gobos: [string, string][] = [
  ["none", "无投影片"],
  ["window", "窗格日光"],
  ["blinds", "百叶窗"],
  ["foliage", "树影斑驳"],
  ["lattice", "格栅光"],
];
export const looks = [
  {
    name: "暖冷电影",
    keyIntensity: 3.5,
    ambient: 0.34,
    keyAzimuth: 130,
    keyElevation: 48,
    keyColor: "#ffe0b0",
    softness: 2,
    exposure: 1.04,
  },
  {
    name: "Noir 硬光",
    keyIntensity: 3.8,
    ambient: 0.12,
    keyAzimuth: 168,
    keyElevation: 28,
    keyColor: "#d0d9df",
    softness: 0.5,
    exposure: 1.1,
  },
  {
    name: "柔和档案",
    keyIntensity: 2.8,
    ambient: 0.8,
    keyAzimuth: 110,
    keyElevation: 70,
    keyColor: "#ffedcd",
    softness: 4,
    exposure: 1,
  },
  {
    name: "金色侧逆光",
    keyIntensity: 5,
    ambient: 0.3,
    keyAzimuth: 25,
    keyElevation: 24,
    keyColor: "#f5cc90",
    softness: 1.5,
    exposure: 1,
  },
  {
    name: "追光调查",
    keyIntensity: 1,
    ambient: 0.18,
    keyAzimuth: 135,
    keyElevation: 45,
    keyColor: "#e8d4b3",
    softness: 1.5,
    exposure: 1.1,
  },
  {
    name: "窗边午后",
    keyIntensity: 0.45,
    ambient: 0.55,
    keyAzimuth: 135,
    keyElevation: 45,
    keyColor: "#fff0d0",
    softness: 2,
    exposure: 1.05,
    gobo: "window",
  },
  {
    name: "百叶 Noir",
    keyIntensity: 0.3,
    ambient: 0.2,
    keyAzimuth: 135,
    keyElevation: 45,
    keyColor: "#cfdae4",
    softness: 0.6,
    exposure: 1.05,
    gobo: "blinds",
  },
  {
    name: "林荫晨光",
    keyIntensity: 0.55,
    ambient: 0.5,
    keyAzimuth: 130,
    keyElevation: 40,
    keyColor: "#ffefcb",
    softness: 2.5,
    exposure: 1.05,
    gobo: "foliage",
  },
  {
    name: "冷调月窗",
    keyIntensity: 0.2,
    ambient: 0.22,
    keyAzimuth: 130,
    keyElevation: 40,
    keyColor: "#a9c9ef",
    softness: 1,
    exposure: 1.12,
    gobo: "lattice",
  },
];
/** Optional additions preserve all v3 authored layout, camera and tracks. */
export function upgrade(p: Project): Project {
  p.settings = { ...defaults(), ...p.settings };
  p.marks.forEach((m) => {
    m.brush ??= "ink";
  });
  return p;
}
export function applyCinemaLook(p: Project, i: number) {
  const look = looks[i];
  if (!look) return;
  const { name, gobo, ...settings } = look;
  Object.assign(p.settings, settings);
  // Keep stable ID so authored light cues survive a preset change.
  const managed = p.lights.find((l) => l.presetManaged);
  if (gobo) {
    const next = sunlight(gobo as Light["gobo"], p.settings.keyColor, true);
    if (managed) Object.assign(managed, { ...next, id: managed.id });
    else p.lights.push(next);
  } else if (managed) {
    managed.enabled = false;
    managed.intensity = 0;
  }
}
export function sunlight(
  gobo: Light["gobo"] = "window",
  color = "#fff0d4",
  managed = false,
): Light {
  return {
    id: uid("light"),
    name: "窗外日光",
    position: [-7, 8, 13],
    target: [0, 0, 0],
    local: [0, 0, 0.02],
    color,
    intensity: 780,
    angle: 32,
    penumbra: 0.35,
    distance: 60,
    decay: 2,
    shadow: true,
    enabled: true,
    gobo,
    goboRotation: -18,
    goboScale: 1,
    presetManaged: managed,
  };
}
export function animationOptions(
  p: Project,
  id: string,
  current?: Action["type"],
): [Action["type"], string][] {
  const options = componentAnimations(p, id);
  if (current && !options.some((o) => o[0] === current))
    options.push([current, "保留已有：" + current]);
  return options;
}
function componentAnimations(
  p: Project,
  id: string,
): [Action["type"], string][] {
  const kind = p.items.find((o) => o.id === id)?.kind;
  if (p.ropes.some((o) => o.id === id)) return [["grow", "绳索拉出"]];
  if (p.marks.some((o) => o.id === id)) return [["draw", "逐笔书写"]];
  if (p.pins.some((o) => o.id === id) || kind === "pin")
    return [
      ["pin", "图钉钉入"],
      ["settle", "落下"],
    ];
  if (kind === "clip")
    return [
      ["clamp", "夹子张开 → 夹紧"],
      ["slide", "侧向夹入"],
    ];
  if (kind === "staple")
    return [
      ["thread", "回形针套入"],
      ["slide", "滑入"],
    ];
  if (kind === "tape")
    return [
      ["peel", "胶带滚贴"],
      ["settle", "贴附"],
    ];
  if (kind === "stamp") return [["stamp", "印章压印"]];
  if (kind === "folder")
    return [
      ["slide", "档案袋滑入"],
      ["settle", "放落"],
    ];
  return [
    ["peel", "柔纸铺贴"],
    ["settle", "纸张落下"],
    ["slide", "滑入"],
    ["type", "文字写入"],
  ];
}
export function annotation(
  o: Item | undefined,
  shape: string,
  brush: Brush,
  radius: number,
  color: string,
): Mark {
  const w = (o?.width ?? 4) * 0.34,
    h = (o?.height ?? 3) * 0.28;
  const points: V3[] = [];
  if (shape === "circle")
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      points.push([Math.cos(a) * w, Math.sin(a) * h, 0]);
    }
  else if (shape === "underline")
    for (let i = 0; i <= 60; i++)
      points.push([-w + (i / 60) * w * 2, -h + 0.018 * Math.sin(i * 0.24), 0]);
  else if (shape === "arrow") {
    for (let i = 0; i <= 60; i++)
      points.push([-w + (i / 60) * w * 2, 0.02 * Math.sin(i * 0.12), 0]);
    points.push([w - 0.35, 0.3, 0], [w, 0, 0], [w - 0.35, -0.3, 0]);
  } else
    for (let i = 0; i <= 60; i++)
      points.push([
        -w + (i / 60) * w * 2,
        h * Math.sin((i / 60) * Math.PI * 2) * 0.22,
        0,
      ]);
  return { id: uid("mark"), hostId: o?.id, points, radius, color, brush };
}

export function boardFit(p: Project) {
  const extent = [...p.items.filter((o) => !o.hidden)].reduce(
    (a, o) => [
      Math.max(
        a[0],
        Math.abs(o.position[0]) + (Math.hypot(o.width, o.height) * o.scale) / 2,
      ),
      Math.max(
        a[1],
        Math.abs(o.position[1]) + (Math.hypot(o.width, o.height) * o.scale) / 2,
      ),
    ],
    [5, 4],
  );
  p.settings.boardWidth = extent[0] * 2 + 3;
  p.settings.boardHeight = extent[1] * 2 + 3;
}
export function boardPose(p: Project) {
  const aspect = { "16:9": 16 / 9, "9:16": 9 / 16, "3:4": 3 / 4, "1:1": 1 }[
      p.settings.aspect
    ],
    focal = 40;
  const tan = 35 / (2 * focal * Math.max(1, aspect));
  return {
    target: [0, 0, 0.05] as V3,
    distance:
      Math.max(
        p.settings.boardHeight / 2 / tan,
        p.settings.boardWidth / 2 / (tan * aspect),
      ) * 1.2,
    yaw: 0.08,
    pitch: -0.08,
    roll: 0,
    focal,
  };
}
