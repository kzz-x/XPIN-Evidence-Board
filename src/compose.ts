import {
  emptyProject,
  validateProject,
  clone,
  makeLight,
  makeShot,
  uid,
  type Project,
  type Item,
  type Pin,
  type Rope,
  type Light,
  type Shot,
  type Mark,
  type Pose,
} from "./model";
import { moduleByKind } from "./catalog";
import { annotation, applyCinemaLook, boardFit, type Brush } from "./cinema";
export interface SceneBrief {
  format: "xpin-scene/1";
  name?: string;
  settings?: Partial<Project["settings"]>;
  camera?: Pose;
  look?: number;
  fitBoard?: boolean;
  assets?: Record<string, string>;
  items?: (Partial<Item> &
    Pick<Item, "id" | "kind"> & { rotationDeg?: number })[];
  pins?: Pin[];
  ropes?: (Partial<Rope> & Pick<Rope, "id" | "from" | "to">)[];
  marks?: (Partial<Mark> &
    Pick<Mark, "id"> & { shape?: string; brush?: Brush })[];
  lights?: (Partial<Light> & Pick<Light, "id">)[];
  shots?: (Partial<Shot> & Pick<Shot, "id">)[];
}
function upsert<T extends { id: string }>(list: T[], o: T) {
  const i = list.findIndex((n) => n.id === o.id);
  if (i < 0) list.push(o);
  else list[i] = o;
}
/** Declarative authoring for an external agent. Stable IDs patch an editable source without resetting untouched work. */
export function compileScene(b: SceneBrief, base?: Project): Project {
  if (b.format !== "xpin-scene/1") throw Error("未知 Agent 场景协议");
  const p = base ? clone(validateProject(base)) : emptyProject();
  if (b.name) p.name = b.name;
  if (b.look !== undefined) applyCinemaLook(p, b.look);
  Object.assign(p.settings, b.settings ?? {});
  Object.assign(p.assets, b.assets ?? {});
  for (const value of b.items ?? []) {
    const m = moduleByKind(value.kind);
    if (!m) throw Error("未知模块 " + value.kind);
    const previous = p.items.find((o) => o.id === value.id);
    const o: Item = {
      title: m.name,
      body: m.body,
      width: m.width,
      height: m.height,
      color: m.color,
      position: [0, 0, 0.03],
      rotation: 0,
      scale: 1,
      locked: false,
      hidden: false,
      ...previous,
      ...value,
    };
    if (value.rotationDeg !== undefined)
      o.rotation = (value.rotationDeg * Math.PI) / 180;
    delete (o as Item & { rotationDeg?: number }).rotationDeg;
    upsert(p.items, o);
  }
  for (const v of b.pins ?? []) upsert(p.pins, clone(v));
  for (const v of b.ropes ?? [])
    upsert(p.ropes, {
      color: "#b7242c",
      radius: 0.022,
      slack: 0.12,
      bend: 0,
      style: "cotton",
      ...p.ropes.find((o) => o.id === v.id),
      ...v,
    });
  for (const v of b.marks ?? []) {
    const host = p.items.find((o) => o.id === v.hostId);
    if (v.shape && !host) throw Error("笔迹预设需要有效宿主");
    const existing = p.marks.find((o) => o.id === v.id);
    const m = v.shape
      ? annotation(
          host,
          v.shape,
          v.brush ?? "ink",
          v.radius ?? 0.008,
          v.color ?? "#a9232b",
        )
      : (existing ?? { id: v.id, points: [], color: "#a9232b", radius: 0.008 });
    upsert(p.marks, { ...m, ...v, id: v.id });
  }
  for (const v of b.lights ?? [])
    upsert(p.lights, {
      ...makeLight(),
      ...p.lights.find((o) => o.id === v.id),
      ...v,
    });
  for (const v of b.shots ?? []) {
    const existing = p.shots.find((o) => o.id === v.id);
    const shot = {
      ...makeShot(p, v.targetIds ?? [], v.motion ?? "focus"),
      ...existing,
      ...v,
    };
    if (v.camera) shot.manualCamera = true;
    shot.actions = shot.actions.map((a) => ({
      ...a,
      id: a.id ?? uid("action"),
    }));
    shot.cues = shot.cues.map((c) => ({ ...c, id: c.id ?? uid("cue") }));
    upsert(p.shots, shot);
  }
  if (b.fitBoard) boardFit(p);
  if (b.camera) p.camera = clone(b.camera);
  else if (!base && p.shots[0]) p.camera = clone(p.shots[0].camera);
  return validateProject(p);
}
