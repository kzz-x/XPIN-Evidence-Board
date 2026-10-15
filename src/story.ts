import { cameraProgress, lensState, mixFocus } from "./camera-motion";
import {
  clone,
  clamp,
  smooth,
  mix,
  mix3,
  localToWorld,
  pinWorld,
  type Project,
  type Pose,
  type Transform,
  type V3,
  type Light,
  type Action,
  ratio,
} from "./model";
import {
  actionSample,
  actionOrigin,
  screenOffset,
  spatial,
  cubicEase,
  actionCurve,
} from "./motion";
export interface Frame {
  time: number;
  shotIndex: number;
  camera: Pose;
  transforms: Map<string, Transform>;
  visible: Map<string, boolean>;
  progress: Map<string, number>;
  opacity: Map<string, number>;
  offsets: Map<string, V3>;
  lights: Light[];
  deformation: Map<string, { type: Action["type"]; strength: number }>;
}
const mixAngle = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
export const duration = (p: Project) =>
  p.shots.reduce((n, s) => n + s.duration, 0);
export function ropePoint(
  a: V3,
  b: V3,
  slack: number,
  bend: number,
  t: number,
  control?: V3,
): V3 {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
    k = 4 * t * (1 - t),
    p = mix3(a, b, t);
  p[0] += (-(b[1] - a[1]) / d) * bend * k;
  p[1] += ((b[0] - a[0]) / d) * bend * k - slack * k;
  p[2] = Math.max(0.075, p[2] - Math.min(slack * 0.14, 0.12) * k);
  if (control) {
    const mid = mix3(a, b, 0.5);
    for (let i = 0; i < 3; i++) p[i] += (control[i] - mid[i]) * k;
  }
  return p;
}
export function evaluate(p: Project, time: number): Frame {
  const t = clamp(time, 0, duration(p)),
    frame: Frame = {
      time: t,
      shotIndex: 0,
      camera: clone(p.camera),
      transforms: new Map(p.items.map((o) => [o.id, clone(o)])),
      visible: new Map(p.items.map((o) => [o.id, !o.hidden])),
      progress: new Map(),
      opacity: new Map(
        [...p.items, ...p.pins, ...p.ropes, ...p.marks].map((o) => [o.id, 1]),
      ),
      offsets: new Map(),
      lights: clone(p.lights),
      deformation: new Map(),
    };
  const tracks: { action: Action; start: number }[] = [];
  let acc = 0;
  for (const shot of p.shots) {
    for (const a of shot.actions)
      tracks.push({ action: a, start: acc + a.start });
    acc += shot.duration;
  }
  tracks.sort((a, b) => a.start - b.start);
  acc = 0;
  let previous = clone(p.camera);
  for (let i = 0; i < p.shots.length; i++) {
    const s = p.shots[i],
      local = t - acc;
    if (local < 0) break;
    frame.shotIndex = i;
    const u = clamp(local / s.duration, 0, 1),
      k = cameraProgress(s, u);
    const to = clone(s.camera);
    if (s.motion === "push") to.distance *= 1 - 0.12 * k;
    if (s.motion === "pan") to.target[0] += 0.65 * (k - 0.5);
    if (s.motion === "rope" && s.ropeId) {
      const r = p.ropes.find((r) => r.id === s.ropeId);
      if (r) {
        const a = p.pins.find((a) => a.id === r.from),
          b = p.pins.find((b) => b.id === r.to);
        if (a && b)
          to.target = ropePoint(
            pinWorld(p, a, frame.transforms),
            pinWorld(p, b, frame.transforms),
            r.slack,
            r.bend,
            k,
            r.control,
          );
      }
    }
    if (s.focusPull) to.focusDistance = s.focusPull.to;
    const fromLens = lensState(previous, p.settings.focusOffset),
      toLens = lensState(to, p.settings.focusOffset);
    frame.camera = {
      target: mix3(previous.target, to.target, k),
      distance: mix(previous.distance, to.distance, k),
      yaw: mixAngle(previous.yaw, to.yaw, k),
      pitch: mix(previous.pitch, to.pitch, k),
      roll: mixAngle(previous.roll, to.roll, k),
      focal: Math.exp(mix(Math.log(previous.focal), Math.log(to.focal), k)),
      fStop: Math.exp(mix(Math.log(fromLens.fStop), Math.log(toLens.fStop), k)),
      focusDistance: mixFocus(fromLens.focusDistance, toLens.focusDistance, k),
    };
    if (s.focusPull) {
      const f = s.focusPull,
        raw = clamp((local - f.start) / f.duration, 0, 1),
        q = cubicEase(raw, actionCurve({ ease: f.ease ?? "smooth" } as Action));
      frame.camera.focusDistance = mixFocus(f.from, f.to, q);
    }
    previous = clone(to);
    acc += s.duration;
  }
  // Every target has a chronological state; an exit alone starts fully visible.
  // Missing optional fields improve old projects without rewriting authored tracks.
  const active = new Map<string, Action>();
  for (const { action: a, start } of tracks) {
    if (!frame.progress.has(a.targetId)) {
      const initial = a.phase === "out" ? 1 : 0;
      frame.progress.set(a.targetId, initial);
      frame.opacity.set(a.targetId, initial);
    }
    if (t < start) continue;
    const sample = actionSample(a, (t - start) / a.duration);
    frame.progress.set(a.targetId, sample.progress);
    frame.opacity.set(a.targetId, sample.opacity);
    frame.deformation.set(a.targetId, { type: a.type, strength: a.strength });
    active.set(a.targetId, a);
  }
  const offsetFor = (a: Action, position: V3, radius: number): V3 => {
    const q = frame.progress.get(a.targetId) ?? 1,
      amount = (1 - q) * a.strength,
      offset: V3 = [0, 0, 0];
    const origin = actionOrigin(a);
    if (!spatial(a) || origin === "stationary") return offset;
    if (a.type === "pin") offset[2] = amount * 1.1;
    else if (a.type === "peel") offset[2] = amount * 0.12;
    else if (a.type === "clamp" || a.type === "thread") {
      offset[1] = amount * 0.8;
      offset[2] = amount * 0.18;
    } else if (a.type === "settle") offset[2] = amount * 1.7;
    else if (a.type === "stamp") offset[2] = amount * 0.7;
    else if (a.type === "slide" && origin === "local") offset[0] = -2 * amount;
    if (origin === "screen") {
      const d = a.direction ?? (a.type === "slide" ? "left" : "top"),
        off = screenOffset(
          frame.camera,
          ratio(p.settings.aspect),
          position,
          radius + 1.7 * Math.abs(a.strength),
          d,
          a.travel,
        );
      for (let i = 0; i < 3; i++) offset[i] += off[i] * (1 - q);
    }
    return offset;
  };
  for (const o of p.items) {
    const a = active.get(o.id),
      tr = frame.transforms.get(o.id)!;
    if (a) {
      const q = frame.progress.get(o.id)!,
        off = offsetFor(
          a,
          o.position,
          (Math.hypot(o.width, o.height) * o.scale) / 2,
        );
      tr.position = o.position.map((n, i) => n + off[i]) as V3;
      if (actionOrigin(a) !== "stationary") {
        if (a.type === "settle") tr.rotation += (1 - q) * 0.15 * a.strength;
        if (a.type === "stamp") tr.scale *= 0.8 + 0.2 * q;
      }
    }
    frame.visible.set(o.id, !o.hidden && frame.opacity.get(o.id)! > 0);
  }
  for (const pin of p.pins) {
    const a = active.get(pin.id);
    if (a)
      frame.offsets.set(
        pin.id,
        offsetFor(a, pinWorld(p, pin, frame.transforms), 0.4),
      );
    frame.opacity.set(
      pin.id,
      frame.opacity.get(pin.id)! *
        (pin.hostId ? (frame.opacity.get(pin.hostId) ?? 1) : 1),
    );
  }
  for (const m of p.marks)
    if (m.hostId)
      frame.opacity.set(
        m.id,
        frame.opacity.get(m.id)! * (frame.opacity.get(m.hostId) ?? 1),
      );
  for (const r of p.ropes)
    frame.opacity.set(
      r.id,
      frame.opacity.get(r.id)! *
        Math.min(frame.opacity.get(r.from) ?? 1, frame.opacity.get(r.to) ?? 1),
    );
  acc = 0;
  for (const s of p.shots) {
    const local = t - acc;
    if (local < 0) break;
    for (const c of s.cues) {
      if (local < c.start) continue;
      const light = frame.lights.find((l) => l.id === c.lightId);
      if (!light) continue;
      const raw = clamp((local - c.start) / c.duration, 0, 1),
        q =
          c.ease === "hold"
            ? raw === 1
              ? 1
              : 0
            : c.ease === "linear"
              ? raw
              : smooth(raw);
      const host = p.items.find((o) => o.id === c.targetId);
      const to = host
        ? localToWorld(frame.transforms.get(host.id) ?? host, [0, 0, 0.03])
        : c.to;
      light.target = mix3(c.from, to, q);
      light.hostId = q === 1 ? c.targetId : undefined;
      light.local = [0, 0, 0.03];
      light.intensity = mix(c.fromIntensity, c.toIntensity, q);
      light.angle = mix(c.fromAngle, c.toAngle, q);
      light.enabled = light.intensity > 0;
    }
    acc += s.duration;
  }
  // Resolve following lights from final animated host transforms, without mutating the project.
  for (const l of frame.lights) {
    const host = p.items.find((o) => o.id === l.hostId);
    if (host)
      l.target = localToWorld(frame.transforms.get(host.id) ?? host, l.local);
  }
  return frame;
}
