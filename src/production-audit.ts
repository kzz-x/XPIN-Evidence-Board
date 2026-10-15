import {
  clone,
  validateProject,
  worldToLocal,
  localToWorld,
  pinWorld,
  type Project,
  type V3,
  type Pose,
} from "./model";
import { evaluate, duration } from "./story";
import { paperSurface, isPaper, surfaceAt } from "./surface";

export function cameraPosition(c: Pose): V3 {
  return [
    c.target[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * c.distance,
    c.target[1] + Math.sin(c.pitch) * c.distance,
    c.target[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * c.distance,
  ];
}
/** Conservative sampled checks, never a claim of complete collision or visual verification. */
export function auditProduction(input: Project, step = 0.25) {
  if (!Number.isFinite(step) || step <= 0)
    throw Error("检查步长必须是有限正秒数");
  const p = validateProject(clone(input)),
    total = duration(p),
    times = new Set<number>([0, total]);
  const interval = Math.max(step, total / 480);
  for (let t = 0; t < total; t += interval) times.add(Number(t.toFixed(5)));
  let acc = 0;
  for (const s of p.shots) {
    times.add(acc);
    for (const a of s.actions)
      for (const t of [a.start, a.start + a.duration / 2, a.start + a.duration])
        times.add(Math.min(total, acc + t));
    acc += s.duration;
  }
  const issues: {
      code: string;
      severity: "warning" | "error";
      ids: string[];
      time: number;
      message: string;
    }[] = [],
    seen = new Set<string>();
  const add = (
    code: string,
    ids: string[],
    time: number,
    message: string,
    severity: "warning" | "error" = "warning",
  ) => {
    const key = code + ids.join("/");
    if (!seen.has(key)) {
      seen.add(key);
      issues.push({ code, ids, time, message, severity });
    }
  };
  for (const s of p.shots) {
    if (s.focusPull && s.focusPull.start + s.focusPull.duration > s.duration)
      add(
        "FOCUS_PULL_OUTSIDE_SHOT",
        [s.id],
        0,
        "拉焦结束超过所属镜头；延长镜头或缩短拉焦时段。",
      );
  }
  let previous: { position: V3; time: number } | undefined;
  for (const t of [...times].sort((a, b) => a - b)) {
    const f = evaluate(p, t),
      papers = p.items.filter(
        (o) =>
          isPaper(o) &&
          f.visible.get(o.id) &&
          (f.opacity.get(o.id) ?? 1) > 0.98,
      );
    const stable = papers.filter(
      (o) => !f.deformation.has(o.id) || (f.progress.get(o.id) ?? 1) > 0.995,
    );
    for (const a of stable) {
      const tr = f.transforms.get(a.id)!;
      if (tr.position[2] < -0.002)
        add(
          "ITEM_BELOW_BOARD",
          [a.id],
          t,
          "物件基面进入背板；检查 Z 或调用 liftToSurface。",
          "error",
        );
      for (const b of stable) {
        if (a.id >= b.id) continue;
        const tb = f.transforms.get(b.id)!;
        let min = Infinity,
          max = -Infinity;
        for (const [o, other, ta, to] of [
          [a, b, tr, tb],
          [b, a, tb, tr],
        ] as const)
          for (const u of [-0.48, 0, 0.48])
            for (const v of [-0.48, 0, 0.48]) {
              const x = o.width * u,
                y = o.height * v,
                pos = localToWorld(ta, [x, y, paperSurface(o, x, y)]),
                local = worldToLocal(to, pos);
              if (
                Math.abs(local[0]) > other.width / 2 ||
                Math.abs(local[1]) > other.height / 2
              )
                continue;
              let gap =
                pos[2] -
                (to.position[2] +
                  paperSurface(other, local[0], local[1]) * to.scale);
              if (o.id !== a.id) gap = -gap;
              min = Math.min(min, gap);
              max = Math.max(max, gap);
            }
        if (
          min !== Infinity &&
          ((min < 0 && max > 0) ||
            Math.min(Math.abs(min), Math.abs(max)) < 0.006)
        )
          add(
            "PAPER_SURFACE_INTERSECTION",
            [a.id, b.id],
            t,
            "采样纸面相交或层间余量不足；按构图意图调整 Z/翘曲，必要时 liftToSurface。",
            "error",
          );
      }
    }
    for (const pin of p.pins) {
      if (
        (f.opacity.get(pin.id) ?? 1) < 0.98 ||
        (pin.hostId && !f.visible.get(pin.hostId))
      )
        continue;
      const pos = pinWorld(p, pin, f.transforms),
        off = f.offsets.get(pin.id);
      if (off) for (let i = 0; i < 3; i++) pos[i] += off[i];
      if (
        surfaceAt(p, pos[0], pos[1], f.transforms, pin.hostId, f.visible) >
        pos[2] + 0.15
      )
        add(
          "PIN_HEAD_BURIED",
          [pin.id],
          t,
          "图钉头被另一层纸遮住；重新选择宿主或抬高源位置。",
          "error",
        );
    }
    for (const r of p.ropes)
      if ((f.progress.get(r.id) ?? 1) > 0 && (f.opacity.get(r.id) ?? 1) > 0.1) {
        for (const id of [r.from, r.to]) {
          const pin = p.pins.find((a) => a.id === id)!;
          if (
            (f.progress.get(id) ?? 1) < 0.98 ||
            (pin.hostId && (f.progress.get(pin.hostId) ?? 1) < 0.98)
          )
            add(
              "CONNECTION_BEFORE_ANCHOR_READY",
              [r.id, id],
              t,
              "绳已生长但端点或宿主尚未停稳；建议推迟绳的开始时间。",
            );
        }
      }
    const c = f.camera,
      pos = cameraPosition(c),
      surface = surfaceAt(
        p,
        pos[0],
        pos[1],
        f.transforms,
        undefined,
        f.visible,
      );
    if (pos[2] < surface + 0.15)
      add(
        "CAMERA_SURFACE_COLLISION",
        [p.shots[f.shotIndex]?.id ?? "camera"],
        t,
        "摄影机接近或进入背板/纸面；提高距离或调整目标和俯仰。",
        "error",
      );
    if (
      Math.abs(c.roll) > 0.35 ||
      Math.abs(c.yaw) > 1.05 ||
      Math.abs(c.pitch) > 0.8
    )
      add(
        "CAMERA_EXTREME_ANGLE",
        [p.shots[f.shotIndex]?.id ?? "camera"],
        t,
        "机位倾斜较大；确认文字可读和前景遮挡符合意图。",
      );
    if (previous && t > previous.time) {
      const speed =
        Math.hypot(...pos.map((v, i) => v - previous!.position[i])) /
        (t - previous.time);
      if (
        speed >
        Math.max(
          8,
          Math.max(p.settings.boardWidth, p.settings.boardHeight) * 0.8,
        )
      )
        add(
          "CAMERA_FAST_TRANSITION",
          [p.shots[f.shotIndex]?.id ?? "camera"],
          t,
          `摄影机速度约 ${speed.toFixed(1)} 场景单位/秒；考虑延长镜头、减小位移或加过渡镜头。`,
        );
    }
    previous = { position: pos, time: t };
  }
  return {
    format: "xpin-production-audit/1",
    scope: "sampled-surfaces-and-camera",
    renderValidated: false,
    continuousCollisionVerified: false,
    duration: total,
    requestedStep: step,
    effectiveStep: interval,
    samples: times.size,
    issues,
    limits: [
      "纸面为稳定姿态稀疏采样；折叠中的柔纸、固定件形体、绳间交叉和薄边仍需实际画面检查。",
      "不移动或改写源工程；错误与警告需按创作意图处理后复测。",
    ],
  };
}
