import bridge from "./assets/bridge.jpg?inline";
import city from "./assets/city.jpg?inline";
import witness from "./assets/harbor.jpg?inline";
import {
  uid,
  emptyProject,
  makeLight,
  makeShot,
  localToWorld,
  poseFor,
  type Item,
  type Kind,
  type Project,
  type V3,
  type Pin,
} from "./model";
export interface Module {
  kind: Kind;
  name: string;
  category: string;
  width: number;
  height: number;
  color: string;
  body: string;
  icon: string;
}
export const categories = [
  "全部",
  "相片影像",
  "文件资料",
  "文字标签",
  "固定件",
  "关系连线",
  "标注强调",
  "沙盘环境",
  "组合预设",
];
export const modules: Module[] = [
  {
    kind: "photo",
    name: "档案相纸",
    category: "相片影像",
    width: 3.6,
    height: 2.9,
    color: "#eee5cf",
    body: "ARCHIVE / 047",
    icon: "photo",
  },
  {
    kind: "polaroid",
    name: "拍立得",
    category: "相片影像",
    width: 2.9,
    height: 3.5,
    color: "#efe8d6",
    body: "一瞬间，一条线索。",
    icon: "polaroid",
  },
  {
    kind: "film",
    name: "胶片底片",
    category: "相片影像",
    width: 4.1,
    height: 2.1,
    color: "#38352f",
    body: "NEGATIVE / 003",
    icon: "film",
  },
  {
    kind: "file",
    name: "调查报告",
    category: "文件资料",
    width: 3.1,
    height: 4.0,
    color: "#e6d9b9",
    body: "现场记录\n23:40 最后一次目击\n00:12 桥下出现车辆\n01:26 证人提供照片\n\n信息之间的关系仍有待核实。",
    icon: "file",
  },
  {
    kind: "news",
    name: "新闻剪报",
    category: "文件资料",
    width: 3.25,
    height: 3.6,
    color: "#d8cfb6",
    body: "THE MIDNIGHT EDITION\n城市在午夜留下的痕迹\n\n来自公共档案的历史影像。演示故事为虚构，不对应真实调查。",
    icon: "news",
  },
  {
    kind: "folder",
    name: "牛皮纸袋",
    category: "文件资料",
    width: 4.1,
    height: 3.1,
    color: "#ad8755",
    body: "CONFIDENTIAL / 047",
    icon: "folder",
  },
  {
    kind: "profile",
    name: "人物档案",
    category: "文件资料",
    width: 3.0,
    height: 3.8,
    color: "#ddd5c0",
    body: "人物 / WITNESS\n编号：003\n来源：历史档案\n关系：待核实",
    icon: "profile",
  },
  {
    kind: "map",
    name: "街区地图",
    category: "文件资料",
    width: 5.4,
    height: 4.7,
    color: "#b4ad91",
    body: "NORTH DISTRICT / SECTOR 04",
    icon: "map",
  },
  {
    kind: "note",
    name: "手写便签",
    category: "文字标签",
    width: 1.9,
    height: 1.8,
    color: "#e4c779",
    body: "为何在这里？\n找到下一条线索。",
    icon: "note",
  },
  {
    kind: "label",
    name: "撕纸标题",
    category: "文字标签",
    width: 3.3,
    height: 0.85,
    color: "#d5c7a8",
    body: "CASE FILE / 047",
    icon: "label",
  },
  {
    kind: "date",
    name: "日期标签",
    category: "文字标签",
    width: 2.0,
    height: 0.75,
    color: "#e0d6bd",
    body: "23 : 40 / LAST SEEN",
    icon: "date",
  },
  {
    kind: "pin",
    name: "红色图钉",
    category: "固定件",
    width: 0.24,
    height: 0.24,
    color: "#a51b22",
    body: "",
    icon: "pin",
  },
  {
    kind: "clip",
    name: "金属长尾夹",
    category: "固定件",
    width: 0.65,
    height: 0.75,
    color: "#272b28",
    body: "",
    icon: "clip",
  },
  {
    kind: "tape",
    name: "半透明胶带",
    category: "固定件",
    width: 1.45,
    height: 0.4,
    color: "#c7b58a",
    body: "",
    icon: "tape",
  },
  {
    kind: "staple",
    name: "回形针",
    category: "固定件",
    width: 0.28,
    height: 0.8,
    color: "#b6b7b4",
    body: "",
    icon: "staple",
  },
  {
    kind: "stamp",
    name: "档案印章",
    category: "标注强调",
    width: 2.2,
    height: 0.85,
    color: "#b2292a",
    body: "CONFIDENTIAL",
    icon: "stamp",
  },
];
export const moduleByKind = (kind: Kind) =>
  modules.find((m) => m.kind === kind)!;
export function makeItem(kind: Kind, position: V3): Item {
  const m = moduleByKind(kind);
  return {
    id: uid(),
    kind,
    title: m.name,
    body: m.body,
    width: m.width,
    height: m.height,
    color: m.color,
    position,
    rotation: 0,
    scale: 1,
    locked: false,
    hidden: false,
  };
}
export const demoAssets = { bridge, city, witness };
export function demoProject(): Project {
  const p = emptyProject();
  p.name = "午夜档案 / CASE 047";
  p.assets = { bridge, city, witness };
  const specs: [Kind, V3, string, string?, number?][] = [
    ["map", [-0.1, 0.1, 0.045], "北区 / 失踪路径", undefined, 2],
    ["photo", [-5.25, 2.65, 0.075], "01 / 桥下最后的灯光", "bridge", -6],
    ["polaroid", [4.9, 2.45, 0.12], "02 / 午夜目击", "witness", 7],
    ["photo", [-4.65, -1.25, 0.105], "03 / 城市留下的痕迹", "city", 5],
    ["file", [4.6, -1.65, 0.09], "事件时间线", undefined, -4],
    ["news", [-0.4, -3.85, 0.135], "消失的 47 分钟", undefined, 3],
    ["label", [-4.9, 5.0, 0.04], "CASE FILE / 047", undefined, -2],
    ["note", [1.85, 3.25, 0.15], "为什么是这座桥？", undefined, -5],
    ["note", [-2.9, -3.0, 0.15], "沿着红绳，\n继续追踪。", undefined, -5],
    ["date", [4.6, 4.6, 0.1], "23:40 / LAST SEEN", undefined, 4],
    ["folder", [5.9, -4.0, 0.027], "证据袋", undefined, 5],
    ["tape", [-5.9, 4.07, 0.11], "胶带", undefined, -12],
    ["clip", [4.65, 4.16, 0.22], "长尾夹", undefined, -5],
    ["staple", [6.05, -0.08, 0.18], "回形针", undefined, 9],
    ["stamp", [0.5, -4.9, 0.19], "CONFIDENTIAL", undefined, -12],
  ];
  for (const [kind, pos, title, asset, rot] of specs) {
    const o = makeItem(kind, pos);
    o.title = title;
    o.assetId = asset;
    o.rotation = ((rot ?? 0) * Math.PI) / 180;
    if (kind === "note" || kind === "label" || kind === "date") o.body = title;
    p.items.push(o);
  }
  const pinAt = (i: number, x: number, y: number, color = "#9d2024") => {
    const o = p.items[i],
      pin: Pin = { id: uid("pin"), hostId: o.id, local: [x, y, 0.025], color };
    p.pins.push(pin);
    return pin;
  };
  const pins = [
    pinAt(1, 1.35, 1.25),
    pinAt(2, -0.75, 1.42, "#be9040"),
    pinAt(3, 0.85, 1.2),
    pinAt(4, -0.65, 1.7),
    pinAt(0, -1.0, 0.7, "#847d68"),
    pinAt(0, 1.7, -1.55),
    pinAt(7, -0.6, 0.7),
    pinAt(5, 1.25, 1.45),
  ];
  for (const [a, b, bend] of [
    [0, 4, 0.06],
    [4, 1, -0.1],
    [1, 3, 0.09],
    [4, 2, -0.1],
    [2, 5, 0.06],
    [5, 3, -0.1],
    [6, 4, 0.04],
    [3, 7, 0.08],
  ])
    p.ropes.push({
      id: uid("rope"),
      from: pins[a].id,
      to: pins[b].id,
      color: "#b5242c",
      radius: 0.021,
      slack: 0.11,
      bend,
      style: "cotton",
    });
  const points: V3[] = [];
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 1.96;
    points.push([-1 + 0.55 * Math.cos(t), 0.7 + 0.47 * Math.sin(t), 0.026]);
  }
  p.marks.push({
    id: uid("mark"),
    hostId: p.items[0].id,
    points,
    color: "#a42b25",
    radius: 0.024,
  });
  const l = makeLight([-5, 5, 8]);
  l.name = "暖光 / 证据揭示";
  l.hostId = p.items[1].id;
  l.intensity = 55;
  l.angle = 35;
  p.lights.push(l);
  const fill = makeLight([8, -3, 6]);
  fill.name = "冷光 / 档案轮廓";
  fill.target = [3, -1, 0];
  fill.color = "#9abcc1";
  fill.intensity = 25;
  fill.angle = 48;
  fill.shadow = false;
  p.lights.push(fill);
  p.camera = poseFor(p, [], "overview");
  p.camera.distance *= 0.98;
  for (const [index, motion] of [
    [1, "push"],
    [4, "pan"],
    [0, "focus"],
    [-1, "overview"],
  ] as const) {
    const s = makeShot(p, index < 0 ? [] : [p.items[index].id], motion);
    s.duration = 5;
    s.title =
      index < 0
        ? "04 / 关系网全局揭示"
        : index === 1
          ? "01 / 最后一次目击"
          : index === 4
            ? "02 / 消失的 47 分钟"
            : "03 / 线索交汇";
    const prev =
      p.shots.at(-1)?.camera.target ?? localToWorld(p.items[1], [0, 0, 0.02]);
    s.cues.push({
      id: uid("cue"),
      lightId: l.id,
      start: 0.3,
      duration: 3,
      targetId: index < 0 ? undefined : p.items[index].id,
      from: prev,
      to: s.camera.target,
      fromIntensity: 55,
      toIntensity: index < 0 ? 15 : 70,
      fromAngle: 35,
      toAngle: index === 0 ? 22 : 35,
      ease: "smooth",
    });
    if (index === 0) {
      p.ropes.forEach((r, i) =>
        s.actions.push({
          id: uid("action"),
          targetId: r.id,
          start: 0.2 + i * 0.12,
          duration: 1.6,
          type: "grow",
          strength: 1,
        }),
      );
      p.marks.forEach((m) =>
        s.actions.push({
          id: uid("action"),
          targetId: m.id,
          start: 2.5,
          duration: 1.4,
          type: "draw",
          strength: 1,
        }),
      );
    }
    p.shots.push(s);
  }
  return p;
}
