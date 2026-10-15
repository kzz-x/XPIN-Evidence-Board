/** Native authoring entry: no DOM, window, renderer or bundled image imports. */
import {
  clone,
  validateProject,
  pinWorld,
  type Project,
  type V3,
} from "./model";
import { evaluate, duration } from "./story";
export { compileScene, type SceneBrief } from "./compose";
export { modules, categories, moduleByKind } from "./catalog";
export {
  annotation,
  animationOptions,
  applyCinemaLook,
  boardFit,
  boardPose,
  looks,
  sunlight,
} from "./cinema";
export {
  clone,
  validateProject,
  emptyProject,
  makeShot,
  makeLight,
  poseFor,
  localToWorld,
  worldToLocal,
  pinWorld,
  duplicateSelection,
  removeIds,
  ratio,
  uid,
} from "./model";
export type {
  Project,
  Item,
  Pin,
  Rope,
  Mark,
  Light,
  Shot,
  Action,
  Cue,
  Pose,
  V3,
  Settings,
  Transform,
  Kind,
} from "./model";
export { evaluate, duration, ropePoint } from "./story";
export { cubicEase, actionSample, actionCurve } from "./motion";

export function inspectProject(input: Project) {
  const p = validateProject(clone(input));
  const warnings: {
    code: string;
    targetId?: string;
    trackId?: string;
    message: string;
  }[] = [];
  const intervals: {
    targetId: string;
    trackId: string;
    start: number;
    end: number;
  }[] = [];
  let start = 0;
  const shots = p.shots.map((s) => {
    const end = start + s.duration;
    for (const track of [...s.actions, ...s.cues])
      if (track.start + track.duration > s.duration)
        warnings.push({
          code: "TRACK_EXTENDS_SHOT",
          trackId: track.id,
          message: `${s.id}：轨道超出本镜头，下一镜仍会按绝对时间求值；请检查意图。`,
        });
    const actions = s.actions.map((a) => {
      const record = {
        targetId: a.targetId,
        trackId: a.id,
        start: start + a.start,
        end: start + a.start + a.duration,
      };
      intervals.push(record);
      return { ...record, type: a.type, phase: a.phase ?? "in" };
    });
    const shot = {
      id: s.id,
      title: s.title,
      start,
      end,
      duration: s.duration,
      targetIds: s.targetIds,
      actions,
      cues: s.cues.map((c) => ({
        id: c.id,
        lightId: c.lightId,
        start: start + c.start,
        end: start + c.start + c.duration,
      })),
    };
    start = end;
    return shot;
  });
  intervals.sort((a, b) => a.start - b.start);
  for (let i = 0; i < intervals.length; i++) {
    const a = intervals[i];
    if (a.end > start)
      warnings.push({
        code: "ACTION_EXTENDS_STORY",
        targetId: a.targetId,
        trackId: a.trackId,
        message: "动作在故事结束时尚未完成。",
      });
    for (const b of intervals.slice(i + 1)) {
      if (b.start >= a.end) break;
      if (a.targetId === b.targetId)
        warnings.push({
          code: "OVERLAPPING_ACTIONS",
          targetId: a.targetId,
          trackId: b.trackId,
          message: `${a.trackId} 与 ${b.trackId} 重叠；最后开始的轨道生效，可能产生跳变。`,
        });
    }
  }
  return {
    format: "xpin-inspect/1",
    scope: "data-and-timing",
    renderValidated: false,
    name: p.name,
    version: p.version,
    duration: duration(p),
    aspect: p.settings.aspect,
    counts: Object.fromEntries(
      (["items", "pins", "ropes", "marks", "lights", "shots"] as const).map(
        (k) => [k, p[k].length],
      ),
    ),
    items: p.items.map((o) => ({
      id: o.id,
      kind: o.kind,
      title: o.title,
      position: o.position,
      rotation: o.rotation,
      scale: o.scale,
      width: o.width,
      height: o.height,
      hidden: o.hidden,
      locked: o.locked,
      assetId: o.assetId,
    })),
    pins: p.pins,
    ropes: p.ropes,
    marks: p.marks.map((m) => ({
      id: m.id,
      hostId: m.hostId,
      points: m.points.length,
      brush: m.brush ?? "ink",
    })),
    lights: p.lights,
    shots,
    assets: Object.keys(p.assets),
    hasAudio: Boolean(p.audio),
    warnings,
  };
}

/** Serializable absolute-time state. This is engine evidence, not a raster render. */
export function sampleProject(input: Project, seconds: number) {
  if (!Number.isFinite(seconds)) throw Error("采样时间必须是有限秒数");
  const p = validateProject(clone(input)),
    f = evaluate(p, seconds);
  const pins = p.pins.map((pin) => {
    const position = pinWorld(p, pin, f.transforms),
      off = f.offsets.get(pin.id);
    if (off) for (let i = 0; i < 3; i++) position[i] += off[i];
    return {
      id: pin.id,
      hostId: pin.hostId,
      position,
      opacity: f.opacity.get(pin.id) ?? 1,
      visible:
        (!pin.hostId || f.visible.get(pin.hostId)) &&
        (f.opacity.get(pin.id) ?? 1) > 0,
    };
  });
  const endpoint = (id: string): V3 => {
    const pos = pins.find((pin) => pin.id === id)!.position;
    return [pos[0], pos[1], pos[2] + 0.145];
  };
  return {
    format: "xpin-frame/1",
    scope: "engine-state",
    renderValidated: false,
    requestedTime: seconds,
    time: f.time,
    shotIndex: f.shotIndex,
    camera: f.camera,
    items: p.items.map((o) => {
      const tr = f.transforms.get(o.id)!;
      return {
        id: o.id,
        position: tr.position,
        rotation: tr.rotation,
        scale: tr.scale,
        visible: f.visible.get(o.id),
        opacity: f.opacity.get(o.id) ?? 1,
        progress: f.progress.get(o.id) ?? 1,
        deformation: f.deformation.get(o.id),
      };
    }),
    pins,
    ropes: p.ropes.map((r) => ({
      id: r.id,
      from: endpoint(r.from),
      to: endpoint(r.to),
      progress: f.progress.get(r.id) ?? 1,
      opacity: f.opacity.get(r.id) ?? 1,
      visible:
        pins.find((p) => p.id === r.from)!.visible &&
        pins.find((p) => p.id === r.to)!.visible &&
        (f.opacity.get(r.id) ?? 1) > 0,
    })),
    marks: p.marks.map((m) => ({
      id: m.id,
      hostId: m.hostId,
      progress: f.progress.get(m.id) ?? 1,
      opacity: f.opacity.get(m.id) ?? 1,
      visible:
        (!m.hostId || f.visible.get(m.hostId)) &&
        (f.opacity.get(m.id) ?? 1) > 0,
    })),
    lights: f.lights,
  };
}

export { auditProduction, cameraPosition } from "./production-audit";
export { surfaceAt, liftToSurface } from "./surface";
export { ropeHeights } from "./rope-clearance";

export {
  cameraProgress,
  cameraCurve,
  mixFocus,
  lensState,
} from "./camera-motion";

export {
  paperSurface,
  paperPoint,
  paperThickness,
  paperSeed,
  wearParameters,
  folderSettings,
} from "./paper-profile";
