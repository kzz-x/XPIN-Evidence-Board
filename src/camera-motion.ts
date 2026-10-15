import { clamp, type Shot, type Pose } from "./model";
import { cubicEase, type Bezier } from "./motion";
export type CameraEase =
  | "smooth"
  | "smoother"
  | "cinematic"
  | "glide"
  | "linear"
  | "custom";
export const cameraEases: [CameraEase, string][] = [
  ["smoother", "丝滑衔接 · 五次缓入缓出"],
  ["cinematic", "电影抵达 · 渐缓停稳"],
  ["glide", "从容滑行 · 对称贝塞尔"],
  ["smooth", "柔和衔接"],
  ["linear", "匀速"],
  ["custom", "自定义摄影机曲线"],
];
export const cameraCurve = (s: Shot): Bezier =>
  s.ease === "custom"
    ? (s.bezier ?? [0.42, 0, 0.58, 1])
    : s.ease === "cinematic"
      ? [0.38, 0, 0.22, 1]
      : s.ease === "glide"
        ? [0.42, 0, 0.58, 1]
        : [0, 0, 1, 1];
export function cameraProgress(s: Shot, raw: number) {
  const u = clamp(raw / (s.moveFraction ?? 0.85), 0, 1);
  if (s.ease === "linear") return u;
  if (s.ease === "smoother" || s.ease === "smooth")
    return u * u * u * (u * (u * 6 - 15) + 10);
  return cubicEase(u, cameraCurve(s));
}
/** Linear interpolation in diopters makes a focus pull optically more even. */
export const mixFocus = (a: number, b: number, k: number) =>
  1 / ((1 - k) / Math.max(0.1, a) + k / Math.max(0.1, b));
export const lensState = (c: Pose, offset: number) => ({
  fStop: c.fStop ?? 4,
  focusDistance: c.focusDistance ?? Math.max(0.1, c.distance + offset),
});
export function cameraCurvePreview(s: Shot) {
  const points = Array.from(
    { length: 65 },
    (_, i) => `${8 + (i / 64) * 164},${82 - cameraProgress(s, i / 64) * 70}`,
  ).join(" ");
  return `<svg class="ease-graph" data-camera-curve="${s.id}" viewBox="0 0 180 94" role="img" aria-label="摄影机缓动预览"><path class="ease-grid" d="M8 12V82H172M8 47H172M90 12V82"/><polyline class="ease-line" points="${points}"/><text x="8" y="92">时间 →</text><text x="128" y="92">机位 ↑</text></svg>`;
}
