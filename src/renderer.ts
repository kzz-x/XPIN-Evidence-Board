import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { goboTexture } from "./gobo";
import { Materials } from "./materials";
import {
  createItem,
  deformPaper,
  pinMesh,
  ropeMesh,
  markMesh,
  physical,
  disposeTree,
} from "./geometry";
import {
  localToWorld,
  pinWorld,
  ratio,
  clone,
  type Pose,
  type V3,
  type Project,
  type Mode,
  type Transform,
} from "./model";
import { evaluate, type Frame } from "./story";
export type Hit = {
  id: string;
  kind: "item" | "pin" | "rope" | "mark" | "light" | "target";
  point: V3;
};
const lookShader = {
  uniforms: {
    tDiffuse: { value: null },
    seed: { value: 0 },
    grain: { value: 0.007 },
  },
  vertexShader:
    "varying vec2 vUv; void main(){ vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader:
    "uniform sampler2D tDiffuse; uniform float seed; uniform float grain; varying vec2 vUv; void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float n=fract(sin(dot(vUv*vec2(1639.,937.),vec2(12.9898,78.233))+seed)*43758.5453);float vig=1.-.22*dot(vUv-.5,vUv-.5);gl_FragColor=vec4(c*vig+(n-.5)*grain,1.);}",
};
export class BoardRenderer {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, 0.05, 200);
  renderer: T.WebGLRenderer;
  composer: EffectComposer;
  bokeh: BokehPass;
  look: ShaderPass;
  materials = new Materials();
  objects = new Map<string, T.Group>();
  signatures = new Map<string, string>();
  ropes = new Map<string, T.Group>();
  ropeSigs = new Map<string, string>();
  pins = new Map<string, T.Group>();
  marks = new Map<string, T.Group>();
  lights = new Map<string, T.SpotLight>();
  helpers = new T.Group();
  selection = new T.Group();
  grid = new T.GridHelper(2000, 4000, "#758575", "#536153");
  board: T.Mesh;
  key = new T.DirectionalLight("#ffdfad", 4);
  ambient = new T.HemisphereLight("#ddd9cd", "#252a2b", 0.4);
  fill = new T.DirectionalLight("#90adb6", 0.8);
  ray = new T.Raycaster();
  current?: Project;
  frame?: Frame;
  mode: Mode = "build";
  pose: Pose;
  selectionIds: string[] = [];
  width = 1;
  height = 1;
  needsSync = true;
  private pendingLoad = 0;
  private boardKind = "";
  private boardSignature = "";
  private sampleCount = -1;
  private previewScale = -1;
  border = new T.Group();
  cookies = new Map<string, { signature: string; texture: T.Texture }>();
  gizmoLight?: string;
  renderSettings: Partial<Project["settings"]> = {};
  constructor(
    public container: HTMLElement,
    pose: Pose,
  ) {
    this.pose = clone(pose);
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.renderer.info.autoReset = false;
    this.renderer.domElement.setAttribute("aria-label", "三维调查沙盘");
    this.renderer.domElement.dataset.testid = "board-canvas";
    this.scene.background = new T.Color("#101715");
    const pmrem = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.045).texture;
    this.scene.environmentIntensity = 0.22;
    room.dispose();
    pmrem.dispose();
    this.board = physical(
      new T.BoxGeometry(23, 17, 0.4),
      this.materials.board("felt"),
    );
    this.board.position.z = -0.205;
    this.scene.add(this.board, this.border);
    this.key.position.set(-10, 9, 12);
    this.key.castShadow = true;
    this.key.shadow.camera.left = -16;
    this.key.shadow.camera.right = 16;
    this.key.shadow.camera.top = 13;
    this.key.shadow.camera.bottom = -13;
    this.key.shadow.camera.near = 0.2;
    this.key.shadow.camera.far = 70;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.00008;
    this.key.shadow.normalBias = 0.0007;
    this.scene.add(this.key, this.key.target, this.ambient);
    this.fill.position.set(10, -4, 8);
    this.scene.add(this.fill);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.z = 0.005;
    this.grid.visible = false;
    this.scene.add(this.helpers, this.selection, this.grid);
    this.composer = new EffectComposer(
      this.renderer,
      new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 4 }),
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, {
      focus: 20,
      aperture: 0.00005,
      maxblur: 0.006,
    });
    this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());
    this.look = new ShaderPass(lookShader);
    this.composer.addPass(this.look);
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      container.dispatchEvent(
        new CustomEvent("render-error", {
          detail: "WebGL 上下文丢失，请保存工程后重新打开。",
        }),
      );
    });
  }
  resize() {
    const r = this.container.getBoundingClientRect();
    this.width = Math.max(1, r.width);
    this.height = Math.max(1, r.height);
    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }
  async sync(p: Project) {
    const generation = ++this.pendingLoad;
    await this.materials.load(p.assets);
    if (generation !== this.pendingLoad) return;
    this.current = p;
    this.reconcile(p);
    this.needsSync = false;
  }
  reconcile(p: Project) {
    if (this.boardKind !== p.settings.board) {
      this.board.material = this.materials.board(p.settings.board);
      this.boardKind = p.settings.board;
    }
    const items = new Set(p.items.map((o) => o.id));
    for (const [id, g] of this.objects)
      if (!items.has(id)) {
        disposeTree(g, new Set([this.materials.metal]));
        this.objects.delete(id);
        this.signatures.delete(id);
      }
    for (const o of p.items) {
      const signature = JSON.stringify([
        o.kind,
        o.title,
        o.body,
        o.width,
        o.height,
        o.color,
        o.assetId,
        o.assetId ? p.assets[o.assetId] : null,
        o.font,
        p.settings.font,
        o.fontScale,
        p.settings.fontScale,
        o.roughness,
        o.paperCurl,
        o.fiberStrength,
      ]);
      if (this.signatures.get(o.id) !== signature) {
        const old = this.objects.get(o.id);
        if (old) disposeTree(old, new Set([this.materials.metal]));
        const g = createItem(
          {
            ...o,
            font: o.font || p.settings.font,
            fontScale: o.fontScale ?? p.settings.fontScale,
          },
          this.materials,
        );
        this.objects.set(o.id, g);
        this.scene.add(g);
        this.signatures.set(o.id, signature);
      }
    }
    for (const [id, g] of this.pins)
      if (!p.pins.some((o) => o.id === id)) {
        disposeTree(g, new Set([this.materials.metal]));
        this.pins.delete(id);
      }
    for (const pin of p.pins) {
      let g = this.pins.get(pin.id);
      if (!g) {
        g = pinMesh(pin.color, this.materials, pin.roughness);
        g.traverse((n) => {
          n.userData = { id: pin.id, kind: "pin" };
        });
        this.pins.set(pin.id, g);
        this.scene.add(g);
      } else {
        g.traverse((n) => {
          if (
            n instanceof T.Mesh &&
            n.material instanceof T.MeshPhysicalMaterial
          ) {
            n.material.color.set(pin.color);
            n.material.roughness = pin.roughness ?? 0.26;
          }
        });
      }
    }
    for (const [id, g] of this.marks)
      if (!p.marks.some((m) => m.id === id)) {
        disposeTree(g);
        this.marks.delete(id);
      }
    for (const m of p.marks) {
      const host = p.items.find((o) => o.id === m.hostId);
      const signature = JSON.stringify([
        m.points,
        m.color,
        m.radius,
        m.brush,
        host?.width,
        host?.height,
        host?.paperCurl,
      ]);
      let g = this.marks.get(m.id);
      if (!g || g.userData.signature !== signature) {
        if (g) disposeTree(g);
        g = markMesh(m.points, m.color, m.radius, m.brush, host);
        g.userData = { signature };
        g.traverse((n) => {
          n.userData = { ...n.userData, id: m.id, kind: "mark" };
        });
        this.marks.set(m.id, g);
        this.scene.add(g);
      }
    }
    for (const [id, l] of this.lights)
      if (!p.lights.some((o) => o.id === id)) {
        this.cookies.get(id)?.texture.dispose();
        this.cookies.delete(id);
        l.dispose();
        l.removeFromParent();
        l.target.removeFromParent();
        this.lights.delete(id);
      }
    for (const l of p.lights)
      if (!this.lights.has(l.id)) {
        const light = new T.SpotLight();
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.bias = -0.0001;
        light.shadow.normalBias = 0.0007;
        light.shadow.camera.near = 0.1;
        this.lights.set(l.id, light);
        this.scene.add(light, light.target);
      }
    this.updateGizmos(p);
    this.updateSelection(p);
  }
  updateSelection(p: Project) {
    while (this.selection.children.length)
      disposeTree(this.selection.children[0]);
    for (const id of this.selectionIds) {
      const o = p.items.find((o) => o.id === id);
      if (!o) continue;
      const pts = [
        [-o.width / 2 - 0.08, -o.height / 2 - 0.08],
        [o.width / 2 + 0.08, -o.height / 2 - 0.08],
        [o.width / 2 + 0.08, o.height / 2 + 0.08],
        [-o.width / 2 - 0.08, o.height / 2 + 0.08],
        [-o.width / 2 - 0.08, -o.height / 2 - 0.08],
      ].map((v) => new T.Vector3(v[0], v[1], 0.05));
      const geometry = new T.BufferGeometry().setFromPoints(pts),
        line = new T.Line(
          geometry,
          new T.LineBasicMaterial({ color: "#cbb27a" }),
        );
      const g = new T.Group();
      g.add(line);
      g.userData.id = id;
      g.position.set(...o.position);
      g.rotation.z = o.rotation;
      g.scale.setScalar(o.scale);
      this.selection.add(g);
    }
  }
  updateGizmos(p: Project) {
    while (this.helpers.children.length) disposeTree(this.helpers.children[0]);
    for (const l of p.lights) {
      const group = new T.Group();
      group.userData.id = l.id;
      const bulb = new T.Mesh(
        new T.SphereGeometry(0.13, 14, 10),
        new T.MeshBasicMaterial({ color: l.enabled ? l.color : "#57615b" }),
      );
      bulb.position.set(...l.position);
      bulb.userData = { id: l.id, kind: "light" };
      group.add(bulb);
      const host = p.items.find((o) => o.id === l.hostId),
        target = host ? localToWorld(host, l.local) : l.target;
      const ring = new T.Mesh(
        new T.TorusGeometry(0.28, 0.014, 5, 40),
        new T.MeshBasicMaterial({
          color: this.selectionIds.includes(l.id) ? "#f1cb76" : "#a9ae99",
          transparent: true,
          opacity: 0.7,
        }),
      );
      ring.position.set(...target);
      ring.position.z += 0.04;
      ring.userData = { id: l.id, kind: "target" };
      group.add(ring);
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(...l.position),
          new T.Vector3(...target),
        ]),
        new T.LineDashedMaterial({
          color: "#b9af93",
          dashSize: 0.08,
          gapSize: 0.08,
          transparent: true,
          opacity: 0.35,
        }),
      );
      line.computeLineDistances();
      group.add(line);
      this.helpers.add(group);
    }
  }
  cameraPose(pose: Pose, aspect = this.width / this.height) {
    this.camera.aspect = aspect;
    this.camera.setFocalLength(pose.focal);
    this.camera.up.set(-Math.sin(pose.roll), Math.cos(pose.roll), 0);
    const cp = Math.cos(pose.pitch);
    this.camera.position.set(
      pose.target[0] + Math.sin(pose.yaw) * cp * pose.distance,
      pose.target[1] + Math.sin(pose.pitch) * pose.distance,
      pose.target[2] + Math.cos(pose.yaw) * cp * pose.distance,
    );
    this.camera.lookAt(new T.Vector3(...pose.target));
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  renderAt(
    p: Project,
    time: number,
    mode: Mode = this.mode,
    pose?: Pose,
    output = false,
  ) {
    this.renderer.info.reset();
    const f = evaluate(p, time);
    this.frame = f;
    this.mode = mode;
    const play = mode !== "build";
    const camera = pose ?? (play && p.shots.length ? f.camera : this.pose);
    for (const o of p.items) {
      const g = this.objects.get(o.id);
      if (!g) continue;
      const tr = play ? f.transforms.get(o.id)! : o;
      g.position.set(...tr.position);
      g.rotation.z = tr.rotation;
      const dimensions = g.userData.dimensionScale ?? [1, 1, 1];
      g.scale.set(
        tr.scale * dimensions[0],
        tr.scale * dimensions[1],
        tr.scale * dimensions[2],
      );
      g.visible = play ? f.visible.get(o.id)! : !o.hidden;
      const typing = p.shots.some((s) =>
          s.actions.some((a) => a.targetId === o.id && a.type === "type"),
        ),
        q = play ? (f.progress.get(o.id) ?? 1) : 1;
      const deform = play ? f.deformation.get(o.id) : undefined;
      g.traverse((n) => {
        if (n instanceof T.Mesh && n.userData.paper)
          deformPaper(
            n,
            o,
            deform?.type === "peel" ? q : 1,
            deform?.strength ?? 1,
          );
        if (n.userData.clipHandle)
          n.rotation.x =
            deform?.type === "clamp" ? (1 - q) * 0.85 * deform.strength : 0;
        if (n.userData.clipJaw)
          n.rotation.x =
            deform?.type === "clamp" ? (1 - q) * 0.65 * deform.strength : 0;
      });
      if (o.kind === "clip")
        g.scale.z =
          tr.scale * (deform?.type === "clamp" ? 1 + (1 - q) * 0.35 : 1);
      if (o.kind === "pin")
        g.rotation.x = deform?.type === "pin" ? (1 - q) * -0.24 : 0;
      if (typing) {
        const chars = Math.floor((o.title.length + o.body.length) * q);
        if (g.userData.typed !== chars) {
          const raw = (g.children[0] as T.Mesh).material;
          const material = (
            Array.isArray(raw) ? raw[0] : raw
          ) as T.MeshStandardMaterial;
          if (material.map) {
            material.map.dispose();
            material.map = this.materials.content({
              ...o,
              font: o.font || p.settings.font,
              fontScale: o.fontScale ?? p.settings.fontScale,
              title: o.title.slice(0, chars),
              body: o.body.slice(0, Math.max(0, chars - o.title.length)),
            });
          }
          g.userData.typed = chars;
        }
      }
    }
    for (const pin of p.pins) {
      const g = this.pins.get(pin.id);
      if (!g) continue;
      const pos = pinWorld(p, pin, play ? f.transforms : undefined);
      g.position.set(...pos);
      const host = p.items.find((o) => o.id === pin.hostId);
      g.visible = !host || (play ? f.visible.get(host.id)! : !host.hidden);
      const q = play ? (f.progress.get(pin.id) ?? 1) : 1;
      g.position.z +=
        (1 - q) * 0.8 * (f.deformation.get(pin.id)?.strength ?? 1);
      g.rotation.x = play ? (1 - q) * -0.24 : 0;
      g.visible &&= q > 0;
    }
    const ropeIds = new Set(p.ropes.map((r) => r.id));
    for (const [id, g] of this.ropes)
      if (!ropeIds.has(id)) {
        disposeTree(g);
        this.ropes.delete(id);
        this.ropeSigs.delete(id);
      }
    for (const r of p.ropes) {
      const ap = p.pins.find((x) => x.id === r.from),
        bp = p.pins.find((x) => x.id === r.to);
      if (!ap || !bp) continue;
      const a = pinWorld(p, ap, play ? f.transforms : undefined),
        b = pinWorld(p, bp, play ? f.transforms : undefined);
      a[2] += 0.145;
      b[2] += 0.145;
      const sig = JSON.stringify([a, b, r]);
      let g = this.ropes.get(r.id);
      if (!g || this.ropeSigs.get(r.id) !== sig) {
        if (g) disposeTree(g);
        g = ropeMesh(r, a, b, this.materials);
        this.ropes.set(r.id, g);
        this.ropeSigs.set(r.id, sig);
        this.scene.add(g);
      }
      g.visible = Boolean(
        this.pins.get(ap.id)?.visible && this.pins.get(bp.id)?.visible,
      );
      const progress = play ? (f.progress.get(r.id) ?? 1) : 1;
      g.traverse((n) => {
        if (n instanceof T.Mesh)
          n.geometry.setDrawRange(
            0,
            Math.floor(((n.geometry.index?.count ?? 0) * progress) / 36) * 36,
          );
      });
    }
    for (const m of p.marks) {
      const g = this.marks.get(m.id);
      if (!g) continue;
      const host = p.items.find((o) => o.id === m.hostId),
        tr = host ? (play ? f.transforms.get(host.id)! : host) : undefined;
      if (tr) {
        g.position.set(...tr.position);
        g.rotation.z = tr.rotation;
        g.scale.setScalar(tr.scale);
        g.visible = play ? f.visible.get(host!.id)! : !host!.hidden;
      } else g.visible = true;
      const q = play ? (f.progress.get(m.id) ?? 1) : 1;
      g.traverse((n) => {
        if (n instanceof T.Mesh) {
          const deformation =
            host && play ? f.deformation.get(host.id) : undefined;
          if (host)
            deformPaper(
              n,
              host,
              deformation?.type === "peel" ? (f.progress.get(host.id) ?? 1) : 1,
            );
          n.geometry.setDrawRange(
            0,
            Math.floor(((n.geometry.index?.count ?? 0) * q) / 6) * 6,
          );
        }
      });
    }
    const settings = { ...p.settings, ...this.renderSettings };
    const boardSig = JSON.stringify([
      settings.boardWidth,
      settings.boardHeight,
      settings.frameWidth,
      settings.frameColor,
      settings.frame,
    ]);
    if (boardSig !== this.boardSignature) {
      this.board.geometry.dispose();
      this.board.geometry = new T.BoxGeometry(
        settings.boardWidth,
        settings.boardHeight,
        0.4,
      );
      while (this.border.children.length) disposeTree(this.border.children[0]);
      if (settings.frame) {
        const w = settings.boardWidth,
          h = settings.boardHeight,
          f = settings.frameWidth;
        for (const [x, y, a, b] of [
          [0, h / 2 + f / 2, w + f * 2, f],
          [0, -h / 2 - f / 2, w + f * 2, f],
          [-w / 2 - f / 2, 0, f, h],
          [w / 2 + f / 2, 0, f, h],
        ]) {
          const bar = physical(
            new T.BoxGeometry(a, b, 0.48),
            new T.MeshStandardMaterial({
              color: settings.frameColor,
              roughness: 0.43,
              metalness: 0.12,
            }),
          );
          bar.position.set(x, y, -0.14);
          this.border.add(bar);
        }
      }
      this.boardSignature = boardSig;
    }
    const boardMat = this.board.material as T.MeshStandardMaterial;
    for (const map of [
      boardMat.map,
      boardMat.normalMap,
      boardMat.roughnessMap,
      boardMat.bumpMap,
    ])
      if (map)
        map.repeat.set(
          (settings.boardWidth / 6) * settings.boardTextureScale,
          (settings.boardHeight / 6) * settings.boardTextureScale,
        );
    if (!output && this.previewScale !== settings.renderScale) {
      const scale = Math.min(devicePixelRatio, 2) * settings.renderScale;
      this.renderer.setPixelRatio(scale);
      this.composer.setPixelRatio(scale);
      this.previewScale = settings.renderScale;
    }
    const samples =
      settings.quality === "draft"
        ? 0
        : Math.min(
            this.renderer.capabilities.maxSamples,
            settings.quality === "ultra" ? 8 : 4,
          );
    if (samples !== this.sampleCount) {
      for (const target of [
        this.composer.renderTarget1,
        this.composer.renderTarget2,
      ]) {
        target.samples = samples;
        target.dispose();
      }
      this.sampleCount = samples;
    }
    this.look.uniforms.grain.value = settings.grain;

    const az = (settings.keyAzimuth * Math.PI) / 180,
      el = (settings.keyElevation * Math.PI) / 180;
    this.key.target.position.set(camera.target[0], camera.target[1], 0);
    this.key.position.set(
      camera.target[0] + Math.cos(az) * 16,
      camera.target[1] + Math.sin(az) * 16,
      Math.tan(el) * 13,
    );
    const shadowExtent = Math.max(12, camera.distance * 0.6);
    this.key.shadow.camera.left = -shadowExtent;
    this.key.shadow.camera.right = shadowExtent;
    this.key.shadow.camera.top = shadowExtent;
    this.key.shadow.camera.bottom = -shadowExtent;
    this.key.shadow.camera.updateProjectionMatrix();
    this.key.intensity = settings.keyIntensity;
    this.key.color.set(settings.keyColor);
    this.key.shadow.radius = settings.softness;
    this.ambient.intensity = settings.ambient;
    this.fill.intensity = settings.ambient * 0.8;
    const size =
      settings.quality === "ultra"
        ? 4096
        : settings.quality === "studio"
          ? 2048
          : 1024;
    if (this.key.shadow.mapSize.x !== size) {
      this.key.shadow.mapSize.set(size, size);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
    for (const l of play ? f.lights : p.lights) {
      const light = this.lights.get(l.id);
      if (!light) continue;
      const host = p.items.find((o) => o.id === l.hostId);
      const target = host
        ? localToWorld(play ? f.transforms.get(host.id)! : host, l.local)
        : l.target;
      light.position.set(...l.position);
      light.target.position.set(...target);
      light.color.set(l.color);
      light.intensity = l.enabled ? l.intensity : 0;
      light.angle = (l.angle * Math.PI) / 180;
      light.penumbra = l.penumbra;
      light.distance = l.distance;
      light.decay = l.decay;
      const gobo = l.gobo && l.gobo !== "none" ? l.gobo : undefined;
      if (gobo) {
        const signature = JSON.stringify([gobo, l.goboRotation, l.goboScale]);
        let cookie = this.cookies.get(l.id);
        if (cookie?.signature !== signature) {
          cookie?.texture.dispose();
          cookie = {
            signature,
            texture: goboTexture(gobo, l.goboRotation ?? 0, l.goboScale ?? 1),
          };
          this.cookies.set(l.id, cookie);
        }
        light.map = cookie.texture;
      } else light.map = null;
      light.castShadow = l.shadow || Boolean(gobo);
      // Cookie projection needs the shadow camera, while occlusion can still be disabled independently.
      light.shadow.intensity = l.shadow ? 1 : 0;
      const spotSize =
        settings.quality === "draft"
          ? 1024
          : settings.quality === "ultra"
            ? 4096
            : 2048;
      if (light.shadow.mapSize.x !== spotSize) {
        light.shadow.mapSize.set(spotSize, spotSize);
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }

      light.shadow.radius = settings.softness;
      light.shadow.camera.far = Math.max(10, l.distance);
    }
    this.cameraPose(
      camera,
      output ? ratio(settings.aspect) : this.width / this.height,
    );
    this.grid.visible = !output && mode === "build" && settings.grid;
    this.helpers.visible = !output && mode === "build";
    this.selection.visible = !output && mode === "build";
    this.renderer.toneMappingExposure = settings.exposure;
    this.bokeh.enabled = settings.dof > 0 && settings.quality !== "draft";
    const focus = new T.Vector3(...camera.target)
        .sub(this.camera.position)
        .dot(this.camera.getWorldDirection(new T.Vector3())),
      uniforms = this.bokeh.uniforms as Record<string, T.IUniform>;
    uniforms.focus.value = Math.max(0.1, focus + settings.focusOffset);
    uniforms.aperture.value = settings.dof * 0.014;
    uniforms.maxblur.value = 0.022;
    uniforms.aspect.value = this.camera.aspect;
    this.look.uniforms.seed.value = Math.floor(time * 24) * 0.01;
    this.scene.updateMatrixWorld(true);
    this.composer.render();
  }
  pick(clientX: number, clientY: number): Hit | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect(),
      mouse = new T.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      );
    this.ray.setFromCamera(mouse, this.camera);
    const targets = [
      ...this.objects.values(),
      ...this.pins.values(),
      ...this.ropes.values(),
      ...this.marks.values(),
      ...(this.mode === "build" ? this.helpers.children : []),
    ].filter((g) => g.visible);
    const hits = this.ray.intersectObjects(targets, true);
    const hit = hits.find((h) => h.object.userData.id && h.object.visible);
    if (!hit) return;
    return {
      id: hit.object.userData.id,
      kind: hit.object.userData.kind,
      point: hit.point.toArray() as V3,
    };
  }
  boardPoint(clientX: number, clientY: number, z = 0.04): V3 | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new T.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const p = this.ray.ray.intersectPlane(
      new T.Plane(new T.Vector3(0, 0, 1), -z),
      new T.Vector3(),
    );
    return p?.toArray() as V3 | undefined;
  }
  screenPoint(p: V3) {
    const v = new T.Vector3(...p).project(this.camera),
      r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: r.left + ((v.x + 1) / 2) * r.width,
      y: r.top + ((-v.y + 1) / 2) * r.height,
    };
  }
  audit() {
    const gl = this.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    let caster = 0,
      receiver = 0;
    this.scene.traverse((n) => {
      if (n instanceof T.Mesh && n.castShadow) caster++;
      if (n instanceof T.Mesh && n.receiveShadow) receiver++;
    });
    return {
      samples: this.sampleCount,
      renderScale: this.previewScale,
      focus: (this.bokeh.uniforms as Record<string, T.IUniform>).focus.value,
      aperture: (this.bokeh.uniforms as Record<string, T.IUniform>).aperture
        .value,
      cookies: [...this.lights.values()].filter((l) => l.map).length,
      sheets: [...this.objects.values()].filter(
        (g) => g.children.length === 1 && g.children[0].userData.paper,
      ).length,
      engine: `Three.js r${T.REVISION} / WebGL2`,
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      shadowCasters: caster,
      shadowReceivers: receiver,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      dof: this.bokeh.enabled,
      contextLost: gl.isContextLost(),
    };
  }
  async png(
    p: Project,
    time: number,
    mode: Mode,
    width = 1920,
    supersample = 1,
    quality?: Project["settings"]["quality"],
  ) {
    const aspect = ratio(p.settings.aspect),
      height = Math.round(width / aspect),
      w = this.width,
      h = this.height,
      pixel = this.renderer.getPixelRatio();
    const previousOverride = { ...this.renderSettings };
    this.renderSettings = {
      ...this.renderSettings,
      quality:
        quality ??
        (supersample > 1
          ? "ultra"
          : (this.renderSettings.quality ?? p.settings.quality)),
    };
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width * supersample, height * supersample, false);
      this.composer.setPixelRatio(1);
      this.composer.setSize(width * supersample, height * supersample);
      this.renderAt(p, time, mode, undefined, true);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(this.renderer.domElement, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(Error("PNG 编码失败"))),
          "image/png",
        ),
      );
      return blob;
    } finally {
      this.renderSettings = previousOverride;
      this.renderer.setPixelRatio(pixel);
      this.composer.setPixelRatio(pixel);
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
      this.renderAt(p, time, mode);
    }
  }
}
