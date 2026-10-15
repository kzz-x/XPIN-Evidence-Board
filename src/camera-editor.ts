import type { Shot, Project } from "./model";
import { cameraEases, cameraCurve, cameraCurvePreview } from "./camera-motion";
import { eases } from "./motion";
import { range, number, select, check, section, button } from "./ui";
export function cameraTimingControls(s: Shot) {
  const c = cameraCurve(s);
  return (
    select("机位缓动", "shot.ease", s.ease, cameraEases) +
    range(
      "运动占镜头时长",
      "shot.moveFraction",
      s.moveFraction ?? 0.85,
      0.1,
      1,
      0.01,
    ) +
    section(
      "摄影机曲线",
      cameraCurvePreview(s) +
        (s.ease === "custom"
          ? `<div class="field-row">${range("控制 X1", "shot.bezier.0", c[0], 0, 1, 0.01)}${range("控制 Y1", "shot.bezier.1", c[1], 0, 1, 0.01)}</div><div class="field-row">${range("控制 X2", "shot.bezier.2", c[2], 0, 1, 0.01)}${range("控制 Y2", "shot.bezier.3", c[3], 0, 1, 0.01)}</div>`
          : ""),
      s.ease === "custom",
    )
  );
}
export function lensControls(s: Shot, p: Project) {
  const c = s.camera,
    f = s.focusPull;
  return section(
    "光圈、景深与拉焦",
    range("光圈 f/", "shot.camera.fStop", c.fStop ?? 4, 0.8, 22, 0.1) +
      check(
        "自动对焦观看目标",
        "shot.autoFocus",
        c.focusDistance === undefined,
      ) +
      (c.focusDistance !== undefined
        ? range(
            "对焦距离",
            "shot.camera.focusDistance",
            c.focusDistance,
            0.1,
            80,
            0.01,
          )
        : "") +
      button("对焦当前选中物件", "focus-selected", "focus", "wide-button") +
      check("启用镜内拉焦", "shot.hasFocusPull", !!f) +
      (f
        ? `<div class="field-row">${range("起始焦点距离", "shot.focusPull.from", f.from, 0.1, 80, 0.01)}${range("结束焦点距离", "shot.focusPull.to", f.to, 0.1, 80, 0.01)}</div><div class="field-row">${number("拉焦开始 / 秒", "shot.focusPull.start", f.start, 0.1)}${number("拉焦时长 / 秒", "shot.focusPull.duration", f.duration, 0.1)}</div>${select(
            "拉焦缓动",
            "shot.focusPull.ease",
            f.ease ?? "smooth",
            eases.filter(([e]) => e !== "custom"),
          )}`
        : "") +
      range("全局景深强度", "settings.dof", p.settings.dof, 0, 1, 0.01) +
      '<p class="helper">小 f 数值产生浅景深。故事摄影机下预览逐镜光圈与焦点；草稿档或景深强度为 0 时不显示模糊。拉焦距离使用场景单位。</p>',
    false,
  );
}
