import {
  worldToLocal,
  type Item,
  type Project,
  type Transform,
  type V3,
} from "./model";
export { paperSurface } from "./paper-profile";
import { paperSurface, paperUnderside } from "./paper-profile";
export const isPaper = (o: Item) =>
  !["clip", "pin", "staple", "stamp"].includes(o.kind);
export function surfaceAt(
  p: Project,
  x: number,
  y: number,
  transforms?: Map<string, Transform>,
  exclude?: string,
  visible?: Map<string, boolean>,
  padding = 0,
) {
  let height = 0;
  for (const o of p.items) {
    if (
      o.id === exclude ||
      !isPaper(o) ||
      o.hidden ||
      visible?.get(o.id) === false
    )
      continue;
    const tr = transforms?.get(o.id) ?? o,
      local = worldToLocal(tr, [x, y, tr.position[2]]);
    if (
      Math.abs(local[0]) <= o.width / 2 + padding / tr.scale &&
      Math.abs(local[1]) <= o.height / 2 + padding / tr.scale
    )
      height = Math.max(
        height,
        tr.position[2] + paperSurface(o, local[0], local[1]) * tr.scale,
      );
  }
  return height;
}
/** Explicit placement aid. Authored layout is only changed when the user/agent calls it. */
export function liftToSurface(p: Project, id: string, clearance = 0.015) {
  const o = p.items.find((o) => o.id === id);
  if (!o) return false;
  if (!Number.isFinite(clearance) || clearance < 0 || clearance > 1)
    throw Error("表面间距无效");
  let z = 0;
  const points = Array.from({ length: 9 }, (_, i) => -0.495 + (i * 0.99) / 8);
  for (const u of points)
    for (const v of points) {
      const x = u * o.width * o.scale,
        y = v * o.height * o.scale,
        c = Math.cos(o.rotation),
        s = Math.sin(o.rotation);
      z = Math.max(
        z,
        surfaceAt(
          p,
          o.position[0] + x * c - y * s,
          o.position[1] + x * s + y * c,
          undefined,
          id,
        ) +
          clearance -
          (isPaper(o)
            ? paperUnderside(o, u * o.width, v * o.height)
            : o.kind === "clip"
              ? 0.013
              : o.kind === "staple"
                ? 0.0155
                : o.kind === "pin"
                  ? 0.035
                  : 0) *
            o.scale,
      );
    }
  const next = Math.max(o.position[2], z);
  const moved = next > o.position[2];
  o.position[2] = next;
  return moved;
}
