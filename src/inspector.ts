import type { Studio } from "./studio";
import { moduleByKind } from "./modules";
import {
  button,
  range,
  number,
  select,
  check,
  color,
  text,
  section,
  esc,
  icon,
} from "./ui";
export function inspector(app: Studio) {
  const p = app.p,
    id = app.selection[0],
    o = p.items.find((o) => o.id === id),
    r = p.ropes.find((o) => o.id === id),
    l = p.lights.find((o) => o.id === id),
    pin = p.pins.find((o) => o.id === id),
    mark = p.marks.find((o) => o.id === id);
  let html = "";
  const heading = (small: string, title: string, desc = "") =>
    `<div class="selection-heading"><small>${small}</small><h2>${esc(title)}</h2>${desc ? `<p>${esc(desc)}</p>` : ""}</div>`;
  if (app.panel === "object") {
    if (o) {
      html =
        heading(moduleByKind(o.kind).category + " / SELECTED", o.title) +
        section(
          "内容与影像",
          text("标题", "item.title", o.title) +
            text("正文 / 题注", "item.body", o.body, true) +
            (["photo", "polaroid", "film", "profile"].includes(o.kind)
              ? button("替换本地影像", "image", "photo", "wide-button")
              : "") +
            color("纸张 / 材质颜色", "item.color", o.color),
        );
      html += section(
        "位置与姿态",
        `<div class="field-row">${number("X", "item.position.0", o.position[0])}${number("Y", "item.position.1", o.position[1])}${number("层高 Z", "item.position.2", o.position[2], 0.01)}</div>` +
          range(
            "旋转",
            "item.rotationDeg",
            (o.rotation * 180) / Math.PI,
            -180,
            180,
            1,
            "°",
          ) +
          range("缩放", "item.scale", o.scale, 0.15, 3, 0.01) +
          `<div class="field-row">${number("宽度", "item.width", o.width)}${number("高度", "item.height", o.height)}</div>` +
          check("锁定物件", "item.locked", o.locked) +
          check("隐藏物件", "item.hidden", o.hidden),
      );
      html += section(
        "关系与组合",
        `<div class="button-grid">${button("钉图钉", "pin", "pin")}${button("复制", "duplicate", "group")}${button(o.groupId ? "拆组" : "组合", "group", "group")}${button("存为预设", "preset", "save")}${button("上移一层", "raise")}${button("下移一层", "lower")}${button("水平对齐", "align-x")}${button("垂直对齐", "align-y")}</div>`,
        false,
      );
      html += `<div class="inspector-actions">${button("加入故事镜头", "shot", "camera", "primary wide-button")}${button("删除选中", "delete", "trash", "danger wide-button")}</div>`;
    } else if (r) {
      html =
        heading(
          "RELATION / TRUE 3D",
          "编织红绳",
          "两端绑定图钉 · 三股实体纤维",
        ) +
        section(
          "绳索材质",
          select("纤维类型", "rope.style", r.style, [
            ["cotton", "棉绳"],
            ["hemp", "麻绳"],
            ["nylon", "尼龙"],
          ]) +
            color("绳色", "rope.color", r.color) +
            range("截面半径", "rope.radius", r.radius, 0.008, 0.1, 0.001) +
            range("松垂", "rope.slack", r.slack, 0, 1, 0.01) +
            range("曲率", "rope.bend", r.bend, -2, 2, 0.01) +
            check("额外控制点", "rope.hasControl", Boolean(r.control)) +
            (r.control
              ? `<div class="field-row">${number("控制 X", "rope.control.0", r.control[0])}${number("控制 Y", "rope.control.1", r.control[1])}${number("控制 Z", "rope.control.2", r.control[2])}</div>`
              : ""),
        ) +
        button("沿绳摄影机镜头", "rope-shot", "camera", "primary wide-button") +
        button("删除红绳", "delete", "trash", "wide-button");
    } else if (pin) {
      html =
        heading(
          "LOCAL ANCHOR",
          "三维图钉",
          pin.hostId ? "图钉绑定宿主局部坐标" : "独立图钉",
        ) +
        section(
          "图钉",
          color("塑料颜色", "pin.color", pin.color) +
            `<div class="field-row">${number("局部 X", "pin.local.0", pin.local[0])}${number("局部 Y", "pin.local.1", pin.local[1])}${number("局部 Z", "pin.local.2", pin.local[2], 0.01)}</div>`,
        ) +
        button("从这里连接", "rope", "rope", "primary wide-button") +
        button("删除图钉", "delete", "trash", "wide-button");
    } else if (mark) {
      html =
        heading("ANNOTATION", "手绘标注") +
        section(
          "笔迹",
          color("墨迹颜色", "mark.color", mark.color) +
            range("笔画粗细", "mark.radius", mark.radius, 0.005, 0.08, 0.001),
        ) +
        button("删除标注", "delete", "trash", "wide-button");
    } else if (l) {
      app.panel = "light";
      return inspector(app);
    } else
      html = `<div class="empty-selection">${icon("select")}<h2>每条线索，都有位置。</h2><p>从背包拖入资料，或点击沙盘中的物件开始编辑。</p><div class="key-guide"><span>V</span>移动物件<span>P</span>钉下图钉<span>C</span>连接红绳<span>M</span>手绘标注</div></div>`;
  }
  if (app.panel === "light") {
    const s = p.settings;
    html =
      heading("LIGHTING DEPARTMENT", "让线索被看见", "主光塑形，追光讲述。") +
      `<div class="look-presets">${["暖冷电影", "Noir 硬光", "柔和档案", "侧逆光", "追光调查"].map((v, i) => `<button data-look="${i}">${v}</button>`).join("")}</div>`;
    html += section(
      "主造型光",
      range("光线方位", "settings.keyAzimuth", s.keyAzimuth, 0, 360, 1, "°") +
        range(
          "光线仰角",
          "settings.keyElevation",
          s.keyElevation,
          15,
          75,
          1,
          "°",
        ) +
        range("主光亮度", "settings.keyIntensity", s.keyIntensity, 0, 10, 0.1) +
        color("主光色温", "settings.keyColor", s.keyColor) +
        range("环境补光", "settings.ambient", s.ambient, 0, 2, 0.01) +
        range("阴影柔软度", "settings.softness", s.softness, 0.1, 5, 0.1),
    );
    html += section(
      "追光灯",
      p.lights
        .map(
          (l) =>
            `<button class="light-row ${l.id === id ? "active" : ""}" data-select="${l.id}"><span style="--light:${l.color}" class="light-dot"></span><span>${esc(l.name)}<small>${l.hostId ? "跟随物件" : "自由落点"} / ${l.enabled ? "点亮" : "熄灭"}</small></span>${icon("light")}</button>`,
        )
        .join("") +
        button("添加一盏追光灯", "add-light", "plus", "wide-button"),
    );
    if (l)
      html += section(
        "当前追光",
        text("灯光名称", "light.name", l.name) +
          check("灯光开启", "light.enabled", l.enabled) +
          range("亮度", "light.intensity", l.intensity, 0, 350, 1) +
          color("灯光颜色", "light.color", l.color) +
          range("光束半角", "light.angle", l.angle, 5, 75, 1, "°") +
          range("柔和边缘", "light.penumbra", l.penumbra, 0, 1, 0.01) +
          range("照射距离", "light.distance", l.distance, 5, 80, 1) +
          range("衰减指数", "light.decay", l.decay, 0, 2, 0.1) +
          check("投射真实阴影", "light.shadow", l.shadow) +
          select("跟随目标", "light.hostId", l.hostId ?? "", [
            ["", "自由落点"],
            ...p.items.map((o) => [o.id, o.title] as [string, string]),
          ]) +
          `<div class="field-row">${number("灯位 X", "light.position.0", l.position[0])}${number("灯位 Y", "light.position.1", l.position[1])}${number("灯位 Z", "light.position.2", l.position[2])}</div><div class="field-row">${number("落点 X", "light.target.0", l.target[0])}${number("落点 Y", "light.target.1", l.target[1])}</div><div class="button-grid">${button("指定落点", "target", "focus")}${button("加入追光 Cue", "cue", "camera")}${button("恢复默认", "light-reset")}${button("复制灯光", "light-copy")}${button("删除灯光", "delete", "trash")}</div>`,
      );
  }
  if (app.panel === "scene") {
    const s = p.settings;
    html =
      heading("ART DIRECTION", "档案室的空气") +
      section(
        "沙盘与画幅",
        text("工程名称", "project.name", p.name) +
          select("板材", "settings.board", s.board, [
            ["cork", "软木调查板"],
            ["felt", "暗色纤维板"],
            ["wood", "木质档案桌"],
            ["grid", "工业网格"],
          ]) +
          select("作品画幅", "settings.aspect", s.aspect, [
            ["16:9", "16:9 / 电影横幅"],
            ["9:16", "9:16 / 纵向叙事"],
            ["3:4", "3:4 / 档案肖像"],
            ["1:1", "1:1 / 方形画幅"],
          ]) +
          check("显示网格", "settings.grid", s.grid),
      );
    html += section(
      "镜头与成像",
      range("曝光", "settings.exposure", s.exposure, 0.25, 2, 0.01) +
        range("景深强度", "settings.dof", s.dof, 0, 1, 0.01) +
        range("焦点偏移", "settings.focusOffset", s.focusOffset, -8, 8, 0.05) +
        select("预览质量", "settings.quality", s.quality, [
          ["draft", "快速 / 1024 阴影 / 无景深"],
          ["studio", "影棚 / 2048 阴影"],
          ["ultra", "精细 / 4096 阴影"],
        ]) +
        `<p class="helper">真实 GPU 渲染，无软件光影替身。输出沿用当前质量档。</p>`,
    );
    html +=
      section(
        "声音",
        button(
          p.audio ? "替换口播 / 音轨" : "导入口播 / 音轨",
          "audio",
          "volume",
          "wide-button",
        ) +
          (p.audio
            ? button("移除音轨", "audio-remove", "close", "wide-button")
            : "") +
          `<p class="helper">音轨内嵌工程。播放、Seek 与视频共享时间。</p>`,
        false,
      ) +
      section(
        "渲染信息",
        `<pre>${esc(JSON.stringify(app.view.audit(), null, 2))}</pre>`,
        false,
      );
  }
  if (app.panel === "shot") {
    const shot = p.shots.find((s) => s.id === app.selectedShot) ?? p.shots[0];
    if (!shot)
      return (
        heading("DIRECTOR", "把调查变成故事。") +
        button("添加全览镜头", "shot", "plus", "primary wide-button")
      );
    app.selectedShot = shot.id;
    html =
      heading("DIRECTOR'S DESK", shot.title) +
      section(
        "镜头节奏",
        text("镜头名称", "shot.title", shot.title) +
          number("时长 / 秒", "shot.duration", shot.duration, 0.1) +
          select("镜头运动", "shot.motion", shot.motion, [
            ["focus", "目标特写"],
            ["push", "缓慢推近"],
            ["pan", "横移探索"],
            ["rope", "沿绳追踪"],
            ["overview", "全局揭示"],
          ]) +
          select("缓动", "shot.ease", shot.ease, [
            ["smooth", "平滑衔接"],
            ["linear", "匀速"],
          ]) +
          `<div class="button-grid">${button("用当前机位", "capture-camera", "camera")}${button("重新自动构图", "reframe", "focus")}${button("向前移", "shot-left")}${button("向后移", "shot-right")}${button("复制镜头", "shot-copy")}${button("删除镜头", "shot-delete", "trash")}</div>`,
      );
    const c = shot.camera;
    html += section(
      "摄影机精调",
      `<div class="field-row">${number("目标 X", "shot.camera.target.0", c.target[0])}${number("目标 Y", "shot.camera.target.1", c.target[1])}${number("目标 Z", "shot.camera.target.2", c.target[2])}</div>` +
        range("镜头距离", "shot.camera.distance", c.distance, 2, 70, 0.1) +
        range(
          "水平环视",
          "shot.yawDeg",
          (c.yaw * 180) / Math.PI,
          -70,
          70,
          1,
          "°",
        ) +
        range(
          "俯仰",
          "shot.pitchDeg",
          (c.pitch * 180) / Math.PI,
          -60,
          60,
          1,
          "°",
        ) +
        range(
          "倾斜构图",
          "shot.rollDeg",
          (c.roll * 180) / Math.PI,
          -25,
          25,
          1,
          "°",
        ) +
        range("焦距", "shot.camera.focal", c.focal, 24, 100, 1, " mm"),
      false,
    );
    html += section(
      "出场与逐笔轨道",
      `<div class="helper">先选物件、绳索或标注，再加入本镜头。</div><div class="button-grid">${button("加入选中物入场", "action", "plus")}${button("加入选中追光", "cue", "light")}</div>` +
        shot.actions
          .map(
            (a) =>
              `<div class="track-row"><b>${esc(app.name(a.targetId))}</b>${select(
                "出场方式",
                `action.${a.id}.type`,
                a.type,
                [
                  ["settle", "甩入贴附"],
                  ["slide", "滑入"],
                  ["type", "打字揭示"],
                  ["grow", "绳索生长"],
                  ["draw", "沿路绘制"],
                  ["stamp", "印章压下"],
                ],
              )}<div class="field-row">${number("开始", `action.${a.id}.start`, a.start)}${number("时长", `action.${a.id}.duration`, a.duration)}${number("强度", `action.${a.id}.strength`, a.strength)}</div><button data-remove-action="${a.id}">移除轨道</button></div>`,
          )
          .join(""),
    );
    html += section(
      "追光 Cue",
      shot.cues
        .map(
          (c) =>
            `<div class="track-row"><b>${esc(p.lights.find((l) => l.id === c.lightId)?.name ?? "灯光")}</b>${select("结束目标", `cue.${c.id}.targetId`, c.targetId ?? "", [["", "自由落点"], ...p.items.map((o) => [o.id, o.title] as [string, string])])}<div class="field-row">${number("开始", `cue.${c.id}.start`, c.start)}${number("时长", `cue.${c.id}.duration`, c.duration)}</div><div class="field-row">${number("进入亮度", `cue.${c.id}.fromIntensity`, c.fromIntensity, 1)}${number("结束亮度", `cue.${c.id}.toIntensity`, c.toIntensity, 1)}</div><div class="field-row">${number("起始 X", `cue.${c.id}.from.0`, c.from[0])}${number("起始 Y", `cue.${c.id}.from.1`, c.from[1])}</div><div class="field-row">${number("结束 X", `cue.${c.id}.to.0`, c.to[0])}${number("结束 Y", `cue.${c.id}.to.1`, c.to[1])}</div><div class="field-row">${number("进入半角", `cue.${c.id}.fromAngle`, c.fromAngle, 1)}${number("结束半角", `cue.${c.id}.toAngle`, c.toAngle, 1)}</div>${select(
              "过渡方式",
              `cue.${c.id}.ease`,
              c.ease,
              [
                ["smooth", "平滑"],
                ["linear", "匀速"],
                ["hold", "保持后切换"],
              ],
            )}<button data-remove-cue="${c.id}">移除 Cue</button></div>`,
        )
        .join("") ||
        '<p class="helper">在布光面板选灯光，加入 Cue。镜头运动和追光可以独立编排。</p>',
    );
  }
  return html;
}
