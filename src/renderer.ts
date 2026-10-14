import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Materials } from "./materials";
import {
  createItem,
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
  gizmoLight?: string;
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
      new T.BoxGeometry(2000, 1500, 0.4),
      this.materials.board("felt"),
    );
    this.board.position.z = -0.205;
    this.scene.add(this.board);
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
    this.key.shadow.normalBias = 0.006;
    this.scene.add(this.key, this.key.target, this.ambient);
    this.fill.position.set(10, -4, 8);
    this.scene.add(this.fill);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.z = 0.005;
    this.grid.visible = false;
    this.scene.add(this.helpers, this.selection, this.grid);
    this.composer = new EffectComposer(this.renderer);
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
      ]);
      if (this.signatures.get(o.id) !== signature) {
        const old = this.objects.get(o.id);
        if (old) disposeTree(old, new Set([this.materials.metal]));
        const g = createItem(o, this.materials);
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
        g = pinMesh(pin.color, this.materials);
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
          )
            n.material.color.set(pin.color);
        });
      }
    }
    for (const [id, g] of this.marks)
      if (!p.marks.some((m) => m.id === id)) {
        disposeTree(g);
        this.marks.delete(id);
      }
    for (const m of p.marks) {
      const signature = JSON.stringify([m.points, m.color, m.radius]);
      let g = this.marks.get(m.id);
      if (!g || g.userData.signature !== signature) {
        if (g) disposeTree(g);
        g = markMesh(m.points, m.color, m.radius);
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
        light.shadow.normalBias = 0.006;
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
      g.scale.setScalar(tr.scale);
      g.visible = play ? f.visible.get(o.id)! : !o.hidden;
      const typing = p.shots.some((s) =>
          s.actions.some((a) => a.targetId === o.id && a.type === "type"),
        ),
        q = play ? (f.progress.get(o.id) ?? 1) : 1;
      if (typing) {
        const chars = Math.floor((o.title.length + o.body.length) * q);
        if (g.userData.typed !== chars) {
          const material = (g.children[0] as T.Mesh)
            .material as T.MeshStandardMaterial;
          if (material.map) {
            material.map.dispose();
            material.map = this.materials.content({
              ...o,
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
      g.position.z += (1 - q) * 0.8;
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
        if (n instanceof T.Mesh)
          n.geometry.setDrawRange(
            0,
            Math.floor(((n.geometry.index?.count ?? 0) * q) / 30) * 30,
          );
      });
    }
    const settings = p.settings;
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
      light.castShadow = l.shadow;
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
    uniforms.aperture.value = settings.dof * 0.0006;
    uniforms.maxblur.value = 0.012;
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
  async png(p: Project, time: number, mode: Mode, width = 1920) {
    const aspect = ratio(p.settings.aspect),
      height = Math.round(width / aspect),
      w = this.width,
      h = this.height,
      pixel = this.renderer.getPixelRatio();
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.composer.setPixelRatio(1);
      this.composer.setSize(width, height);
      this.renderAt(p, time, mode, undefined, true);
      const blob = await new Promise<Blob>((resolve, reject) =>
        this.renderer.domElement.toBlob(
          (b) => (b ? resolve(b) : reject(Error("PNG 编码失败"))),
          "image/png",
        ),
      );
      return blob;
    } finally {
      this.renderer.setPixelRatio(pixel);
      this.composer.setPixelRatio(pixel);
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
      this.renderAt(p, time, mode);
    }
  }
}
