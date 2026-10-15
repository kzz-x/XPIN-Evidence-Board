import { looks, brushes, gobos, animationOptions } from "./cinema";
import {
  eases,
  curvePreview,
  actionCurve,
  actionOrigin,
  spatial,
} from "./motion";
import type { Action } from "./model";
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
      const hardware = ["clip", "pin", "staple", "tape"].includes(o.kind);
      const paper = !["clip", "pin", "staple", "stamp"].includes(o.kind);
      html =
        heading(moduleByKind(o.kind).category + " / SELECTED", o.title) +
        section(
          "内容与影像",
          text("标题", "item.title", o.title) +
            text("正文 / 题注", "item.body", o.body, true) +
            (["photo", "polaroid", "film", "profile"].includes(o.kind)
              ? button("替换本地影像", "image", "photo", "wide-button")
              : "") +
            color("纸张 / 材质颜色", "item.color", o.color) +
            select("字体覆盖", "item.font", o.font ?? "", [
              ["", "跟随全局字体"],
              ...app.fonts.map((f) => [f, f] as [string, string]),
            ]) +
            range(
              "文字大小",
              "item.fontScale",
              o.fontScale ?? p.settings.fontScale,
              0.4,
              2.5,
              0.05,
            ),
        );
      if (hardware)
        html =
          heading(moduleByKind(o.kind).category + " / SELECTED", o.title) +
          section(
            "部件",
            text("名称", "item.title", o.title) +
              color("材质颜色", "item.color", o.color),
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
        "材质与部件动画",
        range(
          "表面粗糙度",
          "item.roughness",
          o.roughness ??
            (o.kind === "clip"
              ? 0.35
              : o.kind === "pin"
                ? 0.26
                : o.kind === "staple"
                  ? 0.24
                  : o.kind === "tape"
                    ? 0.7
                    : 0.9),
          0.2,
          1,
          0.01,
        ) +
          (paper
            ? range(
                "纸张翘曲",
                "item.paperCurl",
                o.paperCurl ?? 1,
                0,
                3,
                0.05,
              ) +
              range(
                "纸纤维强度",
                "item.fiberStrength",
                o.fiberStrength ?? 1,
                0,
                3,
                0.05,
              )
            : " ") +
          select(
            "专属入场动画",
            "item.entrance",
            o.entrance ?? animationOptions(p, o.id)[0][0],
            animationOptions(p, o.id),
          ) +
          button("应用到故事镜头", "entrance", "play", "wide-button"),
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
            range(
              "塑料粗糙度",
              "pin.roughness",
              pin.roughness ?? 0.26,
              0.08,
              1,
              0.01,
            ) +
            `<div class="field-row">${number("局部 X", "pin.local.0", pin.local[0])}${number("局部 Y", "pin.local.1", pin.local[1])}${number("局部 Z", "pin.local.2", pin.local[2], 0.01)}</div>`,
        ) +
        button("图钉钉入动画", "entrance", "play", "wide-button") +
        button("从这里连接", "rope", "rope", "primary wide-button") +
        button("删除图钉", "delete", "trash", "wide-button");
    } else if (mark) {
      html =
        heading("ANNOTATION", "手绘标注") +
        section(
          "笔迹",
          color("墨迹颜色", "mark.color", mark.color) +
            select("画笔种类", "mark.brush", mark.brush ?? "ink", brushes) +
            range("笔画粗细", "mark.radius", mark.radius, 0.002, 0.04, 0.001) +
            button("逐笔绘制动画", "mark-animate", "play", "wide-button"),
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
      `<div class="look-presets">${looks.map((look, i) => `<button data-look="${i}">${look.name}</button>`).join("")}</div>`;
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
        button("添加一盏追光灯", "add-light", "plus", "wide-button") +
        button("添加窗外日光", "sunlight", "light", "wide-button"),
    );
    if (l)
      html += section(
        "当前追光",
        text("灯光名称", "light.name", l.name) +
          select("投影片 / 窗光", "light.gobo", l.gobo ?? "none", gobos) +
          range(
            "窗影旋转",
            "light.goboRotation",
            l.goboRotation ?? 0,
            -90,
            90,
            1,
            "°",
          ) +
          range("窗影尺度", "light.goboScale", l.goboScale ?? 1, 0.5, 2, 0.01) +
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
          range(
            "板材纹理密度",
            "settings.boardTextureScale",
            s.boardTextureScale,
            0.5,
            6,
            0.1,
          ) +
          range("板宽", "settings.boardWidth", s.boardWidth, 4, 60, 0.1) +
          range("板高", "settings.boardHeight", s.boardHeight, 4, 40, 0.1) +
          check("实体边框", "settings.frame", s.frame) +
          range(
            "边框宽度",
            "settings.frameWidth",
            s.frameWidth,
            0.05,
            1,
            0.01,
          ) +
          color("边框颜色", "settings.frameColor", s.frameColor) +
          button("边框适配现有布局", "board-fit", "focus", "wide-button") +
          button("整板取景", "board-view", "camera", "wide-button") +
          check("反转环视方向", "settings.orbitReverse", s.orbitReverse) +
          check("显示网格", "settings.grid", s.grid),
      );
    html += section(
      "镜头与成像",
      range("曝光", "settings.exposure", s.exposure, 0.25, 2, 0.01) +
        range("景深强度", "settings.dof", s.dof, 0, 1, 0.01) +
        range("焦点偏移", "settings.focusOffset", s.focusOffset, -8, 8, 0.05) +
        range(
          "预览分辨率倍率",
          "settings.renderScale",
          s.renderScale,
          0.5,
          2,
          0.05,
        ) +
        range("胶片颗粒", "settings.grain", s.grain, 0, 0.025, 0.001) +
        select("预览质量", "settings.quality", s.quality, [
          ["draft", "快速 / 1024 阴影 / 无景深"],
          ["studio", "影棚 / 4× MSAA / 2048 阴影"],
          ["ultra", "精细 / 最高 MSAA / 4096 阴影"],
        ]) +
        `<p class="helper">真实 GPU 渲染，无软件光影替身。输出沿用当前质量档。</p>`,
    );
    html += section(
      "全局字体",
      select(
        "全局文字字体",
        "settings.font",
        s.font,
        app.fonts.map((f) => [f, f]),
      ) +
        text("字体名称（可直接输入）", "settings.font", s.font) +
        range(
          "全局文字大小",
          "settings.fontScale",
          s.fontScale,
          0.4,
          2.5,
          0.05,
        ) +
        button("读取本机字体", "fonts", "file", "wide-button") +
        button("导入本机字体清单", "font-list", "folder", "wide-button") +
        button("全部跟随此字体", "fonts-unify", "group", "wide-button") +
        '<p class="helper">物件可单独覆盖。跨机器需安装相同字体；字体名称随工程保存，不嵌入字体文件。</p>',
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
      "入场 / 退场与逐笔轨道",
      `<div class="helper">选物件后加入轨道。默认淡化，画外位置按当前镜头与输出画幅计算；局部动作仍可选择近处或原位。</div><div class="button-grid">${button("加入选中物入场", "action", "plus")}${button("加入选中物退场", "action-out", "plus")}${button("加入选中追光", "cue", "light")}</div>` +
        shot.actions
          .map(
            (a) =>
              `<div class="track-row"><b>${esc(app.name(a.targetId))}</b>${select(
                "动作方式",
                `action.${a.id}.type`,
                a.type,
                animationOptions(p, a.targetId, a.type),
              )}${motionControls(a)}<div class="field-row">${number("开始", `action.${a.id}.start`, a.start)}${number("时长", `action.${a.id}.duration`, a.duration)}${number("强度", `action.${a.id}.strength`, a.strength)}</div><button data-remove-action="${a.id}">移除轨道</button></div>`,
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
  if (app.panel === "object" && app.tool === "mark")
    html =
      section(
        "画笔工作台",
        select("画笔", "brush.type", app.brush.type, brushes) +
          range(
            "新笔迹粗细",
            "brush.radius",
            app.brush.radius,
            0.002,
            0.04,
            0.001,
          ) +
          color("新笔迹颜色", "brush.color", app.brush.color) +
          '<p class="helper">选中纸张可添加预设，或在纸面拖动自由书写。</p><div class="button-grid">' +
          button("画圈", "mark-circle") +
          button("划线", "mark-underline") +
          button("箭头", "mark-arrow") +
          button("波浪线", "mark-wave") +
          "</div>",
      ) + html;
  return html;
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
    curvePreview(a) +
    (a.ease === "custom"
      ? `<div class="field-row">${range("起点控制 X", `${bind}.bezier.0`, c[0], 0, 1, 0.01)}${range("起点控制 Y", `${bind}.bezier.1`, c[1], 0, 1, 0.01)}</div><div class="field-row">${range("终点控制 X", `${bind}.bezier.2`, c[2], 0, 1, 0.01)}${range("终点控制 Y", `${bind}.bezier.3`, c[3], 0, 1, 0.01)}</div>`
      : "") +
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
