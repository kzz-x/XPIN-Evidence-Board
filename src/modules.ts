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
import { modules, moduleByKind, categories } from "./catalog";
export { modules, moduleByKind, categories } from "./catalog";
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
