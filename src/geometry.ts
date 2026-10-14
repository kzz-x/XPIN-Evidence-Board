import * as T from "three";
import { ropePoint } from "./story";
import type { Item, Rope, V3 } from "./model";
import { Materials } from "./materials";
export function physical<
  G extends T.BufferGeometry,
  M extends T.Material | T.Material[],
>(geometry: G, material: M) {
  const mesh = new T.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export function paperGeometry(o: Item, back = false) {
  const g = new T.PlaneGeometry(o.width, o.height, 22, 22),
    pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      u = x / o.width,
      v = y / o.height;
    let z =
      0.018 +
      (Math.pow(Math.abs(u) * 2, 8) * 0.026 +
        Math.pow(Math.abs(v) * 2, 10) * 0.012) *
        (o.kind === "note" ? 1.5 : 1);
    z += Math.sin(u * 2.3 + v * 1.2) * 0.003;
    if (back) z -= 0.015;
    if (o.kind === "label" || o.kind === "news") {
      const edge = Math.max(Math.abs(u) * 2, Math.abs(v) * 2);
      if (edge > 0.99) {
        pos.setX(i, x + Math.sin(i * 3.8) * 0.025);
        pos.setY(i, y + Math.sin(i * 6.2) * 0.02);
      }
    }
    pos.setZ(i, z);
  }
  if (back) g.scale(1, 1, -1);
  g.computeVertexNormals();
  return g;
}
export function createItem(o: Item, mat: Materials) {
  const g = new T.Group();
  g.name = o.id;
  g.userData = { id: o.id, kind: "item" };
  if (o.kind === "pin") {
    g.add(pinMesh(o.color, mat));
  } else if (o.kind === "clip") {
    const body = physical(
      new T.BoxGeometry(0.58, 0.29, 0.27),
      new T.MeshStandardMaterial({
        color: o.color,
        metalness: 0.74,
        roughness: 0.35,
      }),
    );
    body.position.z = 0.14;
    g.add(body);
    for (const side of [-1, 1]) {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(-0.18, 0.07, side * 0.04 + 0.13),
        new T.Vector3(-0.2, 0.42, side * 0.04 + 0.14),
        new T.Vector3(0, 0.52, side * 0.04 + 0.14),
        new T.Vector3(0.2, 0.42, side * 0.04 + 0.14),
        new T.Vector3(0.18, 0.07, side * 0.04 + 0.13),
      ]);
      g.add(physical(new T.TubeGeometry(curve, 28, 0.02, 8, false), mat.metal));
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
        mat.metal,
      ),
    );
  } else if (o.kind === "tape") {
    g.add(
      physical(
        new T.BoxGeometry(o.width, o.height, 0.012),
        new T.MeshPhysicalMaterial({
          color: o.color,
          roughness: 0.58,
          transparent: true,
          opacity: 0.65,
          bumpMap: mat.paper,
          bumpScale: 0.008,
          metalness: 0,
          depthWrite: false,
        }),
      ),
    );
    g.position.z = 0.01;
  } else {
    const m = mat.paperMaterial(o),
      top = physical(paperGeometry(o), m);
    g.add(top);
    if (o.kind !== "stamp") {
      const back = physical(
        new T.BoxGeometry(o.width * 0.999, o.height * 0.999, 0.014),
        new T.MeshStandardMaterial({
          color: o.color,
          roughness: 0.93,
          bumpMap: mat.paper,
          bumpScale: 0.008,
        }),
      );
      back.position.z = -0.008;
      g.add(back);
    }
  }
  g.traverse((n) => {
    if (n instanceof T.Mesh) n.userData = { id: o.id, kind: "item" };
  });
  return g;
}
export function pinMesh(color: string, mat: Materials) {
  const g = new T.Group();
  const plastic = mat.plastic.clone();
  plastic.color.set(color);
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
  const head = physical(new T.LatheGeometry(profile, 24), plastic);
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
export function markMesh(points: V3[], color: string, radius: number) {
  const g = new T.Group();
  if (points.length < 2) return g;
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
    segments = Math.max(16, points.length * 2);
  const m = physical(
    new T.TubeGeometry(curve, segments, radius, 5, false),
    new T.MeshStandardMaterial({ color, roughness: 0.94 }),
  );
  m.userData.segments = segments;
  g.add(m);
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
          if (m instanceof T.MeshPhysicalMaterial) m.clearcoatMap?.dispose();
          m.dispose();
        }
    }
  });
  root.removeFromParent();
}
