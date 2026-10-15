import { type Project, type Rope, type V3, type Transform } from "./model";
import { ropePoint } from "./story";
import { surfaceAt } from "./surface";
export function ropeHeights(
  p: Project,
  r: Rope,
  a: V3,
  b: V3,
  transforms?: Map<string, Transform>,
  visible?: Map<string, boolean>,
) {
  const n = 96,
    margin = r.radius * 1.8 + 0.008;
  const heights = Array.from({ length: n + 1 }, (_, i) => {
    const q = ropePoint(a, b, r.slack, r.bend, i / n, r.control);
    return Math.max(
      q[2],
      surfaceAt(p, q[0], q[1], transforms, undefined, visible, margin) + margin,
    );
  });
  for (let pass = 0; pass < 3; pass++) {
    const previous = [...heights];
    for (let i = 1; i < n; i++)
      heights[i] = Math.max(
        previous[i],
        previous[i - 1] * 0.25 + previous[i] * 0.5 + previous[i + 1] * 0.25,
      );
  }
  // Keep exact authored pin anchors; buried anchors are reported by production audit.
  heights[0] = a[2];
  heights[n] = b[2];
  return heights;
}
