import type { Item } from "./model";
export function paperSeed(o: Item) {
  if (o.wearSeed !== undefined) return o.wearSeed >>> 0;
  let seed = 47;
  for (const c of o.id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  return seed;
}
export const wearParameters = (o: Item) => ({
  wear: o.wear ?? 0.35,
  tear: o.edgeTear ?? 0.65,
  stains: o.stainAmount ?? 0.18,
  seed: paperSeed(o),
});
const noise = (x: number, seed: number) =>
  0.5 +
  0.25 * Math.sin(x * 17.3 + seed) +
  0.15 * Math.sin(x * 53.7 + seed * 0.37) +
  0.1 * Math.sin(x * 127.1 + seed * 1.17);
/** Stable geometric torn contour, shared by top and back; no alpha-cut card illusion. */
export function paperPoint(o: Item, x: number, y: number): [number, number] {
  const { wear, tear, seed } = wearParameters(o),
    u = x / o.width,
    v = y / o.height;
  const amplitude = Math.min(o.width, o.height) * 0.024 * wear * tear;
  return [
    x -
      Math.sign(u) *
        Math.pow(Math.abs(u) * 2, 18) *
        amplitude *
        (0.2 + noise(v, seed) * 1.8),
    y -
      Math.sign(v) *
        Math.pow(Math.abs(v) * 2, 18) *
        amplitude *
        (0.2 + noise(u, seed + 31) * 1.8),
  ];
}
function sheetHeight(o: Item, x: number, y: number) {
  const u = Math.max(-0.5, Math.min(0.5, x / o.width)),
    v = Math.max(-0.5, Math.min(0.5, y / o.height)),
    { wear, tear, seed } = wearParameters(o);
  let curl = 0;
  for (const [cx, cy, i] of [
    [-0.5, -0.5, 0],
    [0.5, -0.5, 1],
    [-0.5, 0.5, 2],
    [0.5, 0.5, 3],
  ]) {
    const h = 0.012 + 0.07 * noise(i, seed * 0.03);
    curl += Math.exp(-((u - cx) ** 2 + (v - cy) ** 2) / 0.019) * h * wear;
  }
  const edge = Math.max(Math.abs(u), Math.abs(v)) * 2;
  return (
    0.007 +
    ((Math.pow(Math.abs(u) * 2, 8) * 0.018 +
      Math.pow(Math.abs(v) * 2, 10) * 0.01) *
      (o.kind === "note" ? 1.5 : 1) +
      Math.sin(u * 2.3 + v * 1.2) * 0.002 +
      curl +
      Math.pow(edge, 14) * wear * tear * 0.004 * noise(u + v, seed) +
      wear * 0.001 * Math.sin(u * 26 + seed) * Math.sin(v * 19 + seed * 0.3)) *
      (o.paperCurl ?? 1)
  );
}
export const folderSettings = (o: Item) => ({
  depth: o.folderDepth ?? 0.085,
  angle: ((o.folderOpen ?? 4) * Math.PI) / 180,
});
export function folderCover(o: Item): Item {
  return { ...o, kind: "file", width: o.width * 0.96, height: o.height * 0.94 };
}
/** Upper envelope of the actual layered folder, including its tilted front cover. */
export function paperSurface(o: Item, x: number, y: number): number {
  if (o.kind !== "folder") return sheetHeight(o, x, y);
  const { depth, angle } = folderSettings(o),
    cover = folderCover(o),
    hinge = -o.width * 0.49;
  if (
    x >= hinge &&
    x <= hinge + cover.width * Math.cos(angle) &&
    Math.abs(y + o.height * 0.02) <= cover.height / 2
  ) {
    let d = (x - hinge) / Math.cos(angle);
    for (let i = 0; i < 5; i++)
      d =
        (x -
          hinge +
          Math.sin(angle) *
            sheetHeight(cover, d - cover.width / 2, y + o.height * 0.02)) /
        Math.cos(angle);
    return (
      depth +
      d * Math.sin(angle) +
      sheetHeight(cover, d - cover.width / 2, y + o.height * 0.02) *
        Math.cos(angle)
    );
  }
  return Math.max(
    sheetHeight(o, x, y),
    Math.abs(y) < o.height * 0.43 ? depth * 0.78 : 0,
  );
}
export const paperThickness = (o: Item) =>
  o.kind === "folder"
    ? 0.016
    : ["photo", "polaroid", "film", "profile"].includes(o.kind)
      ? 0.008
      : 0.006;

export function paperUnderside(o: Item, x: number, y: number) {
  return (
    sheetHeight(o.kind === "folder" ? { ...o, kind: "file" } : o, x, y) -
    paperThickness(o)
  );
}
