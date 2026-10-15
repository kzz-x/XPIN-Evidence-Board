export type V3 = [number, number, number];
export type Kind =
  | "photo"
  | "polaroid"
  | "film"
  | "file"
  | "news"
  | "folder"
  | "profile"
  | "note"
  | "label"
  | "date"
  | "pin"
  | "clip"
  | "tape"
  | "staple"
  | "stamp"
  | "map";
export type Mode = "build" | "director" | "play";
export interface Transform {
  position: V3;
  rotation: number;
  scale: number;
}
export interface Item extends Transform {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  width: number;
  height: number;
  color: string;
  assetId?: string;
  locked: boolean;
  hidden: boolean;
  groupId?: string;
  font?: string;
  fontScale?: number;
  entrance?: Action["type"];
  roughness?: number;
  paperCurl?: number;
  fiberStrength?: number;
}
export interface Pin {
  id: string;
  roughness?: number;
  hostId?: string;
  local: V3;
  color: string;
}
export interface Rope {
  id: string;
  from: string;
  to: string;
  color: string;
  radius: number;
  slack: number;
  bend: number;
  style: "cotton" | "nylon" | "hemp";
  control?: V3;
}
export interface Mark {
  id: string;
  hostId?: string;
  points: V3[];
  color: string;
  radius: number;
  brush?: "ink" | "pencil" | "marker" | "brush";
}
export interface Light {
  id: string;
  name: string;
  position: V3;
  target: V3;
  hostId?: string;
  local: V3;
  color: string;
  intensity: number;
  angle: number;
  penumbra: number;
  distance: number;
  decay: number;
  shadow: boolean;
  enabled: boolean;
  gobo?: "none" | "window" | "blinds" | "foliage" | "lattice";
  goboRotation?: number;
  goboScale?: number;
  presetManaged?: boolean;
}
export interface Pose {
  target: V3;
  distance: number;
  yaw: number;
  pitch: number;
  roll: number;
  focal: number;
}
export interface Cue {
  id: string;
  lightId: string;
  start: number;
  duration: number;
  targetId?: string;
  from: V3;
  to: V3;
  fromIntensity: number;
  toIntensity: number;
  fromAngle: number;
  toAngle: number;
  ease: "smooth" | "linear" | "hold";
}
export interface Action {
  id: string;
  targetId: string;
  start: number;
  duration: number;
  type:
    | "settle"
    | "slide"
    | "type"
    | "grow"
    | "draw"
    | "stamp"
    | "peel"
    | "clamp"
    | "pin"
    | "thread";
  strength: number;
  phase?: "in" | "out";
  ease?: import("./motion").Ease;
  bezier?: import("./motion").Bezier;
  /** Fraction of the action used for the opacity ramp. Zero explicitly disables it. */
  fade?: number;
  origin?: "screen" | "local" | "stationary";
  direction?: "left" | "right" | "top" | "bottom";
  travel?: number;
}
export interface Shot {
  id: string;
  title: string;
  duration: number;
  targetIds: string[];
  camera: Pose;
  manualCamera?: boolean;
  motion: "focus" | "push" | "pan" | "rope" | "overview";
  ropeId?: string;
  ease: "smooth" | "linear";
  actions: Action[];
  cues: Cue[];
}
export interface Settings {
  board: "cork" | "felt" | "wood" | "grid";
  aspect: "16:9" | "9:16" | "3:4" | "1:1";
  exposure: number;
  ambient: number;
  keyIntensity: number;
  keyAzimuth: number;
  keyElevation: number;
  keyColor: string;
  softness: number;
  quality: "draft" | "studio" | "ultra";
  dof: number;
  focusOffset: number;
  grid: boolean;
  renderScale: number;
  grain: number;
  boardWidth: number;
  boardHeight: number;
  frameWidth: number;
  frameColor: string;
  frame: boolean;
  font: string;
  fontScale: number;
  orbitReverse: boolean;
  boardTextureScale: number;
}
export interface Preset {
  id: string;
  name: string;
  items: Item[];
  pins: Pin[];
  ropes: Rope[];
  marks: Mark[];
}
export interface Project {
  version: 3;
  name: string;
  seed: number;
  items: Item[];
  pins: Pin[];
  ropes: Rope[];
  marks: Mark[];
  lights: Light[];
  shots: Shot[];
  assets: Record<string, string>;
  settings: Settings;
  camera: Pose;
  presets: Preset[];
  favorites: string[];
  audio?: string;
}
export const uid = (prefix = "o") => `${prefix}-${crypto.randomUUID()}`;
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix3 = (a: V3, b: V3, t: number): V3 => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];
export const smooth = (t: number) => (
  (t = clamp(t, 0, 1)),
  t * t * (3 - 2 * t)
);
export const defaultPose = (): Pose => ({
  target: [0, 0, 0],
  distance: 23,
  yaw: 0.12,
  pitch: -0.13,
  roll: 0,
  focal: 40,
});
export const defaults = (): Settings => ({
  board: "felt",
  aspect: "16:9",
  exposure: 1.0,
  ambient: 0.27,
  keyIntensity: 2.4,
  keyAzimuth: 135,
  keyElevation: 42,
  keyColor: "#ffdfad",
  softness: 1.7,
  quality: "studio",
  dof: 0.35,
  focusOffset: 0,
  grid: false,
  renderScale: 1.25,
  grain: 0.002,
  boardWidth: 23,
  boardHeight: 17,
  frameWidth: 0.3,
  frameColor: "#352b23",
  frame: true,
  font: "Microsoft YaHei",
  fontScale: 1,
  orbitReverse: false,
  boardTextureScale: 2.5,
});
export function emptyProject(): Project {
  return {
    version: 3,
    name: "未命名调查",
    seed: 47,
    items: [],
    pins: [],
    ropes: [],
    marks: [],
    lights: [],
    shots: [],
    assets: {},
    settings: defaults(),
    camera: defaultPose(),
    presets: [],
    favorites: [],
  };
}
export function localToWorld(item: Transform, p: V3): V3 {
  const c = Math.cos(item.rotation),
    s = Math.sin(item.rotation),
    k = item.scale;
  return [
    item.position[0] + (p[0] * c - p[1] * s) * k,
    item.position[1] + (p[0] * s + p[1] * c) * k,
    item.position[2] + p[2] * k,
  ];
}
export function worldToLocal(item: Transform, p: V3): V3 {
  const x = p[0] - item.position[0],
    y = p[1] - item.position[1],
    c = Math.cos(item.rotation),
    s = Math.sin(item.rotation);
  return [
    (x * c + y * s) / item.scale,
    (-x * s + y * c) / item.scale,
    (p[2] - item.position[2]) / item.scale,
  ];
}
export function pinWorld(
  project: Project,
  pin: Pin,
  transforms?: Map<string, Transform>,
): V3 {
  const host = project.items.find((o) => o.id === pin.hostId);
  return host
    ? localToWorld(transforms?.get(host.id) ?? host, pin.local)
    : [...pin.local];
}
export const ratio = (aspect: Settings["aspect"]) =>
  ({ "16:9": 16 / 9, "9:16": 9 / 16, "3:4": 3 / 4, "1:1": 1 })[aspect];
export function poseFor(
  project: Project,
  ids: string[],
  motion: Shot["motion"] = "focus",
): Pose {
  const items = project.items.filter(
    (o) => !o.hidden && (!ids.length || ids.includes(o.id)),
  );
  if (!items.length) return defaultPose();
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const o of items) {
    const c = Math.abs(Math.cos(o.rotation)),
      s = Math.abs(Math.sin(o.rotation));
    const w = (o.width * c + o.height * s) * o.scale,
      h = (o.height * c + o.width * s) * o.scale;
    x0 = Math.min(x0, o.position[0] - w / 2);
    x1 = Math.max(x1, o.position[0] + w / 2);
    y0 = Math.min(y0, o.position[1] - h / 2);
    y1 = Math.max(y1, o.position[1] + h / 2);
  }
  const target: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, 0.1],
    focal = motion === "overview" ? 40 : 55;
  // 36 mm sensor and output aspect, with safe margins for the oblique view.
  const tan = 35 / (2 * focal * Math.max(1, ratio(project.settings.aspect)));
  const distance =
    Math.max(
      (y1 - y0) / 2 / tan,
      (x1 - x0) / 2 / (tan * ratio(project.settings.aspect)),
    ) * 1.22;
  return {
    target,
    distance: Math.max(4, distance),
    yaw: motion === "overview" ? 0.1 : -0.18,
    pitch: -0.18,
    roll: 0,
    focal,
  };
}
export function makeLight(p: V3 = [-3, 5, 7]): Light {
  return {
    id: uid("light"),
    name: "追光灯",
    position: p,
    target: [0, 0, 0],
    local: [0, 0, 0.02],
    color: "#ffdfae",
    intensity: 90,
    angle: 32,
    penumbra: 0.65,
    distance: 35,
    decay: 2,
    shadow: true,
    enabled: true,
  };
}
export function makeShot(
  project: Project,
  ids: string[],
  motion: Shot["motion"] = "focus",
): Shot {
  return {
    id: uid("shot"),
    title: ids.length
      ? (project.items.find((o) => o.id === ids[0])?.title ?? "证据特写")
      : "关系网全览",
    duration: 4,
    targetIds: ids,
    camera: poseFor(project, ids, motion),
    motion,
    ease: "smooth",
    actions: [],
    cues: [],
  };
}
export function duplicateSelection(
  project: Project,
  ids: string[],
  offset: V3 = [0.5, -0.5, 0],
): string[] {
  const map = new Map<string, string>(),
    groupMap = new Map<string, string>();
  const chosen = project.items.filter((o) => ids.includes(o.id));
  const newItems = chosen.map((o) => {
    const n = clone(o);
    map.set(o.id, (n.id = uid()));
    n.position = mix3(
      n.position,
      [
        n.position[0] + offset[0],
        n.position[1] + offset[1],
        n.position[2] + offset[2],
      ],
      1,
    );
    if (o.groupId) {
      if (!groupMap.has(o.groupId)) groupMap.set(o.groupId, uid("group"));
      n.groupId = groupMap.get(o.groupId);
    }
    return n;
  });
  const pins = project.pins
    .filter((p) => p.hostId && map.has(p.hostId))
    .map((p) => {
      const n = clone(p);
      map.set(p.id, (n.id = uid("pin")));
      n.hostId = map.get(p.hostId!);
      return n;
    });
  const ropes = project.ropes
    .filter((r) => map.has(r.from) && map.has(r.to))
    .map((r) => ({
      ...clone(r),
      id: uid("rope"),
      from: map.get(r.from)!,
      to: map.get(r.to)!,
    }));
  const marks = project.marks
    .filter((m) => m.hostId && map.has(m.hostId))
    .map((m) => ({ ...clone(m), id: uid("mark"), hostId: map.get(m.hostId!) }));
  project.items.push(...newItems);
  project.pins.push(...pins);
  project.ropes.push(...ropes);
  project.marks.push(...marks);
  return newItems.map((o) => o.id);
}
export function removeIds(project: Project, ids: string[]) {
  const deleted = new Set(ids);
  for (const p of project.pins)
    if (p.hostId && deleted.has(p.hostId)) deleted.add(p.id);
  project.items = project.items.filter((o) => !deleted.has(o.id));
  project.pins = project.pins.filter((p) => !deleted.has(p.id));
  project.ropes = project.ropes.filter(
    (r) => !deleted.has(r.id) && !deleted.has(r.from) && !deleted.has(r.to),
  );
  project.marks = project.marks.filter(
    (m) => !deleted.has(m.id) && !deleted.has(m.hostId ?? ""),
  );
  project.lights = project.lights.filter((l) => !deleted.has(l.id));
  project.lights.forEach((l) => {
    if (l.hostId && deleted.has(l.hostId)) {
      l.hostId = undefined;
    }
  });
  project.shots.forEach((s) => {
    s.targetIds = s.targetIds.filter((id) => !deleted.has(id));
    s.actions = s.actions.filter((a) => !deleted.has(a.targetId));
    s.cues = s.cues.filter((c) => !deleted.has(c.lightId));
    s.cues.forEach((c) => {
      if (c.targetId && deleted.has(c.targetId)) c.targetId = undefined;
    });
  });
}
export function validateProject(p: unknown): Project {
  const s = p as Project;
  if (
    !s ||
    s.version !== 3 ||
    !Array.isArray(s.items) ||
    !Array.isArray(s.pins) ||
    !Array.isArray(s.ropes) ||
    !Array.isArray(s.marks) ||
    !Array.isArray(s.shots) ||
    !Array.isArray(s.lights) ||
    !s.settings ||
    !s.camera ||
    !s.assets
  )
    throw new Error("不是有效的 XPIN 工程");
  const validId = (id: unknown) =>
    typeof id === "string" && /^[a-z0-9_-]{1,100}$/i.test(id);
  const all = [
      ...s.items,
      ...s.pins,
      ...s.ropes,
      ...s.marks,
      ...s.lights,
      ...s.shots,
    ],
    ids = all.map((o) => o.id);
  if (ids.some((id) => !validId(id)) || new Set(ids).size !== ids.length)
    throw new Error("工程中含无效或重复 ID");
  const vector = (v: unknown): v is V3 =>
    Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  for (const o of s.items)
    if (
      !vector(o.position) ||
      ![o.width, o.height, o.scale, o.rotation].every(Number.isFinite) ||
      o.width <= 0 ||
      o.height <= 0 ||
      o.scale <= 0
    )
      throw new Error("物件参数无效");
  for (const l of s.lights)
    if (
      !vector(l.position) ||
      !vector(l.target) ||
      !Number.isFinite(l.intensity)
    )
      throw new Error("灯光参数无效");
  const itemIds = new Set(s.items.map((o) => o.id)),
    pinIds = new Set(s.pins.map((o) => o.id));
  for (const p of s.pins)
    if (!vector(p.local) || (p.hostId && !itemIds.has(p.hostId)))
      throw new Error("图钉宿主无效");
  for (const r of s.ropes)
    if (
      !pinIds.has(r.from) ||
      !pinIds.has(r.to) ||
      !Number.isFinite(r.radius) ||
      r.radius <= 0
    )
      throw new Error("红绳端点无效");
  for (const m of s.marks)
    if (!m.points.every(vector) || (m.hostId && !itemIds.has(m.hostId)))
      throw new Error("标注宿主无效");
  for (const shot of s.shots)
    if (
      !Number.isFinite(shot.duration) ||
      shot.duration <= 0 ||
      !Array.isArray(shot.actions) ||
      !Array.isArray(shot.cues)
    )
      throw new Error("镜头时长无效");
  for (const uri of Object.values(s.assets))
    if (!/^data:image\/(png|jpeg|webp|svg\+xml)[;,]/i.test(uri))
      throw new Error("素材必须嵌入工程，不能引用临时或远程地址");
  const kinds = [
    "photo",
    "polaroid",
    "film",
    "file",
    "news",
    "folder",
    "profile",
    "note",
    "label",
    "date",
    "pin",
    "clip",
    "tape",
    "staple",
    "stamp",
    "map",
  ];
  const validColor = (v: unknown) =>
      typeof v === "string" && /^#[\da-f]{6}$/i.test(v),
    numbers = (...values: number[]) => values.every(Number.isFinite);
  for (const o of s.items)
    if (
      !kinds.includes(o.kind) ||
      typeof o.title !== "string" ||
      typeof o.body !== "string" ||
      !validColor(o.color) ||
      (o.assetId && !s.assets[o.assetId])
    )
      throw new Error("模块内容或素材引用无效");
  for (const r of s.ropes)
    if (
      !validColor(r.color) ||
      !numbers(r.slack, r.bend) ||
      (r.control && !vector(r.control)) ||
      !["cotton", "nylon", "hemp"].includes(r.style)
    )
      throw new Error("绳索参数无效");
  for (const m of s.marks)
    if (!validColor(m.color) || !numbers(m.radius) || m.radius <= 0)
      throw new Error("笔迹参数无效");
  for (const pin of s.pins)
    if (!validColor(pin.color)) throw new Error("图钉颜色无效");
  for (const l of s.lights)
    if (
      !validColor(l.color) ||
      !vector(l.local) ||
      !numbers(l.intensity, l.angle, l.penumbra, l.distance, l.decay) ||
      (l.hostId && !itemIds.has(l.hostId))
    )
      throw new Error("追光绑定或参数无效");
  const poseValid = (p: Pose) =>
    p &&
    vector(p.target) &&
    numbers(p.distance, p.yaw, p.pitch, p.roll, p.focal) &&
    p.distance > 0 &&
    p.focal > 0;
  if (!poseValid(s.camera)) throw new Error("摄影机参数无效");
  if (
    !["cork", "felt", "wood", "grid"].includes(s.settings.board) ||
    !["16:9", "9:16", "3:4", "1:1"].includes(s.settings.aspect) ||
    !["draft", "studio", "ultra"].includes(s.settings.quality) ||
    !validColor(s.settings.keyColor) ||
    !numbers(
      s.settings.exposure,
      s.settings.ambient,
      s.settings.keyIntensity,
      s.settings.keyAzimuth,
      s.settings.keyElevation,
      s.settings.softness,
      s.settings.dof,
      s.settings.focusOffset,
    )
  )
    throw new Error("场景参数无效");
  const entities = new Set([
      ...itemIds,
      ...pinIds,
      ...s.ropes.map((r) => r.id),
      ...s.marks.map((m) => m.id),
    ]),
    lightIds = new Set(s.lights.map((l) => l.id));
  for (const shot of s.shots) {
    if (
      !poseValid(shot.camera) ||
      !Array.isArray(shot.targetIds) ||
      shot.targetIds.some((id) => !entities.has(id))
    )
      throw new Error("镜头目标无效");
    for (const a of shot.actions)
      if (
        !entities.has(a.targetId) ||
        !numbers(a.start, a.duration, a.strength) ||
        a.duration <= 0 ||
        a.start < 0 ||
        (a.phase !== undefined && !["in", "out"].includes(a.phase)) ||
        (a.ease !== undefined &&
          ![
            "cinematic",
            "smooth",
            "gentle",
            "accelerate",
            "linear",
            "custom",
          ].includes(a.ease)) ||
        (a.bezier !== undefined &&
          (!Array.isArray(a.bezier) ||
            a.bezier.length !== 4 ||
            !a.bezier.every((n) => Number.isFinite(n) && n >= 0 && n <= 1))) ||
        (a.fade !== undefined &&
          (!Number.isFinite(a.fade) || a.fade < 0 || a.fade > 1)) ||
        (a.origin !== undefined &&
          !["screen", "local", "stationary"].includes(a.origin)) ||
        (a.direction !== undefined &&
          !["left", "right", "top", "bottom"].includes(a.direction)) ||
        (a.travel !== undefined &&
          (!Number.isFinite(a.travel) || a.travel < 1 || a.travel > 4))
      )
        throw new Error("出场轨道无效");
    for (const c of shot.cues)
      if (
        !lightIds.has(c.lightId) ||
        (c.targetId && !itemIds.has(c.targetId)) ||
        !vector(c.from) ||
        !vector(c.to) ||
        !numbers(
          c.start,
          c.duration,
          c.fromIntensity,
          c.toIntensity,
          c.fromAngle,
          c.toAngle,
        ) ||
        c.duration <= 0 ||
        c.start < 0
      )
        throw new Error("追光 Cue 无效");
  }
  const trackIds = s.shots.flatMap((shot) =>
    [...shot.actions, ...shot.cues].map((track) => track.id),
  );
  if (
    trackIds.some((id) => !validId(id)) ||
    new Set([...ids, ...trackIds]).size !== ids.length + trackIds.length
  )
    throw new Error("轨道 ID 无效或重复");
  s.presets ??= [];
  s.favorites ??= [];
  if (!Array.isArray(s.presets) || !Array.isArray(s.favorites))
    throw new Error("背包数据无效");
  for (const preset of s.presets)
    if (
      !validId(preset.id) ||
      typeof preset.name !== "string" ||
      ![preset.items, preset.pins, preset.ropes, preset.marks].every(
        Array.isArray,
      ) ||
      [...preset.items, ...preset.pins, ...preset.ropes, ...preset.marks].some(
        (o) => !validId(o.id),
      )
    )
      throw new Error("组合预设无效");
  if (s.audio && !/^data:audio\//i.test(s.audio))
    throw new Error("音频必须内嵌工程");
  s.settings = { ...defaults(), ...s.settings };
  if (
    ![
      s.settings.renderScale,
      s.settings.boardWidth,
      s.settings.boardHeight,
      s.settings.frameWidth,
      s.settings.fontScale,
      s.settings.grain,
      s.settings.boardTextureScale,
    ].every(Number.isFinite) ||
    s.settings.boardWidth < 1 ||
    s.settings.boardHeight < 1 ||
    s.settings.renderScale < 0.5 ||
    s.settings.renderScale > 2 ||
    s.settings.fontScale <= 0 ||
    s.settings.frameWidth <= 0 ||
    s.settings.boardTextureScale <= 0 ||
    !validColor(s.settings.frameColor) ||
    typeof s.settings.font !== "string"
  )
    throw Error("成像、边框或字体参数无效");
  for (const o of s.items)
    if (
      (o.font !== undefined && typeof o.font !== "string") ||
      (o.fontScale !== undefined &&
        (!Number.isFinite(o.fontScale) || o.fontScale <= 0))
    )
      throw Error("字体参数无效");
  for (const m of s.marks)
    if (m.brush && !["ink", "pencil", "marker", "brush"].includes(m.brush))
      throw Error("画笔类型无效");
  for (const l of s.lights)
    if (
      (l.gobo &&
        !["none", "window", "blinds", "foliage", "lattice"].includes(l.gobo)) ||
      (l.goboScale !== undefined &&
        (!Number.isFinite(l.goboScale) || l.goboScale <= 0)) ||
      (l.goboRotation !== undefined && !Number.isFinite(l.goboRotation))
    )
      throw Error("窗光投影参数无效");
  for (const o of s.items)
    for (const v of [o.roughness, o.paperCurl, o.fiberStrength])
      if (v !== undefined && !Number.isFinite(v)) throw Error("材质参数无效");
  for (const shot of s.shots)
    for (const a of shot.actions)
      if (
        ![
          "settle",
          "slide",
          "type",
          "grow",
          "draw",
          "stamp",
          "peel",
          "clamp",
          "pin",
          "thread",
        ].includes(a.type)
      )
        throw Error("动画类型无效");
  return clone(s);
}
