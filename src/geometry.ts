import { moduleByKind } from "./catalog";
import * as T from "three";
import { ropePoint } from "./story";
import type { Item, Rope, V3 } from "./model";
import type { Materials } from "./materials";
export function physical<
  G extends T.BufferGeometry,
  M extends T.Material | T.Material[],
>(geometry: G, material: M) {
  const mesh = new T.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export function paperSurface(o: Item, x: number, y: number) {
  const u = Math.max(-0.5, Math.min(0.5, x / o.width)),
    v = Math.max(-0.5, Math.min(0.5, y / o.height));
  return (
    0.007 +
    ((Math.pow(Math.abs(u) * 2, 8) * 0.018 +
      Math.pow(Math.abs(v) * 2, 10) * 0.01) *
      (o.kind === "note" ? 1.5 : 1) +
      Math.sin(u * 2.3 + v * 1.2) * 0.002) *
      (o.paperCurl ?? 1)
  );
}
/** One closed sheet; back and edge share the front curvature. */
export function paperGeometry(o: Item) {
  const n = 32,
    top = new T.PlaneGeometry(o.width, o.height, n, n);
  const pos = top.attributes.position,
    uv = top.attributes.uv;
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let side = 0; side < 2; side++)
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i),
        y = pos.getY(i);
      if (
        (o.kind === "news" || o.kind === "label") &&
        (Math.abs(x) >= o.width / 2 - 0.001 ||
          Math.abs(y) >= o.height / 2 - 0.001)
      ) {
        x += Math.sin(i * 3.8) * 0.009;
        y += Math.sin(i * 6.2) * 0.007;
      }
      vertices.push(x, y, paperSurface(o, x, y) - side * 0.006);
      uvs.push(uv.getX(i), uv.getY(i));
    }
  const front = Array.from(top.index!.array);
  indices.push(...front);
  for (let i = 0; i < front.length; i += 3)
    indices.push(
      front[i + 2] + pos.count,
      front[i + 1] + pos.count,
      front[i] + pos.count,
    );
  const edge: number[] = [];
  for (let x = 0; x <= n; x++) edge.push(x);
  for (let y = 1; y <= n; y++) edge.push(y * (n + 1) + n);
  for (let x = n - 1; x >= 0; x--) edge.push(n * (n + 1) + x);
  for (let y = n - 1; y > 0; y--) edge.push(y * (n + 1));
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i],
      b = edge[(i + 1) % edge.length],
      c = a + pos.count,
      d = b + pos.count;
    indices.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.addGroup(0, front.length, 0);
  g.addGroup(front.length, indices.length - front.length, 1);
  g.computeVertexNormals();
  g.userData.base = new Float32Array(vertices);
  top.dispose();
  return g;
}
export function deformPaper(mesh: T.Mesh, o: Item, q: number, strength = 1) {
  if (mesh.userData.peel === q && mesh.userData.peelStrength === strength)
    return;
  const pos = mesh.geometry.attributes.position,
    base = mesh.geometry.userData.base as Float32Array | undefined;
  if (!base) return;
  for (let i = 0; i < pos.count; i++) {
    const y = base[i * 3 + 1],
      v = y / o.height + 0.5,
      angle = Math.min(2.5, (1 - q) * 1.5 * strength);
    const radius = angle > 0.00001 ? o.height / angle : 0;
    pos.setXYZ(
      i,
      base[i * 3],
      angle > 0.00001 ? -o.height / 2 + Math.sin(v * angle) * radius : y,
      base[i * 3 + 2] +
        (angle > 0.00001 ? (1 - Math.cos(v * angle)) * radius : 0),
    );
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.userData.peel = q;
  mesh.userData.peelStrength = strength;
}
export function createItem(o: Item, mat: Materials) {
  const metal = () => {
    const m = mat.metal.clone();
    m.color.set(o.kind === "staple" ? o.color : "#a6aaa5");
    m.roughness = o.roughness ?? 0.24;
    return m;
  };
  const g = new T.Group();
  g.name = o.id;
  g.userData = { id: o.id, kind: "item" };
  if (o.kind === "pin") {
    g.add(pinMesh(o.color, mat, o.roughness));
  } else if (o.kind === "clip") {
    const spring = new T.Shape();
    spring.moveTo(-0.025, -0.14);
    spring.lineTo(-0.23, -0.14);
    spring.lineTo(-0.055, 0.11);
    spring.lineTo(-0.025, 0.11);
    spring.closePath();
    const body = physical(
      new T.ExtrudeGeometry(spring, {
        depth: 0.58,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.012,
        bevelThickness: 0.008,
      }),
      new T.MeshStandardMaterial({
        color: o.color,
        metalness: 0.74,
        roughness: o.roughness ?? 0.35,
      }),
    );
    body.rotation.y = Math.PI / 2;
    body.position.x = -0.29;
    g.add(body);
    const jawMaterial = new T.MeshStandardMaterial({
      color: o.color,
      metalness: 0.7,
      roughness: o.roughness ?? 0.3,
    });
    const lower = physical(new T.BoxGeometry(0.58, 0.14, 0.015), jawMaterial);
    lower.position.set(0, 0.1, 0.016);
    g.add(lower);
    const jaw = new T.Group();
    jaw.userData.clipJaw = true;
    jaw.position.set(0, -0.02, 0.028);
    const upper = physical(new T.BoxGeometry(0.58, 0.2, 0.015), jawMaterial);
    upper.position.y = 0.12;
    jaw.add(upper);
    g.add(jaw);
    for (const side of [-1, 1]) {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(-0.18, 0.07, side * 0.04 + 0.13),
        new T.Vector3(-0.2, 0.42, side * 0.04 + 0.14),
        new T.Vector3(0, 0.52, side * 0.04 + 0.14),
        new T.Vector3(0.2, 0.42, side * 0.04 + 0.14),
        new T.Vector3(0.18, 0.07, side * 0.04 + 0.13),
      ]);
      const handle = physical(
        new T.TubeGeometry(curve, 48, 0.02, 12, false),
        metal(),
      );
      handle.userData.clipHandle = true;
      g.add(handle);
    }
  } else if (o.kind === "staple") {
    const points = [
      [-0.08, 0.34, 0],
      [-0.1, -0.26, 0],
      [0.08, -0.33, 0],
      [0.1, 0.32, 0],
      [-0.02, 0.37, 0],
      [-0.04, -0.16, 0],
      [0.045, -0.21, 0],
      [0.05, 0.23, 0],
    ].map((p) => new T.Vector3(p[0], p[1], 0.035));
    g.add(
      physical(
        new T.TubeGeometry(new T.CatmullRomCurve3(points), 90, 0.014, 8, false),
        metal(),
      ),
    );
  } else if (o.kind === "tape") {
    const m = new T.MeshPhysicalMaterial({
      color: o.color,
      roughness: o.roughness ?? 0.7,
      transparent: true,
      opacity: 0.72,
      bumpMap: mat.paper,
      bumpScale: 0.0005 * (o.fiberStrength ?? 1),
      metalness: 0,
      side: T.FrontSide,
    });
    const mesh = physical(paperGeometry(o), [m, m]);
    mesh.userData.paper = true;
    g.add(mesh);
  } else {
    const m = mat.paperMaterial(o);
    if (o.kind === "stamp")
      g.add(physical(new T.PlaneGeometry(o.width, o.height), m));
    else {
      const back = new T.MeshStandardMaterial({
        color: o.color,
        roughness: 0.97,
        bumpMap: mat.paper,
        bumpScale: 0.0006,
      });
      const sheet = physical(paperGeometry(o), [m, back]);
      sheet.userData.paper = true;
      g.add(sheet);
    }
  }
  g.traverse((n) => {
    if (n instanceof T.Mesh)
      n.userData = { ...n.userData, id: o.id, kind: "item" };
  });
  if (["clip", "pin", "staple"].includes(o.kind)) {
    const spec = moduleByKind(o.kind);
    g.userData.dimensionScale = [
      o.width / spec.width,
      o.height / spec.height,
      1,
    ];
  }
  return g;
}
export function pinMesh(color: string, mat: Materials, roughness = 0.26) {
  const g = new T.Group();
  const plastic = mat.plastic.clone();
  plastic.color.set(color);
  plastic.roughness = roughness;
  const profile = [
    new T.Vector2(0.072, 0),
    new T.Vector2(0.095, 0.025),
    new T.Vector2(0.083, 0.045),
    new T.Vector2(0.038, 0.08),
    new T.Vector2(0.039, 0.16),
    new T.Vector2(0.1, 0.19),
    new T.Vector2(0.102, 0.22),
    new T.Vector2(0.073, 0.245),
    new T.Vector2(0, 0.25),
  ];
  const head = physical(new T.LatheGeometry(profile, 48), plastic);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.035;
  g.add(head);
  const shaft = physical(
    new T.CylinderGeometry(0.013, 0.009, 0.19, 10),
    mat.metal,
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.005;
  g.add(shaft);
  return g;
}
export class RopeCurve extends T.Curve<T.Vector3> {
  constructor(
    public a: V3,
    public b: V3,
    public rope: Rope,
    public strand = -1,
  ) {
    super();
  }
  getPoint(t: number, target = new T.Vector3()) {
    const p = ropePoint(
      this.a,
      this.b,
      this.rope.slack,
      this.rope.bend,
      t,
      this.rope.control,
    );
    target.set(...p);
    if (this.strand >= 0) {
      const d = Math.hypot(this.b[0] - this.a[0], this.b[1] - this.a[1]) || 1,
        angle = t * d * 52 + (this.strand * Math.PI * 2) / 3,
        r = this.rope.radius * 0.42;
      target.x += (-(this.b[1] - this.a[1]) / d) * Math.cos(angle) * r;
      target.y += ((this.b[0] - this.a[0]) / d) * Math.cos(angle) * r;
      target.z += Math.sin(angle) * r;
    }
    return target;
  }
}
class FiberCurve extends RopeCurve {
  constructor(
    a: V3,
    b: V3,
    r: Rope,
    strand: number,
    public phase: number,
  ) {
    super(a, b, r, strand);
  }
  getPoint(t: number, target = new T.Vector3()) {
    super.getPoint(t, target);
    const d = Math.hypot(this.b[0] - this.a[0], this.b[1] - this.a[1]) || 1,
      twist = t * d * 170 + this.phase,
      offset = Math.sin(twist) * this.rope.radius * 0.67;
    target.z += Math.cos(twist) * this.rope.radius * 0.67;
    target.x += (-(this.b[1] - this.a[1]) / d) * offset;
    target.y += ((this.b[0] - this.a[0]) / d) * offset;
    return target;
  }
}
export function ropeMesh(rope: Rope, a: V3, b: V3, mat: Materials) {
  const group = new T.Group();
  group.userData = { id: rope.id, kind: "rope" };
  const length = new T.Vector3(...a).distanceTo(new T.Vector3(...b)),
    segments = Math.min(1200, Math.max(64, Math.round(length * 70)));
  const m = new T.MeshStandardMaterial({
    color: rope.color,
    roughness: rope.style === "nylon" ? 0.45 : 0.94,
    bumpMap: mat.rope,
    bumpScale: 0.0015,
    metalness: 0,
  });
  for (let i = 0; i < 3; i++) {
    const geom = new T.TubeGeometry(
      new RopeCurve(a, b, rope, i),
      segments,
      rope.radius * 0.61,
      10,
      false,
    );
    const mesh = physical(geom, m);
    mesh.userData = { id: rope.id, kind: "rope", segments };
    group.add(mesh);
  }
  if (rope.style !== "nylon") {
    const fiberMat = new T.MeshStandardMaterial({
      color: new T.Color(rope.color).multiplyScalar(1.15),
      roughness: 1,
    });
    for (let i = 0; i < 6; i++) {
      const geometry = new T.TubeGeometry(
          new FiberCurve(a, b, rope, i % 3, i * 2.3),
          segments,
          rope.radius * 0.065,
          4,
          false,
        ),
        fiber = physical(geometry, fiberMat);
      fiber.userData = { id: rope.id, kind: "rope", segments };
      group.add(fiber);
    }
  }
  return group;
}
/** Flat ink ribbon, no cylindrical volume or cast shadow. UV alpha simulates dry pigment. */
export function markMesh(
  points: V3[],
  color: string,
  radius: number,
  brush = "ink",
  host?: Item,
) {
  const g = new T.Group();
  if (points.length < 2) return g;
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  const segments = Math.max(32, points.length * 3),
    verts: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d")!,
    data = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 64; x++) {
      const k = (y * 64 + x) * 4,
        edge = Math.min(x, 63 - x) / 8;
      const noise = ((x * 17 + y * 97) % 113) / 113;
      const alpha =
        Math.min(1, edge) *
        (brush === "pencil"
          ? 0.25 + noise * 0.6
          : brush === "brush"
            ? 0.6 + noise * 0.4
            : 0.95);
      data.data[k] =
        data.data[k + 1] =
        data.data[k + 2] =
          Math.round(alpha * 255);
      data.data[k + 3] = 255;
    }
  ctx.putImageData(data, 0, 0);
  const mask = new T.CanvasTexture(c);
  mask.wrapT = T.RepeatWrapping;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      p = curve.getPoint(t),
      d = curve.getTangent(t);
    const len = Math.hypot(d.x, d.y) || 1;
    const pressure =
      brush === "brush"
        ? 0.35 + 0.65 * Math.sin(Math.PI * t)
        : 0.87 + 0.13 * Math.sin(t * 37);
    const width = radius * (brush === "marker" ? 4 : 1) * pressure;
    for (const side of [-1, 1]) {
      const x = p.x - (d.y / len) * width * side,
        y = p.y + (d.x / len) * width * side;
      verts.push(x, y, (host ? paperSurface(host, x, y) : 0.006) + 0.0012);
      uv.push(side === -1 ? 0 : 1, t * 8);
    }
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  geometry.userData.base = new Float32Array(verts);
  const material = new T.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    alphaMap: mask,
    transparent: true,
    opacity: brush === "marker" ? 0.36 : 1,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: T.DoubleSide,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.segments = segments;
  g.add(mesh);
  return g;
}
export function disposeTree(
  root: T.Object3D,
  shared: Set<T.Material> = new Set(),
) {
  const disposed = new Set<T.Material>();
  root.traverse((n) => {
    if (n instanceof T.Mesh || n instanceof T.Line) {
      n.geometry.dispose();
      for (const m of Array.isArray(n.material) ? n.material : [n.material])
        if (!shared.has(m) && !disposed.has(m)) {
          disposed.add(m);
          if ("map" in m) (m as T.MeshStandardMaterial).map?.dispose();
          if (m instanceof T.MeshStandardMaterial) m.roughnessMap?.dispose();
          if (m instanceof T.MeshStandardMaterial) m.alphaMap?.dispose();
          if (m instanceof T.MeshPhysicalMaterial) m.clearcoatMap?.dispose();
          m.dispose();
        }
    }
  });
  root.removeFromParent();
}
