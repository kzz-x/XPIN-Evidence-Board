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
} from "./model";
export interface Frame {
  time: number;
  shotIndex: number;
  camera: Pose;
  transforms: Map<string, Transform>;
  visible: Map<string, boolean>;
  progress: Map<string, number>;
  lights: Light[];
}
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
      lights: clone(p.lights),
    };
  const starts = new Map<string, number>();
  let acc = 0;
  for (const shot of p.shots) {
    for (const a of shot.actions)
      if (!starts.has(a.targetId)) starts.set(a.targetId, acc + a.start);
    acc += shot.duration;
  }
  for (const [id, start] of starts) {
    frame.progress.set(id, t >= start ? 1 : 0);
    if (frame.visible.has(id))
      frame.visible.set(id, frame.visible.get(id)! && t >= start);
  }
  acc = 0;
  let previous = clone(p.camera);
  for (let i = 0; i < p.shots.length; i++) {
    const s = p.shots[i],
      local = t - acc;
    if (local < 0) break;
    frame.shotIndex = i;
    const u = clamp(local / s.duration, 0, 1),
      k = s.ease === "linear" ? u : smooth(clamp(u / 0.7, 0, 1));
    const to = clone(s.camera);
    if (s.motion === "push") to.distance *= 1 - 0.12 * u;
    if (s.motion === "pan") to.target[0] += 0.65 * (u - 0.5);
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
            smooth(u),
            r.control,
          );
      }
    }
    frame.camera = {
      target: mix3(previous.target, to.target, k),
      distance: mix(previous.distance, to.distance, k),
      yaw: mix(previous.yaw, to.yaw, k),
      pitch: mix(previous.pitch, to.pitch, k),
      roll: mix(previous.roll, to.roll, k),
      focal: mix(previous.focal, to.focal, k),
    };
    for (const a of s.actions) {
      if (local < a.start) continue;
      const q = smooth((local - a.start) / a.duration);
      frame.progress.set(a.targetId, q);
      const tr = frame.transforms.get(a.targetId);
      if (tr) {
        frame.visible.set(
          a.targetId,
          !p.items.find((o) => o.id === a.targetId)?.hidden,
        );
        const o = p.items.find((o) => o.id === a.targetId)!;
        tr.position = clone(o.position);
        tr.rotation = o.rotation;
        tr.scale = o.scale;
        if (a.type === "slide") tr.position[0] += (1 - q) * -2 * a.strength;
        else if (a.type === "settle") {
          tr.position[2] += (1 - q) * 1.7 * a.strength;
          tr.rotation += (1 - q) * 0.15 * a.strength;
        } else if (a.type === "stamp") {
          tr.position[2] += (1 - q) * 0.7 * a.strength;
          tr.scale = o.scale * (0.8 + 0.2 * q);
        }
      }
    }
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
    previous = clone(to);
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
