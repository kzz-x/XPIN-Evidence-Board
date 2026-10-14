import {
  emptyProject,
  uid,
  poseFor,
  validateProject,
  type Project,
  type Kind,
  type V3,
} from "./model";
import { makeItem } from "./modules";
type Legacy = Record<string, any>;
export function importProject(data: unknown): Project {
  const old = data as Legacy;
  if (old?.version === 3) return validateProject(old);
  if (!old || !Array.isArray(old.objects) || !Array.isArray(old.pins))
    throw new Error("工程格式不识别");
  const p = emptyProject();
  p.name = old.name ?? "V2 迁移工程";
  p.settings.board = old.board === "cork" ? "cork" : "felt";
  p.settings.aspect = old.aspect === "9:16" ? "9:16" : "16:9";
  const kinds: Record<string, Kind> = {
    photo: "photo",
    file: "file",
    note: "note",
    news: "news",
    label: "label",
  };
  for (const o of old.objects) {
    const item = makeItem(kinds[o.type] ?? "file", [
      (o.x + o.w / 2) / 60,
      -(o.y + o.h / 2) / 60,
      0.035 + (o.z ?? 1) * 0.012,
    ]);
    item.id = o.id;
    item.width = o.w / 60;
    item.height = o.h / 60;
    item.rotation = (-(o.r ?? 0) * Math.PI) / 180;
    item.scale = o.scale ?? 1;
    item.title = o.title ?? item.title;
    item.body = o.body ?? item.body;
    if (o.image?.startsWith("data:image")) {
      item.assetId = uid("asset");
      p.assets[item.assetId] = o.image;
    }
    p.items.push(item);
  }
  for (const pin of old.pins) {
    const host = p.items.find((o) => o.id === pin.hostId);
    p.pins.push({
      id: pin.id,
      hostId: host?.id,
      local: host
        ? [(pin.u - 0.5) * host.width, (0.5 - pin.v) * host.height, 0.025]
        : [(pin.x ?? 0) / 60, -(pin.y ?? 0) / 60, 0.025],
      color: "#b3242c",
    });
  }
  for (const r of old.links ?? [])
    p.ropes.push({
      id: r.id,
      from: r.a,
      to: r.b,
      radius: (r.width ?? 3) / 160,
      slack: 0.1,
      bend: -(r.sag ?? 0) / 60,
      color: r.color ?? "#b3242c",
      style: "cotton",
    });
  for (const m of old.marks ?? []) {
    const host = p.items.find((o) => o.id === m.hostId);
    p.marks.push({
      id: m.id,
      hostId: host?.id,
      points: m.points.map(
        (point: Legacy): V3 =>
          host
            ? [
                (point.x - 0.5) * host.width,
                (0.5 - point.y) * host.height,
                0.027,
              ]
            : [point.x / 60, -point.y / 60, 0.027],
      ),
      color: "#a82228",
      radius: (m.width ?? 3) / 150,
    });
  }
  for (const s of old.shots ?? [])
    p.shots.push({
      id: s.id,
      title: s.title ?? "镜头",
      duration: Math.max(0.3, (s.duration ?? 3000) / 1000),
      targetIds: s.target ? [s.target] : [],
      camera: poseFor(
        p,
        s.target ? [s.target] : [],
        s.kind === "overview" ? "overview" : "focus",
      ),
      motion: s.kind === "overview" ? "overview" : "focus",
      ease: "smooth",
      actions: [],
      cues: [],
    });
  p.camera = poseFor(p, [], "overview");
  return validateProject(p);
}
