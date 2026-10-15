import type { Studio } from "./studio";
import type { Action } from "./model";
import {
  eases,
  curvePreview,
  actionCurve,
  actionOrigin,
  spatial,
} from "./motion";
import { animationOptions } from "./cinema";
import { section, button, select, range, number, esc } from "./ui";
export function animationEditor(app: Studio, targetId?: string) {
  const shots = app.p.shots
    .map((s) => ({
      s,
      actions: s.actions.filter((a) => !targetId || a.targetId === targetId),
    }))
    .filter((g) => g.actions.length);
  const count = shots.reduce((n, g) => n + g.actions.length, 0);
  const title = targetId
    ? `物件动画 · ${count} 条`
    : `全部物件动画 · ${count} 条`;
  let body = targetId
    ? select(
        "新增动画所在镜头",
        "workspace.shotId",
        app.selectedShot ?? app.p.shots[0]?.id ?? "",
        app.p.shots.map((s) => [s.id, s.title]),
      )
    : "";
  body += `<div class="button-grid">${button("添加入场", targetId ? "object-in" : "action", "plus")}${button("添加退场", targetId ? "object-out" : "action-out", "plus")}</div>`;
  body += shots
    .map(
      ({ s, actions }) =>
        `<details class="animation-shot" data-detail-key="tracks/${s.id}/${targetId ?? "all"}" ${(targetId ? s.id === shots[0]?.s.id : s.id === (app.selectedShot ?? app.p.shots[0]?.id)) ? "open" : ""}><summary>${esc(s.title)} <small>${actions.length} 条 · ${app.shotStart(s.id).toFixed(1)}s 起</small></summary>${actions
          .map(
            (a, i) =>
              `<details class="track-row" data-detail-key="action/${a.id}" ${targetId && i === 0 ? "open" : ""}><summary><span>${esc(app.name(a.targetId))}</span><small>${a.phase === "out" ? "退场" : "入场"} · ${a.start.toFixed(1)}–${(a.start + a.duration).toFixed(1)}s</small></summary><div class="track-body">${select(
                "所属镜头",
                `action.${a.id}.shotId`,
                s.id,
                app.p.shots.map((s) => [s.id, s.title]),
              )}${select("动作方式", `action.${a.id}.type`, a.type, animationOptions(app.p, a.targetId, a.type))}<div class="field-row">${number("开始", `action.${a.id}.start`, a.start)}${number("时长", `action.${a.id}.duration`, a.duration)}</div>${motionControls(a)}${section("动作高级", number("强度", `action.${a.id}.strength`, a.strength))}<div class="button-grid"><button data-preview-action="${a.id}">预览动作</button><button data-remove-action="${a.id}">移除轨道</button></div></div></details>`,
          )
          .join("")}</details>`,
    )
    .join("");
  if (!count)
    body +=
      '<p class="helper">选中物件后添加动作。动作与时间线同源，修改后在镜头窗口同步显示。</p>';
  return section(title, body, true);
}
function motionControls(a: Action) {
  const bind = `action.${a.id}`,
    c = actionCurve(a);
  return (
    select("演出阶段", `${bind}.phase`, a.phase ?? "in", [
      ["in", "入场 · 淡入"],
      ["out", "退场 · 淡出"],
    ]) +
    select(
      "缓动曲线",
      `${bind}.ease`,
      a.ease ?? (a.phase === "out" ? "accelerate" : "cinematic"),
      eases,
    ) +
    section(
      "曲线预览 / 自定义",
      curvePreview(a) +
        (a.ease === "custom"
          ? `<div class="field-row">${range("起点控制 X", `${bind}.bezier.0`, c[0], 0, 1, 0.01)}${range("起点控制 Y", `${bind}.bezier.1`, c[1], 0, 1, 0.01)}</div><div class="field-row">${range("终点控制 X", `${bind}.bezier.2`, c[2], 0, 1, 0.01)}${range("终点控制 Y", `${bind}.bezier.3`, c[3], 0, 1, 0.01)}</div>`
          : ""),
      a.ease === "custom",
    ) +
    range("淡化占比", `${bind}.fade`, a.fade ?? 0.65, 0, 1, 0.01) +
    (spatial(a)
      ? select("起止位置", `${bind}.origin`, actionOrigin(a), [
          ["screen", "画面外"],
          ["local", "物件附近"],
          ["stationary", "原位动作 / 淡化"],
        ]) +
        (actionOrigin(a) === "screen"
          ? select(
              "画外方向",
              `${bind}.direction`,
              a.direction ?? (a.type === "slide" ? "left" : "top"),
              [
                ["left", "左侧"],
                ["right", "右侧"],
                ["top", "上方"],
                ["bottom", "下方"],
              ],
            ) +
            range("画外距离", `${bind}.travel`, a.travel ?? 1, 1, 4, 0.05, "×")
          : "")
      : "")
  );
}
