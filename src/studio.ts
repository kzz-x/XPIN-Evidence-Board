import "./v4.css";
import { compileScene } from "./compose";
import {
  upgrade,
  fonts,
  applyCinemaLook,
  animationOptions,
  annotation,
  sunlight,
  boardFit,
  boardPose,
  type Brush,
} from "./cinema";
import { LiveRecorder } from "./record";
import * as T from "three";
import { BoardRenderer } from "./renderer";
import { Store, autosave, download, fileData } from "./store";
import {
  modules,
  categories,
  makeItem,
  moduleByKind,
  demoProject,
} from "./modules";
import {
  uid,
  clone,
  emptyProject,
  makeLight,
  makeShot,
  poseFor,
  worldToLocal,
  localToWorld,
  duplicateSelection,
  removeIds,
  ratio,
  clamp,
  type Project,
  type Mode,
  type Kind,
  type V3,
  type Item,
  type Preset,
} from "./model";
import { duration, evaluate } from "./story";
import { actionCurve, curvePreview } from "./motion";
import { importProject } from "./migrate";
import { icon, button, esc } from "./ui";
import { disposeTree } from "./geometry";
import { inspector } from "./inspector";
import { recordVideo } from "./encode";
type Tool =
  | "select"
  | "rotate"
  | "scale"
  | "pin"
  | "rope"
  | "mark"
  | "light"
  | "target";
interface Drag {
  kind:
    | "move"
    | "rotate"
    | "scale"
    | "orbit"
    | "pan"
    | "box"
    | "mark"
    | "target"
    | "light";
  x: number;
  y: number;
  point: V3;
  originals: Map<string, Item>;
  pose: Project["camera"];
  hostId?: string;
  lightId?: string;
  points?: V3[];
  lightPosition?: V3;
}
export class Studio {
  store: Store;
  view: BoardRenderer;
  ready: Promise<void>;
  mode: Mode = "build";
  tool: Tool = "select";
  selection: string[] = [];
  selectedShot?: string;
  panel = "object";
  category = "全部";
  query = "";
  favoriteOnly = false;
  time = 0;
  playing = false;
  playEpoch = 0;
  space = false;
  drag?: Drag;
  ropeStart?: string;
  draft?: T.Line;
  fps = 0;
  frames = 0;
  busy = false;
  fonts = [...fonts];
  brush = { type: "ink" as Brush, radius: 0.008, color: "#a8212a" };
  liveRecording = false;
  recorder?: LiveRecorder;
  private inspectorDetails = new Map<string, boolean>();
  private displayedPanel = "";
  private savedTimer = 0;
  private toastTimer = 0;
  private audio?: HTMLAudioElement;
  private lastFps = performance.now();
  private syncing = false;
  constructor(
    public root: HTMLElement,
    p: Project,
  ) {
    p = upgrade(p);
    this.store = new Store(p);
    try {
      const catalog = JSON.parse(
        document.getElementById("xpin-local-fonts")?.textContent ?? "null",
      );
      if (catalog?.format === "xpin-fonts/1" && Array.isArray(catalog.families))
        this.fonts = [
          ...new Set([
            ...this.fonts,
            ...catalog.families.filter((f: unknown) => typeof f === "string"),
          ]),
        ];
    } catch {}
    this.shell();
    this.root.insertAdjacentHTML(
      "beforeend",
      '<input type="file" id="font-file" accept=".json" hidden>',
    );
    this.el<HTMLInputElement>("#font-file").onchange = async (e) => {
      const input = e.target as HTMLInputElement,
        file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
        if (
          data.format !== "xpin-fonts/1" ||
          !Array.isArray(data.families) ||
          !data.families.every(
            (f: unknown) => typeof f === "string" && f.length < 200,
          )
        )
          throw Error("不是有效字体清单");
        this.fonts = [...new Set([...this.fonts, ...data.families])].sort();
        this.renderInspector();
        this.toast(`已导入 ${data.families.length} 种本机字体`);
      } catch (e) {
        this.toast(String(e));
      }
      input.value = "";
    };
    this.el(".top-actions").insertAdjacentHTML(
      "afterbegin",
      button("停止录制", "record-stop-top", "film"),
    );
    this.el(".export-options").insertAdjacentHTML(
      "beforeend",
      '<label class="field"><span>视频格式</span><select id="export-format"><option value="webm">WebM / VP9</option><option value="mp4">MP4 / H.264</option></select></label>',
    );
    this.el('[data-action="video"] span').textContent = "逐帧视频";
    this.el("#export-note").textContent =
      "使用固定时间戳逐帧编码，不依赖实时录屏速度。支持 MP4 / WebM。";
    this.recorder = new LiveRecorder(this);
    this.el(".export-options").insertAdjacentHTML(
      "beforeend",
      `<label class="field"><span>输出质量</span><select id="export-quality"><option value="preview">快速预览 / 1×</option><option value="studio" selected>影棚 / MSAA / 高码率</option><option value="master">精制 / 2× 超采样 / 最高码率</option></select></label>`,
    );
    this.el(".dialog-actions").insertAdjacentHTML(
      "afterend",
      `<div class="record-box"><h3>现场录制</h3><p>记录当前画面与手动运镜，包含已导入音轨。停止后下载 WebM。</p><div class="button-grid">${button("开始录制", "record-start", "film")}${button("停止并保存", "record-stop", "save")}</div><output id="record-status">未录制</output></div>`,
    );
    this.view = new BoardRenderer(this.el("#viewport"), p.camera);
    this.ready = this.view.sync(p);
    this.renderLibrary();
    this.renderInspector();
    this.renderTimeline();
    this.bind();
    this.store.subscribe(() => {
      this.syncing = true;
      void this.view.sync(this.p).then(() => (this.syncing = false));
      this.selection = this.selection.filter((id) => this.exists(id));
      this.view.selectionIds = this.selection;
      this.renderInspector();
      this.renderTimeline();
      this.renderLibrary();
      this.saveSoon();
      this.layoutViewport();
    });
    new ResizeObserver(() => this.layoutViewport()).observe(this.el("#stage"));
    this.el("#stage").addEventListener("render-error", (e) =>
      this.toast((e as CustomEvent).detail),
    );
    requestAnimationFrame(this.tick);
    Object.assign(window, {
      __XPIN: {
        studio: this,
        ready: this.ready,
        project: () => clone(this.p),
        compile: compileScene,
        evaluate: (t: number) => evaluate(this.p, t),
        audit: () => this.view.audit(),
        select: (ids: string[]) => this.select(ids),
        seek: (t: number) => this.seek(t),
        setMode: (m: Mode) => this.setMode(m),
        png: (w = 1920) => this.view.png(this.p, this.time, this.mode, w),
      },
    });
  }
  get p() {
    return this.store.project;
  }
  el<T extends HTMLElement = HTMLElement>(q: string) {
    return this.root.querySelector<T>(q)!;
  }
  exists(id: string) {
    return [
      ...this.p.items,
      ...this.p.pins,
      ...this.p.ropes,
      ...this.p.marks,
      ...this.p.lights,
    ].some((o) => o.id === id);
  }
  shell() {
    this.root.innerHTML = `<header class="topbar"><div class="brand"><span class="brand-icon">X<span>•</span></span><div><strong>XPIN <span>Evidence Board</span></strong><small>三维叙事工作台 <i>STUDIO / 04.1</i></small></div></div><nav class="modes" aria-label="工作模式">${["build", "director", "play"].map((m, i) => `<button data-mode="${m}" class="${!i ? "active" : ""}">${icon(["group", "camera", "play"][i])}${["搭建", "导演", "播放"][i]}</button>`).join("")}</nav><div class="project-title">${esc(this.p.name)}</div><div class="top-actions"><span id="saved" class="saved">本地工程</span>${button("撤销", "undo", "undo", "icon-button")}${button("重做", "redo", "redo", "icon-button")}${button("打开", "import", "folder")}${button("保存工程", "save", "save")}${button("输出", "output", "export", "primary")}</div></header>
 <div class="workspace"><aside class="library-panel"><div class="panel-heading"><small>YOUR TOOLKIT</small><div><h2>模块背包</h2><button data-action="favorites" class="icon-button" title="只看收藏">${icon("star")}</button></div><label class="search">${icon("search")}<input aria-label="搜索模块" id="search" placeholder="寻找下一条线索…"></label></div><div class="category-tabs" id="categories"></div><div id="library" class="library"></div><div class="library-bottom"><div class="eyebrow">创作起点</div>${button("午夜档案", "demo", "folder")}${button("空白调查板", "new", "plus")}<p>拖入模块，开始构建故事。<br>素材和工程保存在本机。</p></div></aside>
 <main id="stage" class="stage"><div id="viewport" class="viewport"></div><div id="loading">正在建立三维档案室…</div><div class="stage-caption"><span class="tiny-dot"></span><span>CASE 047 / THE MIDNIGHT ARCHIVE</span></div><div class="stage-top-right"><span id="render-status">真实三维 / WebGL2</span><button data-action="helpers" class="icon-button" title="显示或隐藏灯光辅助">${icon("light")}</button></div><div class="tools" aria-label="搭建工具">${(["select", "rotate", "scale", "pin", "rope", "mark", "light", "target"] as Tool[]).map((t, i) => `<button data-tool="${t}" title="${["移动 / V", "旋转 / R", "缩放 / E", "图钉 / P", "拉绳 / C", "手绘 / M", "添加追光 / L", "指定追光落点"][i]}" class="${!i ? "active" : ""}">${icon(t === "select" ? "move" : t === "target" ? "focus" : t)}</button>`).join("")}<hr>${button("全览", "fit", "grid", "icon-button")}${button("特写", "focus", "focus", "icon-button")}</div><div class="stage-bottom"><div id="hint" class="interaction-hint">拖动摆放 · 滚轮缩放 · Alt 拖动环视 · 空格平移</div><div class="view-pill"><button data-action="front">正视</button><button data-action="angle">斜视</button><span id="fps">—</span></div></div><div id="box-select" class="box-select" hidden></div><div id="drop-preview" class="drop-preview" hidden>释放以放置模块</div><div id="toast" class="toast" role="status"></div></main>
 <aside class="inspector-panel"><div class="inspector-tabs"><button data-panel="object" class="active">物件</button><button data-panel="light">布光</button><button data-panel="scene">场景</button><button data-panel="shot">镜头</button></div><div id="inspector"></div></aside></div>
 <footer class="timeline"><div class="timeline-head"><div><small>STORY SEQUENCE</small><b>故事编排</b></div><button data-action="play" class="play-button" id="play-button">${icon("play")}播放故事</button><button data-action="reset" class="icon-button" title="回到开始">↤</button><input id="scrub" type="range" min="0" max="20" step="0.001" value="0" aria-label="播放头"><span id="timecode">00:00.00 / 00:20</span>${button("加入镜头", "shot", "plus")}</div><div id="shots" class="shots"></div></footer>
 <dialog id="output-dialog"><div class="dialog-head"><div><small>DELIVER YOUR STORY</small><h2>输出作品</h2></div><button data-action="close-dialog" class="icon-button">${icon("close")}</button></div><p>与当前三维画面使用同一场景、灯光、景深和时间轴。输出隐藏编辑辅助。</p><div class="export-options"><label class="field"><span>分辨率</span><select id="export-size"><option value="1920">1080p / 长边 1920</option><option value="2560">1440p / 长边 2560</option><option value="3840">4K / 长边 3840</option></select></label><label class="field"><span>视频帧率</span><select id="export-fps"><option value="24">24 fps</option><option value="30">30 fps</option><option value="60">60 fps</option></select></label></div><div class="dialog-actions">${button("当前帧 PNG", "png", "photo", "primary")}${button("故事视频 WebM", "video", "film")}</div><progress id="export-progress" value="0" max="1" hidden></progress><p class="helper" id="export-note">VP9 / VP8 WebM。声音可在场景面板导入。工程 JSON 内嵌素材。</p></dialog><input type="file" id="project-file" accept=".json" hidden><input type="file" id="image-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden><input type="file" id="audio-file" accept="audio/*" hidden>`;
  }
  renderLibrary() {
    this.el("#categories").innerHTML = categories
      .map(
        (c) =>
          `<button data-category="${c}" class="${this.category === c ? "active" : ""}">${c}</button>`,
      )
      .join("");
    const list = modules.filter(
      (m) =>
        (this.category === "全部" || this.category === m.category) &&
        (!this.query ||
          m.name.includes(this.query) ||
          m.category.includes(this.query)) &&
        (!this.favoriteOnly || this.p.favorites.includes(m.kind)),
    );
    let html = list
      .map(
        (m) =>
          `<div class="module-card" draggable="true" data-module="${m.kind}" role="button" tabindex="0" aria-label="添加${m.name}"><button class="favorite ${this.p.favorites.includes(m.kind) ? "on" : ""}" data-favorite="${m.kind}" title="收藏">${icon("star")}</button><div class="module-preview mini-${m.kind}">${["photo", "polaroid", "film"].includes(m.kind) ? `<div class="mini-paper"><img src="${this.p.assets.bridge ?? ""}" alt=""><i></i></div>` : icon(m.icon)}</div><span>${m.name}</span><small>${m.category === "固定件" ? "ATTACH" : "PLACE"}</small></div>`,
      )
      .join("");
    for (const [category, tool, label, sub] of [
      ["关系连线", "rope", "编织红绳", "CONNECT"],
      ["标注强调", "mark", "自由手绘", "ANNOTATE"],
      ["沙盘环境", "light", "局部追光", "ILLUMINATE"],
    ])
      if (this.category === "全部" || this.category === category)
        html += `<div class="module-card" data-tool="${tool}" role="button" tabindex="0"><div class="module-preview mini-${tool}">${icon(tool)}</div><span>${label}</span><small>${sub}</small></div>`;
    if (this.category === "沙盘环境")
      html += ["cork", "felt", "wood", "grid"]
        .map(
          (v, i) =>
            `<div class="module-card" data-board="${v}" role="button" tabindex="0"><div class="swatch swatch-${v}"></div><span>${["软木", "黑纤维", "档案桌", "工业网格"][i]}</span></div>`,
        )
        .join("");
    if (this.category === "组合预设")
      html +=
        `<div class="module-card" data-action="composite" role="button" tabindex="0"><div class="module-preview">${icon("group")}</div><span>人物调查组</span><small>COMPOSE</small></div>` +
        this.p.presets
          .map(
            (p) =>
              `<div class="module-card" data-preset="${p.id}" role="button" tabindex="0"><div class="module-preview">${icon("group")}</div><span>${esc(p.name)}</span><small>${p.items.length} MODULES</small></div>`,
          )
          .join("");
    this.el("#library").innerHTML = html || '<p class="empty">没有找到模块</p>';
  }
  renderInspector() {
    this.fonts = [
      ...new Set([
        ...this.fonts,
        this.p.settings.font,
        ...this.p.items.map((o) => o.font ?? "").filter(Boolean),
      ]),
    ];
    for (const d of this.el("#inspector").querySelectorAll("details")) {
      this.inspectorDetails.set(
        this.displayedPanel + "/" + d.querySelector("summary")?.textContent,
        d.open,
      );
    }
    this.el("#inspector").innerHTML = inspector(this);
    this.displayedPanel = this.panel;
    for (const d of this.el("#inspector").querySelectorAll("details")) {
      const saved = this.inspectorDetails.get(
        this.panel + "/" + d.querySelector("summary")?.textContent,
      );
      if (saved !== undefined) d.open = saved;
    }
    this.root
      .querySelectorAll("[data-panel]")
      .forEach((e) =>
        e.classList.toggle(
          "active",
          (e as HTMLElement).dataset.panel === this.panel,
        ),
      );
    this.el(".project-title").textContent = this.p.name;
  }
  name(id: string) {
    return (
      this.p.items.find((o) => o.id === id)?.title ??
      this.p.lights.find((l) => l.id === id)?.name ??
      (this.p.ropes.some((r) => r.id === id)
        ? "红绳关系"
        : this.p.pins.some((p) => p.id === id)
          ? "图钉"
          : "手绘标注")
    );
  }
  renderTimeline() {
    this.el<HTMLInputElement>("#scrub").max = String(duration(this.p));
    this.el("#shots").innerHTML =
      this.p.shots
        .map(
          (s, i) =>
            `<article class="shot-card ${s.id === this.selectedShot ? "selected" : ""}" draggable="true" data-shot="${s.id}"><div class="shot-top"><span>${String(i + 1).padStart(2, "0")}</span><small>${s.duration.toFixed(1)} SEC</small></div><b>${esc(s.title)}</b><div class="shot-tracks"><span>${icon("camera")}${{ focus: "证据特写", push: "缓慢推近", pan: "横移探索", rope: "沿绳跟踪", overview: "全局揭示" }[s.motion]}</span>${s.cues.length ? `<span class="lit">${icon("light")}${s.cues.length} 追光</span>` : ""}${s.actions.length ? `<span>${s.actions.length} 出场</span>` : ""}</div></article>`,
        )
        .join("") +
      `<button class="shot-add" data-action="shot">${icon("plus")}<span>添加故事镜头</span></button>`;
    this.updateTime();
  }
  bind() {
    this.root.addEventListener("click", (e) => this.click(e));
    this.root.addEventListener("change", (e) => {
      const input = e.target as HTMLInputElement;
      if (input.dataset.bind) {
        this.store.begin();
        this.applyBinding(input);
        this.store.commit();
      }
    });
    this.root.addEventListener("input", (e) => {
      const input = e.target as HTMLInputElement;
      if (input.type === "range" && input.dataset.bind) {
        this.store.begin();
        this.applyBinding(input);
        const output = input.closest(".field")?.querySelector("output");
        if (output) output.textContent = input.value;
        input
          .closest(".field")
          ?.querySelectorAll<HTMLInputElement>("input[data-bind]")
          .forEach((el) => {
            if (el !== input) el.value = input.value;
          });
        this.view.reconcile(this.p);
      }
    });
    this.el<HTMLInputElement>("#search").oninput = (e) => {
      this.query = (e.target as HTMLInputElement).value;
      this.renderLibrary();
    };
    this.el<HTMLInputElement>("#scrub").oninput = (e) =>
      this.seek(Number((e.target as HTMLInputElement).value));
    this.el<HTMLInputElement>("#project-file").onchange = async (e) => {
      const input = e.target as HTMLInputElement,
        file = input.files?.[0];
      if (!file) return;
      try {
        const document = JSON.parse(await file.text());
        const p =
          document.format === "xpin-scene/1"
            ? compileScene(document)
            : importProject(document);
        this.stop();
        this.time = 0;
        this.selection = [];
        this.store.replace(upgrade(p));
        this.view.pose = clone(p.camera);
        this.toast("工程与内嵌素材已恢复");
      } catch (e) {
        this.toast(String(e));
      }
      input.value = "";
    };
    this.el<HTMLInputElement>("#image-file").onchange = async (e) => {
      const input = e.target as HTMLInputElement,
        file = input.files?.[0],
        id = this.selection[0];
      if (!file || !id) return;
      try {
        const data = await fileData(file),
          im = new Image();
        im.src = data;
        await im.decode();
        this.store.edit((p) => {
          const o = p.items.find((o) => o.id === id);
          if (o) {
            const aid = uid("asset");
            p.assets[aid] = data;
            o.assetId = aid;
          }
        });
        this.toast("照片已替换，素材内嵌工程");
      } catch {
        this.toast("无法解码该影像");
      }
      input.value = "";
    };
    this.el<HTMLInputElement>("#audio-file").onchange = async (e) => {
      const input = e.target as HTMLInputElement,
        f = input.files?.[0];
      if (f) {
        const data = await fileData(f);
        this.store.edit((p) => (p.audio = data));
        this.audio = new Audio(data);
        this.toast("声音已加入工程");
      }
      input.value = "";
    };
    this.root.addEventListener("dragstart", (e) => {
      const mod = (e.target as HTMLElement).closest<HTMLElement>(
          "[data-module]",
        ),
        shot = (e.target as HTMLElement).closest<HTMLElement>("[data-shot]");
      if (mod)
        e.dataTransfer?.setData(
          "application/x-xpin-module",
          mod.dataset.module!,
        );
      if (shot)
        e.dataTransfer?.setData("application/x-xpin-shot", shot.dataset.shot!);
    });
    this.el("#stage").addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("application/x-xpin-module")) {
        e.preventDefault();
        const g = this.el("#drop-preview"),
          r = this.el("#stage").getBoundingClientRect();
        g.hidden = false;
        g.style.left = e.clientX - r.left + "px";
        g.style.top = e.clientY - r.top + "px";
      }
    });
    this.el("#stage").addEventListener(
      "dragleave",
      () => (this.el("#drop-preview").hidden = true),
    );
    this.el("#stage").addEventListener("drop", (e) => {
      e.preventDefault();
      this.el("#drop-preview").hidden = true;
      const k = e.dataTransfer?.getData("application/x-xpin-module");
      if (k)
        this.add(
          k as Kind,
          this.view.boardPoint(e.clientX, e.clientY) ?? [0, 0, 0.06],
        );
    });
    this.el("#shots").addEventListener("dragover", (e) => e.preventDefault());
    this.el("#shots").addEventListener("drop", (e) => {
      e.preventDefault();
      const from = e.dataTransfer?.getData("application/x-xpin-shot"),
        to = (e.target as HTMLElement).closest<HTMLElement>("[data-shot]")
          ?.dataset.shot;
      if (from && to && from !== to)
        this.store.edit((p) => {
          const i = p.shots.findIndex((s) => s.id === from),
            j = p.shots.findIndex((s) => s.id === to),
            [s] = p.shots.splice(i, 1);
          p.shots.splice(j, 0, s);
        });
    });
    const c = this.view.renderer.domElement;
    c.oncontextmenu = (e) => e.preventDefault();
    c.onpointerdown = (e) => this.down(e);
    c.onpointermove = (e) => this.move(e);
    c.onpointerup = (e) => this.up(e);
    c.onpointercancel = (e) => this.up(e);
    c.ondblclick = (e) => {
      const h = this.view.pick(e.clientX, e.clientY);
      if (h) {
        this.select([h.id]);
        void this.action("focus");
      }
    };
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.mode !== "build") return;
        const before = this.view.boardPoint(e.clientX, e.clientY, 0);
        this.view.pose.distance = clamp(
          this.view.pose.distance * Math.exp(e.deltaY * 0.001),
          2,
          95,
        );
        this.view.cameraPose(this.view.pose);
        const after = this.view.boardPoint(e.clientX, e.clientY, 0);
        if (before && after) {
          this.view.pose.target[0] += before[0] - after[0];
          this.view.pose.target[1] += before[1] - after[1];
        }
      },
      { passive: false },
    );
    document.addEventListener("keydown", (e) => {
      if (
        (e.target as HTMLElement).matches("input,textarea,select") ||
        this.el<HTMLDialogElement>("#output-dialog").open
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        this.space = true;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.shiftKey ? this.store.redo() : this.store.undo();
        }
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          void this.action("save");
        }
        if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          void this.action("duplicate");
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace")
        void this.action("delete");
      const tools: Record<string, Tool> = {
        v: "select",
        r: "rotate",
        e: "scale",
        p: "pin",
        c: "rope",
        m: "mark",
        l: "light",
      };
      if (tools[e.key.toLowerCase()]) this.setTool(tools[e.key.toLowerCase()]);
      if (e.key === "Escape") {
        this.stop();
        this.setMode("build");
        this.setTool("select");
        this.select([]);
      }
      if (e.key === "Enter") this.togglePlay();
    });
    document.addEventListener("keyup", (e) => {
      if (e.code === "Space") this.space = false;
    });
    this.root.addEventListener("keydown", (e) => {
      if (
        e.key === "Enter" &&
        (e.target as HTMLElement).matches(".module-card")
      )
        (e.target as HTMLElement).click();
    });
  }
  click(e: MouseEvent) {
    const t = e.target as HTMLElement,
      data = (key: string) =>
        t.closest<HTMLElement>(`${key === "mode" ? "button" : ""}[data-${key}]`)
          ?.dataset[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    const mode = data("mode");
    if (mode) {
      this.setMode(mode as Mode);
      return;
    }
    const tool = data("tool");
    if (tool) {
      this.setTool(tool as Tool);
      return;
    }
    const panel = data("panel");
    if (panel) {
      this.panel = panel;
      this.renderInspector();
      return;
    }
    const cat = data("category");
    if (cat) {
      this.category = cat;
      this.renderLibrary();
      return;
    }
    const fav = data("favorite");
    if (fav) {
      this.store.edit(
        (p) =>
          (p.favorites = p.favorites.includes(fav)
            ? p.favorites.filter((v) => v !== fav)
            : [...p.favorites, fav]),
      );
      return;
    }
    const k = data("module");
    if (k) {
      this.add(k as Kind, this.view.pose.target);
      return;
    }
    const id = data("select");
    if (id) {
      this.select([id]);
      return;
    }
    const preset = data("preset");
    if (preset) {
      this.placePreset(preset);
      return;
    }
    const board = data("board");
    if (board) {
      this.store.edit(
        (p) => (p.settings.board = board as Project["settings"]["board"]),
      );
      return;
    }
    const shot = data("shot");
    if (shot) {
      this.selectedShot = shot;
      this.panel = "shot";
      this.setMode("director");
      this.seek(
        this.shotStart(shot) +
          this.p.shots.find((s) => s.id === shot)!.duration * 0.7,
      );
      this.renderInspector();
      this.renderTimeline();
      return;
    }
    const look = data("look");
    if (look !== undefined) {
      this.applyLook(Number(look));
      return;
    }
    for (const key of ["remove-action", "remove-cue"]) {
      const id = data(key);
      if (id) {
        this.store.edit((p) => {
          const s = p.shots.find((s) => s.id === this.selectedShot)!;
          if (key === "remove-action")
            s.actions = s.actions.filter((a) => a.id !== id);
          else s.cues = s.cues.filter((c) => c.id !== id);
        });
        return;
      }
    }
    const action = data("action");
    if (action) void this.action(action);
  }
  select(ids: string[]) {
    this.selection = ids;
    this.view.selectionIds = ids;
    this.view.updateSelection(this.p);
    this.view.updateGizmos(this.p);
    if (ids.some((id) => this.p.lights.some((l) => l.id === id)))
      this.panel = "light";
    else if (this.panel !== "shot") this.panel = "object";
    this.renderInspector();
  }
  setTool(tool: Tool) {
    if (this.mode !== "build") this.setMode("build");
    this.tool = tool;
    if (tool !== "rope") this.ropeStart = undefined;
    this.root
      .querySelectorAll("[data-tool]")
      .forEach((b) =>
        b.classList.toggle("active", (b as HTMLElement).dataset.tool === tool),
      );
    this.el("#hint").textContent = {
      select: "拖动摆放 · Shift 多选 / 框选 · Alt 环视 · 空格平移",
      rotate: "拖动物件旋转，图钉和标注跟随宿主。",
      scale: "拖动物件缩放，组合以中心同步变换。",
      pin: "点击相纸、文件或空白板，钉下一枚图钉。",
      rope: "依次点击两个图钉，拉出真实编织红绳。",
      mark: "按住拖动，画出绑定宿主的墨迹。",
      light: "点击沙盘放置一盏局部追光灯。",
      target: "拖动光斑落点；点击物件会建立跟随绑定。",
    }[tool];
    if (tool === "mark") {
      this.panel = "object";
      this.renderInspector();
    }
  }
  setMode(mode: Mode) {
    this.stop();
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.root
      .querySelectorAll("[data-mode]")
      .forEach((b) =>
        b.classList.toggle("active", (b as HTMLElement).dataset.mode === mode),
      );
    if (mode === "director") {
      this.panel = "shot";
      this.renderInspector();
    }
    this.layoutViewport();
    this.view.mode = mode;
  }
  layoutViewport() {
    const v = this.el("#viewport"),
      s = this.el("#stage");
    if (this.mode === "build" && !this.liveRecording) {
      v.style.width = "100%";
      v.style.height = "100%";
    } else {
      const a = ratio(this.p.settings.aspect),
        w = Math.max(1, s.clientWidth - 36),
        h = Math.max(1, s.clientHeight - 60),
        width = Math.min(w, h * a);
      v.style.width = width + "px";
      v.style.height = width / a + "px";
    }
    this.view?.resize();
  }
  add(kind: Kind, pos: V3) {
    this.setMode("build");
    if (kind === "pin") {
      this.setTool("pin");
      return;
    }
    let id = "";
    this.store.edit((p) => {
      const o = makeItem(kind, [pos[0], pos[1], 0.06 + p.items.length * 0.003]);
      if (["photo", "polaroid", "film", "profile"].includes(kind))
        o.assetId = Object.keys(p.assets)[0];
      p.items.push(o);
      id = o.id;
    });
    this.select([id]);
    this.toast("已添加" + moduleByKind(kind).name);
  }
  addPin(point: V3, hostId?: string) {
    let id = "";
    this.store.edit((p) => {
      const host = p.items.find((o) => o.id === hostId),
        local = host ? worldToLocal(host, point) : clone(point);
      local[2] = 0.025;
      const pin = { id: uid("pin"), hostId, local, color: "#a52027" };
      id = pin.id;
      p.pins.push(pin);
    });
    this.select([id]);
  }
  async action(action: string) {
    if (
      this.liveRecording &&
      ["video", "png", "new", "demo", "import"].includes(action)
    ) {
      this.toast("先停止录制并保存，再执行此操作。");
      return;
    }
    if (action === "board-view") {
      this.setMode("build");
      this.view.pose = boardPose(this.p);
      return;
    }
    if (action === "font-list") {
      this.el<HTMLInputElement>("#font-file").click();
      return;
    }
    if (action === "record-start") {
      await this.recorder!.start();
      return;
    }
    if (action === "record-stop" || action === "record-stop-top") {
      await this.recorder!.stop();
      return;
    }
    if (action === "sunlight") {
      const l = sunlight();
      this.store.edit((p) => p.lights.push(l));
      this.select([l.id]);
      return;
    }
    if (action === "board-fit") {
      this.store.edit((p) => boardFit(p));
      return;
    }
    if (action === "entrance") {
      const id = this.selection[0];
      if (!id) return;
      let shot =
        this.p.shots.find((s) => s.id === this.selectedShot) ?? this.p.shots[0];
      this.store.edit((p) => {
        if (!shot) {
          shot = makeShot(p, [id]);
          p.shots.push(shot);
        }
        shot.actions.push({
          id: uid("action"),
          targetId: id,
          type:
            p.items.find((o) => o.id === id)?.entrance ??
            animationOptions(p, id)[0][0],
          start: 0.1,
          duration: 1.1,
          strength: 1,
        });
        this.selectedShot = shot.id;
      });
      this.panel = "shot";
      this.renderInspector();
      this.toast("部件专属动画已加入镜头");
      return;
    }
    if (action === "fonts") {
      try {
        const query = (
          window as unknown as {
            queryLocalFonts?: () => Promise<{ family: string }[]>;
          }
        ).queryLocalFonts;
        if (!query)
          throw Error("当前浏览器不支持读取字体，可手动填写已安装字体名称。");
        const result = await Promise.race([
          query.call(window),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  Error(
                    "字体读取超时；可导入本机字体清单，或直接输入字体名称。",
                  ),
                ),
              30000,
            ),
          ),
        ]);
        if (!result.length) {
          this.toast("浏览器未返回本机字体列表；可直接输入已安装字体名称。");
          return;
        }
        this.fonts = [
          ...new Set([...this.fonts, ...result.map((f) => f.family)]),
        ].sort();
        this.renderInspector();
        this.toast(`已读取 ${this.fonts.length} 种字体`);
      } catch (e) {
        this.toast(String(e));
      }
      return;
    }
    if (action === "fonts-unify") {
      this.store.edit((p) =>
        p.items.forEach((o) => {
          delete o.font;
          delete o.fontScale;
        }),
      );
      return;
    }
    if (action.startsWith("mark-") && action !== "mark-animate") {
      const host = this.p.items.find((o) => o.id === this.selection[0]);
      if (!host) {
        this.toast("先选中一张纸或相片");
        return;
      }
      const m = annotation(
        host,
        action.slice(5),
        this.brush.type,
        this.brush.radius,
        this.brush.color,
      );
      this.store.edit((p) => p.marks.push(m));
      this.select([m.id]);
      return;
    }
    if (action === "mark-animate") {
      const id = this.selection[0];
      if (!id) return;
      let shot = this.p.shots.find((s) => s.id === this.selectedShot);
      this.store.edit((p) => {
        if (!shot) {
          shot = makeShot(p, [], "overview");
          p.shots.push(shot);
          this.selectedShot = shot.id;
        }
        shot.actions.push({
          id: uid("action"),
          targetId: id,
          type: "draw",
          start: 0.2,
          duration: 1.3,
          strength: 1,
        });
      });
      this.panel = "shot";
      this.renderInspector();
      return;
    }

    if (action === "undo") {
      this.store.undo();
      return;
    }
    if (action === "redo") {
      this.store.redo();
      return;
    }
    if (action === "favorites") {
      this.favoriteOnly = !this.favoriteOnly;
      this.renderLibrary();
      return;
    }
    if (["pin", "rope", "target"].includes(action)) {
      this.setTool(action as Tool);
      if (
        action === "rope" &&
        this.p.pins.some((p) => p.id === this.selection[0])
      )
        this.ropeStart = this.selection[0];
      return;
    }
    if (action === "play") {
      this.togglePlay();
      return;
    }
    if (action === "reset") {
      this.stop();
      this.time = 0;
      this.updateTime();
      return;
    }
    if (action === "fit") {
      this.view.pose = poseFor(this.p, [], "overview");
      this.setMode("build");
      return;
    }
    if (action === "front" || action === "angle") {
      this.setMode("build");
      this.view.pose.yaw = action === "front" ? 0 : 0.6;
      this.view.pose.pitch = action === "front" ? 0 : -0.35;
      return;
    }
    if (action === "focus") {
      this.setMode("build");
      this.view.pose = poseFor(this.p, this.selection, "focus");
      return;
    }
    if (action === "helpers") {
      this.view.gizmoLight =
        this.view.gizmoLight === "hidden" ? undefined : "hidden";
      return;
    }
    if (action === "new" || action === "demo") {
      this.stop();
      this.time = 0;
      this.selection = [];
      this.store.replace(action === "demo" ? demoProject() : emptyProject());
      this.view.pose = clone(this.p.camera);
      this.select([]);
      this.setMode("build");
      this.toast("新场景已载入，可撤销返回之前的工程");
      return;
    }
    if (action === "save") {
      const p = clone(this.p);
      p.camera = clone(this.view.pose);
      download(
        new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }),
        `XPIN-${p.name.replace(/[\\/:*?"<>|]/g, "-")}.json`,
      );
      this.toast("已保存可编辑工程，素材完整内嵌");
      return;
    }
    if (action === "import") {
      this.el<HTMLInputElement>("#project-file").click();
      return;
    }
    if (action === "image") {
      this.el<HTMLInputElement>("#image-file").click();
      return;
    }
    if (action === "audio") {
      this.el<HTMLInputElement>("#audio-file").click();
      return;
    }
    if (action === "audio-remove") {
      this.store.edit((p) => delete p.audio);
      this.audio?.pause();
      this.audio = undefined;
      return;
    }
    if (action === "output") {
      this.el<HTMLDialogElement>("#output-dialog").showModal();
      return;
    }
    if (action === "close-dialog") {
      if (!this.busy) this.el<HTMLDialogElement>("#output-dialog").close();
      return;
    }
    if (action === "video") {
      await recordVideo(this);
      return;
    }
    if (action === "png") {
      if (this.busy) return;
      this.busy = true;
      this.stop();
      this.toast("正在渲染当前帧…");
      try {
        const long = Number(this.el<HTMLSelectElement>("#export-size").value),
          a = ratio(this.p.settings.aspect);
        download(
          await this.view.png(
            this.p,
            this.time,
            this.mode,
            a < 1 ? Math.round(long * a) : long,
            this.el<HTMLSelectElement>("#export-quality").value === "master"
              ? 2
              : 1,
            this.el<HTMLSelectElement>("#export-quality").value === "master"
              ? "ultra"
              : this.el<HTMLSelectElement>("#export-quality").value ===
                  "preview"
                ? "draft"
                : "studio",
          ),
          `XPIN-${this.time.toFixed(2)}s.png`,
        );
        this.toast("PNG 已输出，不含编辑辅助");
      } catch (e) {
        this.toast(String(e));
      } finally {
        this.busy = false;
      }
      return;
    }
    if (action === "add-light") {
      this.setMode("build");
      const l = makeLight([
        this.view.pose.target[0] - 2,
        this.view.pose.target[1] + 3,
        7,
      ]);
      l.target = clone(this.view.pose.target);
      this.store.edit((p) => p.lights.push(l));
      this.select([l.id]);
      return;
    }
    if (action === "light-copy") {
      const l = this.p.lights.find((l) => l.id === this.selection[0]);
      if (l) {
        const n = clone(l);
        n.id = uid("light");
        n.name += " / 副本";
        n.presetManaged = false;
        n.position[0] += 0.4;
        this.store.edit((p) => p.lights.push(n));
        this.select([n.id]);
      }
      return;
    }
    if (action === "light-reset") {
      this.store.edit((p) => {
        const i = p.lights.findIndex((l) => l.id === this.selection[0]);
        if (i >= 0) {
          const l = makeLight();
          l.id = p.lights[i].id;
          p.lights[i] = l;
        }
      });
      return;
    }
    if (action === "duplicate") {
      this.store.edit(
        (p) => (this.selection = duplicateSelection(p, this.selection)),
      );
      this.select(this.selection);
      return;
    }
    if (action === "delete") {
      this.store.edit((p) => removeIds(p, this.selection));
      this.select([]);
      return;
    }
    if (action === "group") {
      const chosen = this.p.items.filter((o) => this.selection.includes(o.id)),
        grouped = chosen.some((o) => o.groupId);
      this.store.edit(() => {
        const id = uid("group");
        chosen.forEach((o) => (o.groupId = grouped ? undefined : id));
      });
      this.toast(grouped ? "组合已拆开" : "组合已建立，拖动时整体跟随");
      return;
    }
    if (action === "raise" || action === "lower") {
      this.store.edit((p) =>
        p.items
          .filter((o) => this.selection.includes(o.id))
          .forEach(
            (o) =>
              (o.position[2] = Math.max(
                0.025,
                o.position[2] + (action === "raise" ? 0.025 : -0.025),
              )),
          ),
      );
      return;
    }
    if (action === "align-x" || action === "align-y") {
      const items = this.p.items.filter((o) => this.selection.includes(o.id));
      if (items.length) {
        const axis = action === "align-x" ? 1 : 0,
          avg = items.reduce((v, o) => v + o.position[axis], 0) / items.length;
        this.store.edit(() => items.forEach((o) => (o.position[axis] = avg)));
      }
      return;
    }
    if (action === "preset") {
      this.savePreset();
      return;
    }
    if (action === "composite") {
      this.composite();
      return;
    }
    if (action === "shot" || action === "rope-shot") {
      const s = makeShot(
        this.p,
        this.selection.filter((id) => this.p.items.some((o) => o.id === id)),
        action === "rope-shot"
          ? "rope"
          : this.selection.length
            ? "focus"
            : "overview",
      );
      if (action === "rope-shot") {
        s.ropeId = this.selection[0];
        s.camera.distance = 6;
        s.camera.focal = 55;
      }
      this.store.edit((p) => p.shots.push(s));
      this.selectedShot = s.id;
      this.panel = "shot";
      this.renderInspector();
      this.renderTimeline();
      this.toast("镜头已加入故事");
      return;
    }
    const shot =
      this.p.shots.find((s) => s.id === this.selectedShot) ?? this.p.shots[0];
    if (!shot) return;
    if (action === "capture-camera") {
      this.store.edit(() => {
        shot.camera = clone(this.view.pose);
        shot.manualCamera = true;
      });
      return;
    }
    if (action === "reframe") {
      this.store.edit(() => {
        shot.camera = poseFor(this.p, shot.targetIds, shot.motion);
        shot.manualCamera = false;
      });
      return;
    }
    if (action === "shot-left" || action === "shot-right") {
      this.store.edit((p) => {
        const i = p.shots.indexOf(shot),
          j = clamp(
            i + (action === "shot-left" ? -1 : 1),
            0,
            p.shots.length - 1,
          );
        p.shots.splice(i, 1);
        p.shots.splice(j, 0, shot);
      });
      return;
    }
    if (action === "shot-delete") {
      this.store.edit(
        (p) => (p.shots = p.shots.filter((s) => s.id !== shot.id)),
      );
      this.selectedShot = this.p.shots[0]?.id;
      this.renderInspector();
      return;
    }
    if (action === "shot-copy") {
      const s = clone(shot);
      s.id = uid("shot");
      s.title += " / 副本";
      s.actions.forEach((a) => (a.id = uid("action")));
      s.cues.forEach((c) => (c.id = uid("cue")));
      this.store.edit((p) => p.shots.push(s));
      return;
    }
    if (action === "action" || action === "action-out") {
      const id = this.selection[0];
      if (!id) {
        this.toast("先选择物件、图钉、红绳或标注");
        return;
      }
      const type = this.p.ropes.some((r) => r.id === id)
        ? "grow"
        : this.p.marks.some((m) => m.id === id)
          ? "draw"
          : animationOptions(this.p, id)[0][0];
      this.store.edit(() =>
        shot.actions.push({
          id: uid("action"),
          targetId: id,
          type,
          phase: action === "action-out" ? "out" : "in",
          start:
            action === "action-out" ? Math.max(0, shot.duration - 1.5) : 0.3,
          duration: 1.2,
          strength: 1,
        }),
      );
      return;
    }
    if (action === "cue") {
      const l =
        this.p.lights.find((l) => l.id === this.selection[0]) ??
        this.p.lights[0];
      if (!l) {
        this.toast("先添加追光灯");
        return;
      }
      let from = clone(l.target);
      const host = this.p.items.find((o) => o.id === l.hostId);
      if (host) from = localToWorld(host, l.local);
      this.store.edit(() =>
        shot.cues.push({
          id: uid("cue"),
          lightId: l.id,
          start: 0,
          duration: Math.min(3, shot.duration),
          targetId: shot.targetIds[0],
          from,
          to: clone(shot.camera.target),
          fromIntensity: l.intensity,
          toIntensity: l.intensity,
          fromAngle: l.angle,
          toAngle: l.angle,
          ease: "smooth",
        }),
      );
      this.panel = "shot";
      this.renderInspector();
      this.toast("已记录独立追光 Cue");
    }
  }
  shotStart(id: string) {
    let t = 0;
    for (const s of this.p.shots) {
      if (s.id === id) return t;
      t += s.duration;
    }
    return 0;
  }
  applyBinding(input: HTMLInputElement) {
    const parts = input.dataset.bind!.split("."),
      type = parts.shift()!;
    let target: any;
    const id = this.selection[0];
    const collections: Record<string, any[]> = {
      item: this.p.items,
      rope: this.p.ropes,
      pin: this.p.pins,
      mark: this.p.marks,
      light: this.p.lights,
    };
    if (collections[type]) target = collections[type].find((o) => o.id === id);
    if (type === "brush") target = this.brush;
    if (type === "settings") target = this.p.settings;
    if (type === "project") target = this.p;
    if (type === "shot")
      target = this.p.shots.find((s) => s.id === this.selectedShot);
    if (type === "action" || type === "cue") {
      const child = parts.shift(),
        s = this.p.shots.find((s) => s.id === this.selectedShot);
      target =
        type === "action"
          ? s?.actions.find((a) => a.id === child)
          : s?.cues.find((a) => a.id === child);
    }
    if (!target) return;
    let value: any =
      input.type === "checkbox"
        ? input.checked
        : ["range", "number"].includes(input.type)
          ? Number(input.value)
          : input.value;
    if (typeof value === "number" && !Number.isFinite(value)) return;
    const last = parts.at(-1)!;
    if (type === "shot" && (parts[0] === "camera" || last.endsWith("Deg")))
      target.manualCamera = true;
    if (["start", "intensity", "fromIntensity", "toIntensity"].includes(last))
      value = Math.max(0, value);
    if (
      ["width", "height", "scale", "duration", "radius", "distance"].includes(
        last,
      )
    )
      value = Math.max(0.001, value);
    if (last === "rotationDeg") {
      target.rotation = (value * Math.PI) / 180;
      return;
    }
    if (["yawDeg", "pitchDeg", "rollDeg"].includes(last)) {
      target.camera[last.replace("Deg", "")] = (value * Math.PI) / 180;
      return;
    }
    if (type === "rope" && last === "hasControl") {
      target.control = value ? [0, 0, 0.4] : undefined;
      return;
    }
    if (type === "light" && last === "hostId") {
      const host = this.p.items.find((o) => o.id === value);
      target.hostId = value || undefined;
      target.local = [0, 0, 0.02];
      if (host) target.target = localToWorld(host, target.local);
      return;
    }
    if (type === "cue" && last === "targetId") {
      target.targetId = value || undefined;
      return;
    }
    if (type === "action") {
      if (parts[0] === "bezier" && !target.bezier)
        target.bezier = [...actionCurve(target)];
      if (last === "ease" && value === "custom" && !target.bezier)
        target.bezier = [...actionCurve(target)];
      if (last === "fade" || parts[0] === "bezier") value = clamp(value, 0, 1);
      if (last === "travel") value = clamp(value, 1, 4);
    }
    for (const key of parts.slice(0, -1)) target = target[key];
    target[last] = value;
    if (type === "action") {
      const a = this.p.shots
        .find((s) => s.id === this.selectedShot)
        ?.actions.find((a) => a.id === input.dataset.bind!.split(".")[1]);
      if (a)
        this.root
          .querySelector(`[data-curve="${a.id}"]`)
          ?.insertAdjacentHTML("afterend", curvePreview(a));
      // Replace just the graph, preserving the actively dragged slider.
      const graphs = a
        ? this.root.querySelectorAll(`[data-curve="${a.id}"]`)
        : [];
      if (graphs.length > 1) graphs[0].remove();
    }
    if (type === "settings" && last === "aspect") {
      this.p.camera = poseFor(this.p, [], "overview");
      for (const shot of this.p.shots)
        if (!shot.manualCamera)
          shot.camera = poseFor(this.p, shot.targetIds, shot.motion);
      this.view.pose = clone(this.p.camera);
      this.toast("自动镜头已适配画幅，手动机位继续保留");
    }
    if (type === "light" && parts[0] === "target")
      this.p.lights.find((l) => l.id === id)!.hostId = undefined;
  }
  applyLook(i: number) {
    this.store.edit((p) => applyCinemaLook(p, i));
    this.toast("已应用电影布光；手动追光保留");
  }
  savePreset() {
    const items = this.p.items.filter((o) => this.selection.includes(o.id));
    if (!items.length) {
      this.toast("先多选需要保存的物件");
      return;
    }
    const ids = new Set(items.map((o) => o.id)),
      pins = this.p.pins.filter((p) => ids.has(p.hostId ?? "")),
      pinIds = new Set(pins.map((p) => p.id));
    const preset: Preset = {
      id: uid("preset"),
      name: items[0].title + " / 组合",
      items: clone(items),
      pins: clone(pins),
      ropes: clone(
        this.p.ropes.filter((r) => pinIds.has(r.from) && pinIds.has(r.to)),
      ),
      marks: clone(this.p.marks.filter((m) => ids.has(m.hostId ?? ""))),
    };
    this.store.edit((p) => p.presets.push(preset));
    this.category = "组合预设";
    this.renderLibrary();
    this.toast("组合已保存到背包");
  }
  placePreset(id: string) {
    const preset = this.p.presets.find((p) => p.id === id);
    if (!preset) return;
    const temp = emptyProject();
    Object.assign(temp, clone(preset));
    const ids = duplicateSelection(
        temp,
        temp.items.map((o) => o.id),
      ),
      c = poseFor(temp, ids).target,
      items = temp.items.filter((o) => ids.includes(o.id));
    items.forEach((o) => {
      o.position[0] += this.view.pose.target[0] - c[0];
      o.position[1] += this.view.pose.target[1] - c[1];
    });
    const itemIds = new Set(ids),
      pins = temp.pins.filter((o) => itemIds.has(o.hostId ?? "")),
      pinIds = new Set(pins.map((o) => o.id));
    this.store.edit((p) => {
      p.items.push(...items);
      p.pins.push(...pins);
      p.ropes.push(
        ...temp.ropes.filter((r) => pinIds.has(r.from) && pinIds.has(r.to)),
      );
      p.marks.push(...temp.marks.filter((m) => itemIds.has(m.hostId ?? "")));
    });
    this.select(ids);
  }
  composite() {
    let ids: string[] = [];
    this.store.edit((p) => {
      const g = uid("group");
      for (const [kind, dx, dy] of [
        ["polaroid", -0.8, 0.5],
        ["file", 1.8, -0.2],
        ["note", -0.9, -1.9],
      ] as [Kind, number, number][]) {
        const o = makeItem(kind, [
          this.view.pose.target[0] + dx,
          this.view.pose.target[1] + dy,
          0.08 + ids.length * 0.015,
        ]);
        o.groupId = g;
        o.assetId = Object.keys(p.assets)[0];
        p.items.push(o);
        ids.push(o.id);
        p.pins.push({
          id: uid("pin"),
          hostId: o.id,
          local: [0, o.height / 2 - 0.15, 0.025],
          color: "#a32328",
        });
      }
    });
    this.select(ids);
  }
  down(e: PointerEvent) {
    if (this.busy) return;
    if (this.mode !== "build") {
      const h = this.view.pick(e.clientX, e.clientY);
      if (h) this.select([h.id]);
      return;
    }
    e.preventDefault();
    this.stop();
    this.view.renderer.domElement.setPointerCapture(e.pointerId);
    const hit = this.view.pick(e.clientX, e.clientY),
      point = this.view.boardPoint(e.clientX, e.clientY) ?? [0, 0, 0.04],
      base = {
        x: e.clientX,
        y: e.clientY,
        point,
        originals: new Map<string, Item>(),
        pose: clone(this.view.pose),
      };
    if (e.altKey || e.button === 1) {
      this.drag = { ...base, kind: "orbit" };
      return;
    }
    if (this.space || e.button === 2) {
      this.drag = { ...base, kind: "pan" };
      return;
    }
    if (this.tool === "pin") {
      this.addPin(point, hit?.kind === "item" ? hit.id : undefined);
      return;
    }
    if (this.tool === "light") {
      const l = makeLight([point[0] - 1, point[1] + 2, 7]);
      l.target = point;
      this.store.edit((p) => p.lights.push(l));
      this.select([l.id]);
      this.setTool("select");
      return;
    }
    if (this.tool === "rope") {
      if (hit?.kind !== "pin") {
        this.toast("选择实体图钉作为端点");
        return;
      }
      if (!this.ropeStart) {
        this.ropeStart = hit.id;
        this.select([hit.id]);
        this.toast("再点击终点图钉");
      } else if (this.ropeStart !== hit.id) {
        const r = {
          id: uid("rope"),
          from: this.ropeStart,
          to: hit.id,
          color: "#b8242c",
          radius: 0.023,
          slack: 0.12,
          bend: 0,
          style: "cotton" as const,
        };
        this.store.edit((p) => p.ropes.push(r));
        this.ropeStart = undefined;
        this.clearDraft();
        this.select([r.id]);
        this.toast("实体红绳已连接");
      }
      return;
    }
    if (this.tool === "mark") {
      const host = this.p.items.find((o) => o.id === hit?.id),
        p = host ? worldToLocal(host, hit?.point ?? point) : clone(point);
      p[2] = 0.025;
      this.drag = { ...base, kind: "mark", hostId: host?.id, points: [p] };
      return;
    }
    if (this.tool === "target" || hit?.kind === "target") {
      const l =
        this.p.lights.find(
          (l) => l.id === (hit?.kind === "target" ? hit.id : this.selection[0]),
        ) ?? this.p.lights[0];
      if (!l) {
        this.toast("先添加追光灯");
        return;
      }
      this.store.begin();
      l.target = point;
      l.hostId = undefined;
      this.drag = { ...base, kind: "target", lightId: l.id };
      this.view.updateGizmos(this.p);
      return;
    }
    if (hit?.kind === "light") {
      const l = this.p.lights.find((l) => l.id === hit.id)!;
      this.select([l.id]);
      this.store.begin();
      this.drag = {
        ...base,
        kind: "light",
        lightId: l.id,
        lightPosition: clone(l.position),
      };
      return;
    }
    if (hit) {
      if (hit.kind === "item") {
        const o = this.p.items.find((o) => o.id === hit.id)!;
        if (e.shiftKey)
          this.select(
            this.selection.includes(hit.id)
              ? this.selection.filter((id) => id !== hit.id)
              : [...this.selection, hit.id],
          );
        else if (!this.selection.includes(hit.id))
          this.select(
            o.groupId
              ? this.p.items
                  .filter((n) => n.groupId === o.groupId)
                  .map((n) => n.id)
              : [hit.id],
          );
        const originals = new Map(
          this.p.items
            .filter((o) => this.selection.includes(o.id) && !o.locked)
            .map((o) => [o.id, clone(o)]),
        );
        if (originals.size) {
          this.store.begin();
          this.drag = {
            ...base,
            kind:
              this.tool === "rotate"
                ? "rotate"
                : this.tool === "scale"
                  ? "scale"
                  : "move",
            originals,
          };
        }
      } else this.select([hit.id]);
      return;
    }
    if (e.shiftKey) {
      this.drag = { ...base, kind: "box" };
      this.el("#box-select").hidden = false;
    } else {
      this.select([]);
      this.drag = { ...base, kind: "pan" };
    }
  }
  move(e: PointerEvent) {
    const d = this.drag,
      hostPlane = this.p.items.find((o) => o.id === d?.hostId),
      point = this.view.boardPoint(
        e.clientX,
        e.clientY,
        hostPlane ? hostPlane.position[2] + 0.015 : 0.006,
      ) ?? [0, 0, 0.04];
    if (!d) {
      if (this.tool === "rope" && this.ropeStart) {
        const pin = this.p.pins.find((p) => p.id === this.ropeStart);
        if (pin) {
          const host = this.p.items.find((o) => o.id === pin.hostId);
          this.drawDraft(
            [host ? localToWorld(host, pin.local) : pin.local, point],
            "#d3b47f",
          );
        }
      }
      return;
    }
    if (d.kind === "orbit") {
      this.view.pose.yaw = clamp(
        d.pose.yaw -
          (e.clientX - d.x) * 0.004 * (this.p.settings.orbitReverse ? -1 : 1),
        -1.2,
        1.2,
      );
      this.view.pose.pitch = clamp(
        d.pose.pitch +
          (e.clientY - d.y) * 0.004 * (this.p.settings.orbitReverse ? -1 : 1),
        -1,
        1,
      );
      return;
    }
    if (d.kind === "pan") {
      this.view.pose.target[0] -= point[0] - d.point[0];
      this.view.pose.target[1] -= point[1] - d.point[1];
      return;
    }
    if (d.kind === "box") {
      const rect = this.el("#stage").getBoundingClientRect(),
        b = this.el("#box-select");
      b.style.left = Math.min(d.x, e.clientX) - rect.left + "px";
      b.style.top = Math.min(d.y, e.clientY) - rect.top + "px";
      b.style.width = Math.abs(e.clientX - d.x) + "px";
      b.style.height = Math.abs(e.clientY - d.y) + "px";
      return;
    }
    if (d.kind === "mark") {
      const host = this.p.items.find((o) => o.id === d.hostId),
        local = host ? worldToLocal(host, point) : clone(point);
      local[2] = 0.026;
      const last = d.points!.at(-1)!;
      if (Math.hypot(local[0] - last[0], local[1] - last[1]) > 0.025)
        d.points!.push(local);
      this.drawDraft(
        d.points!.map((v) => (host ? localToWorld(host, v) : v)),
        this.brush.color,
      );
      return;
    }
    if (d.kind === "target") {
      const l = this.p.lights.find((l) => l.id === d.lightId)!;
      l.target = point;
      l.hostId = undefined;
      this.view.updateGizmos(this.p);
      return;
    }
    if (d.kind === "light") {
      const l = this.p.lights.find((l) => l.id === d.lightId)!;
      l.position = [
        d.lightPosition![0] + point[0] - d.point[0],
        d.lightPosition![1] + point[1] - d.point[1],
        d.lightPosition![2],
      ];
      this.view.updateGizmos(this.p);
      return;
    }
    const originals = [...d.originals.values()],
      center: V3 = [
        originals.reduce((v, o) => v + o.position[0], 0) / originals.length,
        originals.reduce((v, o) => v + o.position[1], 0) / originals.length,
        0,
      ],
      angle =
        Math.atan2(point[1] - center[1], point[0] - center[0]) -
        Math.atan2(d.point[1] - center[1], d.point[0] - center[0]),
      factor = clamp(
        Math.hypot(point[0] - center[0], point[1] - center[1]) /
          Math.max(
            0.25,
            Math.hypot(d.point[0] - center[0], d.point[1] - center[1]),
          ),
        0.15,
        5,
      );
    for (const old of originals) {
      const o = this.p.items.find((o) => o.id === old.id)!;
      if (d.kind === "move") {
        let dx = point[0] - d.point[0],
          dy = point[1] - d.point[1];
        if (e.ctrlKey || this.p.settings.grid) {
          dx = Math.round(dx * 4) / 4;
          dy = Math.round(dy * 4) / 4;
        }
        o.position = [
          old.position[0] + dx,
          old.position[1] + dy,
          old.position[2],
        ];
      }
      if (d.kind === "rotate") {
        const x = old.position[0] - center[0],
          y = old.position[1] - center[1];
        o.position = [
          center[0] + x * Math.cos(angle) - y * Math.sin(angle),
          center[1] + x * Math.sin(angle) + y * Math.cos(angle),
          old.position[2],
        ];
        o.rotation = old.rotation + angle;
      }
      if (d.kind === "scale") {
        o.scale = old.scale * factor;
        o.position = [
          center[0] + (old.position[0] - center[0]) * factor,
          center[1] + (old.position[1] - center[1]) * factor,
          old.position[2],
        ];
      }
    }
    this.view.updateSelection(this.p);
  }
  up(e: PointerEvent) {
    const d = this.drag;
    this.drag = undefined;
    if (!d) return;
    if (d.kind === "mark") {
      this.clearDraft();
      if (d.points!.length > 2)
        this.store.edit((p) =>
          p.marks.push({
            id: uid("mark"),
            hostId: d.hostId,
            points: d.points!,
            radius: this.brush.radius,
            color: this.brush.color,
            brush: this.brush.type,
          }),
        );
      return;
    }
    if (d.kind === "box") {
      this.el("#box-select").hidden = true;
      const x0 = Math.min(e.clientX, d.x),
        x1 = Math.max(e.clientX, d.x),
        y0 = Math.min(e.clientY, d.y),
        y1 = Math.max(e.clientY, d.y);
      this.select(
        this.p.items
          .filter((o) => {
            const pt = this.view.screenPoint(o.position);
            return (
              !o.hidden && pt.x >= x0 && pt.x <= x1 && pt.y >= y0 && pt.y <= y1
            );
          })
          .map((o) => o.id),
      );
      return;
    }
    if (d.kind === "target") {
      const h = this.view.pick(e.clientX, e.clientY),
        l = this.p.lights.find((l) => l.id === d.lightId)!;
      if (h?.kind === "item") {
        const host = this.p.items.find((o) => o.id === h.id)!;
        l.hostId = host.id;
        l.local = worldToLocal(host, l.target);
        l.local[2] = 0.02;
      }
      this.store.commit();
      this.select([l.id]);
      return;
    }
    if (["move", "rotate", "scale", "light"].includes(d.kind))
      this.store.commit();
  }
  drawDraft(points: V3[], color: string) {
    this.clearDraft();
    this.draft = new T.Line(
      new T.BufferGeometry().setFromPoints(
        points.map((p) => new T.Vector3(...p)),
      ),
      new T.LineBasicMaterial({ color, depthTest: false }),
    );
    this.view.helpers.add(this.draft);
  }
  clearDraft() {
    if (this.draft) {
      disposeTree(this.draft);
      this.draft = undefined;
    }
  }
  togglePlay() {
    if (this.playing) {
      this.stop();
      return;
    }
    if (!this.p.shots.length) {
      this.toast("先添加故事镜头");
      return;
    }
    if (this.time >= duration(this.p)) this.time = 0;
    this.setMode("play");
    this.playing = true;
    this.playEpoch = performance.now() - this.time * 1000;
    this.el("#play-button").innerHTML = icon("pause") + "暂停";
    if (this.p.audio) {
      this.audio ??= new Audio(this.p.audio);
      this.audio.currentTime = this.time;
      void this.audio.play().catch(() => this.toast("浏览器尚未允许声音播放"));
    }
  }
  stop() {
    this.playing = false;
    this.audio?.pause();
    this.el("#play-button").innerHTML = icon("play") + "播放故事";
  }
  seek(t: number) {
    this.stop();
    this.time = clamp(t, 0, duration(this.p));
    if (this.mode === "build") this.setMode("director");
    if (this.audio) this.audio.currentTime = this.time;
    this.updateTime();
  }
  updateTime() {
    this.el<HTMLInputElement>("#scrub").value = String(this.time);
    const min = Math.floor(this.time / 60),
      sec = Math.floor(this.time % 60),
      sub = Math.floor((this.time % 1) * 100);
    this.el("#timecode").textContent =
      `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(sub).padStart(2, "0")} / ${duration(this.p).toFixed(1)}s`;
    const idx = evaluate(this.p, this.time).shotIndex;
    this.root
      .querySelectorAll(".shot-card")
      .forEach((c, i) =>
        c.classList.toggle("playing", this.mode !== "build" && idx === i),
      );
  }
  tick = (now: number) => {
    requestAnimationFrame(this.tick);
    if (this.busy) return;
    if (this.playing) {
      this.time = Math.min(duration(this.p), (now - this.playEpoch) / 1000);
      if (this.time >= duration(this.p)) this.stop();
      this.updateTime();
    }
    if (!this.syncing)
      this.view.renderAt(
        this.p,
        this.time,
        this.mode,
        undefined,
        this.liveRecording,
      );
    if (this.view.gizmoLight === "hidden") this.view.helpers.visible = false;
    this.recorder?.capture(now);
    this.frames++;
    if (now - this.lastFps > 1000) {
      this.fps = (this.frames * 1000) / (now - this.lastFps);
      this.frames = 0;
      this.lastFps = now;
      this.el("#fps").textContent = `${Math.round(this.fps)} FPS`;
      this.el("#render-status").textContent =
        `真实三维 · ${this.p.settings.quality === "draft" ? "快速" : "影棚"} / WebGL2`;
    }
  };
  saveSoon() {
    clearTimeout(this.savedTimer);
    this.el("#saved").textContent = "保存中…";
    this.savedTimer = window.setTimeout(() => {
      const p = clone(this.p);
      p.camera = clone(this.view.pose);
      void autosave(p).then(
        () => (this.el("#saved").textContent = "已本地保存"),
        () => {
          this.el("#saved").textContent = "自动保存失败";
          this.toast("本地存储不足，请保存工程 JSON");
        },
      );
    }, 450);
  }
  toast(message: string) {
    const t = this.el("#toast");
    t.textContent = message;
    t.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => t.classList.remove("visible"),
      3500,
    );
  }
}
