import {
  worldToLocal,
  type Item,
  type Project,
  type Transform,
  type V3,
} from "./model";
export function paperSurface(o: Item, x: number, y: number) {
  const u = Math.max(-0.5, Math.min(0.5, x / o.width)),
    v = Math.max(-0.5, Math.min(0.5, y / o.height));
  return (
    0.007 +
    ((Math.pow(Math.abs(u) * 2, 8) * 0.018 +
      Math.pow(Math.abs(v) * 2, 10) * 0.01) *
      (o.kind === "note" ? 1.5 : 1) +
      Math.sin(u * 2.3 + v * 1.2) * 0.002) *
      (o.paperCurl ?? 1)
  );
}
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
  let z = 0;
  for (const u of [-0.48, 0, 0.48])
    for (const v of [-0.48, 0, 0.48]) {
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
        ),
      );
    }
  const next = Math.max(o.position[2], z + clearance + 0.006 * o.scale);
  const moved = next > o.position[2];
  o.position[2] = next;
  return moved;
}
