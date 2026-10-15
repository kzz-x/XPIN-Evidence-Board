import { clamp, smooth, type Action, type Pose, type V3 } from "./model";

export type Ease =
  | "cinematic"
  | "smooth"
  | "gentle"
  | "accelerate"
  | "linear"
  | "custom";
export type Bezier = [number, number, number, number];
export const eases: [Ease, string][] = [
  ["cinematic", "电影缓出 · 快入慢停"],
  ["smooth", "柔和缓入缓出"],
  ["gentle", "轻柔自然"],
  ["accelerate", "加速离场"],
  ["linear", "匀速"],
  ["custom", "自定义贝塞尔曲线"],
];
const curves: Record<Exclude<Ease, "custom">, Bezier> = {
  cinematic: [0.22, 1, 0.36, 1],
  smooth: [0.65, 0, 0.35, 1],
  gentle: [0.25, 0.1, 0.25, 1],
  accelerate: [0.64, 0, 0.78, 0],
  linear: [0, 0, 1, 1],
};
export const actionCurve = (a: Action): Bezier =>
  a.ease === "custom"
    ? (a.bezier ?? curves.cinematic)
    : curves[a.ease ?? (a.phase === "out" ? "accelerate" : "cinematic")];
/** Invert x(t), rather than treating bezier parameter t as elapsed time. */
export function cubicEase(x: number, curve: Bezier) {
  x = clamp(x, 0, 1);
  if (x === 0 || x === 1) return x;
  const at = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2;
    if (at(t, curve[0], curve[2]) < x) lo = t;
    else hi = t;
  }
  return at((lo + hi) / 2, curve[1], curve[3]);
}
export function actionSample(a: Action, raw: number) {
  const u = clamp(raw, 0, 1),
    out = a.phase === "out",
    eased = cubicEase(u, actionCurve(a)),
    fade = a.fade ?? 0.65;
  return {
    progress: out ? 1 - eased : eased,
    opacity:
      fade === 0
        ? out
          ? +(u < 1)
          : +(u > 0)
        : out
          ? 1 - smooth((u - (1 - fade)) / fade)
          : smooth(u / fade),
  };
}
export const spatial = (a: Action) =>
  !["draw", "grow", "type"].includes(a.type);
export const actionOrigin = (a: Action) =>
  a.origin ?? (a.type === "stamp" ? "local" : "screen");
export function curvePreview(a: Action) {
  const c = actionCurve(a),
    points = Array.from(
      { length: 65 },
      (_, i) => `${8 + (i / 64) * 164},${82 - cubicEase(i / 64, c) * 70}`,
    ).join(" ");
  return `<svg class="ease-graph" data-curve="${a.id}" viewBox="0 0 180 94" role="img" aria-label="缓动曲线预览"><path class="ease-grid" d="M8 12V82H172M8 47H172M90 12V82"/><path class="ease-handle" d="M8 82L${8 + c[0] * 164} ${82 - c[1] * 70}M172 12L${8 + c[2] * 164} ${82 - c[3] * 70}"/><polyline class="ease-line" points="${points}"/><text x="8" y="92">时间 →</text><text x="128" y="92">进度 ↑</text></svg>`;
}
/** Camera-plane travel includes the entire object's bounding sphere and output gate.
 * Matches PerspectiveCamera's 35mm film gauge, including portrait film height. */
export function screenOffset(
  pose: Pose,
  aspect: number,
  position: V3,
  radius: number,
  direction: Action["direction"] = "left",
  travel = 1,
): V3 {
  const back: V3 = [
    Math.sin(pose.yaw) * Math.cos(pose.pitch),
    Math.sin(pose.pitch),
    Math.cos(pose.yaw) * Math.cos(pose.pitch),
  ];
  const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a: V3, b: V3) => a.reduce((v, n, i) => v + n * b[i], 0);
  const right = cross([-Math.sin(pose.roll), Math.cos(pose.roll), 0], back),
    length = Math.hypot(...right);
  for (let i = 0; i < 3; i++) right[i] /= length;
  const up = cross(back, right),
    rel = position.map((v, i) => v - pose.target[i]) as V3;
  const depth = Math.max(0.1, pose.distance - dot(rel, back));
  const halfH =
      ((depth + radius) * 35) / Math.max(aspect, 1) / (2 * pose.focal),
    halfW = halfH * aspect;
  const vertical = direction === "top" || direction === "bottom",
    sign = direction === "right" || direction === "top" ? 1 : -1;
  const axis = vertical ? up : right,
    center = dot(rel, axis),
    edge = vertical ? halfH : halfW;
  // A tilted camera-plane path can go behind the board. Lift toward the lens
  // before solving the gate inequality so every direction stays in front of it.
  const vector = axis.map((v) => v * sign) as V3;
  const lift =
    vector[2] < 0 ? (-vector[2] + 0.15) / Math.max(0.01, back[2]) : 0;
  for (let i = 0; i < 3; i++) vector[i] += back[i] * lift;
  const tangent = (vertical ? halfH : halfW) / (depth + radius);
  const denominator = sign * dot(vector, axis) + dot(vector, back) * tangent;
  const distance =
    (Math.max(0, edge + radius + Math.max(0.25, edge * 0.08) - sign * center) /
      Math.max(0.01, denominator)) *
    Math.max(1, travel);
  return vector.map((v) => v * distance) as V3;
}
