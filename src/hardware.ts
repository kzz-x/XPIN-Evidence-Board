import * as T from "three";
import { physical } from "./mesh";
import type { Item } from "./model";
import type { Materials } from "./materials";
function cappedWire(
  curve: T.Curve<T.Vector3>,
  radius: number,
  material: T.Material,
  segments = 160,
) {
  const g = new T.Group();
  g.add(
    physical(new T.TubeGeometry(curve, segments, radius, 24, false), material),
  );
  for (const t of [0, 1]) {
    const cap = physical(new T.SphereGeometry(radius, 24, 12), material);
    cap.position.copy(curve.getPoint(t));
    g.add(cap);
  }
  return g;
}
export function binderClip(o: Item, mat: Materials) {
  const g = new T.Group();
  g.name = "Folded spring-steel binder clip";
  const enamel = new T.MeshPhysicalMaterial({
    color: o.color,
    metalness: 0.62,
    roughness: o.roughness ?? 0.31,
    roughnessMap: mat.metalFinish,
    bumpMap: mat.metalFinish,
    bumpScale: 0.00007,
    clearcoat: 0.38,
    clearcoatRoughness: 0.24,
    envMapIntensity: 1.5,
  });
  // A real thin folded strip with an open mouth, rather than a filled triangular wedge.
  const outline = [
    [0.18, 0.016],
    [-0.135, 0.016],
    [-0.151, 0.03],
    [-0.091, 0.22],
    [-0.073, 0.232],
    [0.003, 0.232],
    [0.02, 0.22],
    [0.182, 0.066],
    [0.182, 0.056],
    [0.012, 0.214],
    [-0.001, 0.222],
    [-0.072, 0.222],
    [-0.082, 0.214],
    [-0.14, 0.032],
    [-0.131, 0.026],
    [0.18, 0.026],
  ];
  const shape = new T.Shape(outline.map(([y, z]) => new T.Vector2(y, z)));
  const geo = new T.ExtrudeGeometry(shape, {
    depth: 0.57,
    bevelEnabled: true,
    bevelSize: 0.0025,
    bevelThickness: 0.0025,
    bevelSegments: 4,
    steps: 1,
  });
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getX(i),
      z = p.getY(i),
      x = p.getZ(i) - 0.285;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const shell = physical(geo, enamel);
  shell.name = "Hollow folded steel shell";
  g.add(shell);
  const steel = mat.metal.clone();
  steel.roughness = o.roughness ?? 0.22;
  const hem = (z: number) => {
    const m = physical(new T.CylinderGeometry(0.009, 0.009, 0.58, 24), enamel);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, 0.178, z);
    return m;
  };
  g.add(hem(0.021));
  const jaw = new T.Group();
  jaw.userData.clipJaw = true;
  jaw.position.set(0, -0.025, 0.223);
  const upperHem = hem(0.061);
  upperHem.position.sub(jaw.position);
  jaw.add(upperHem);
  g.add(jaw);
  for (const [side, z] of [
    [1, 0.074],
    [-1, 0.029],
  ]) {
    const pivot = new T.Group();
    pivot.position.set(0, 0.158, z);
    pivot.userData.clipHandle = true;
    pivot.userData.clipSign = side;
    const path = new T.CurvePath<T.Vector3>(),
      v = (x: number, y: number) => new T.Vector3(x, y, 0);
    path.add(new T.LineCurve3(v(-0.195, 0), v(-0.195, 0.31)));
    path.add(
      new T.CubicBezierCurve3(
        v(-0.195, 0.31),
        v(-0.195, 0.42),
        v(-0.12, 0.445),
        v(0, 0.445),
      ),
    );
    path.add(
      new T.CubicBezierCurve3(
        v(0, 0.445),
        v(0.12, 0.445),
        v(0.195, 0.42),
        v(0.195, 0.31),
      ),
    );
    path.add(new T.LineCurve3(v(0.195, 0.31), v(0.195, 0)));
    pivot.add(cappedWire(path, 0.012, steel, 192));
    g.add(pivot);
    for (const x of [-0.195, 0.195]) {
      const sleeve = new T.Shape();
      sleeve.absarc(0, 0, 0.021, 0, Math.PI * 2, false);
      const hole = new T.Path();
      hole.absarc(0, 0, 0.0135, 0, Math.PI * 2, true);
      sleeve.holes.push(hole);
      const barrel = physical(
        new T.ExtrudeGeometry(sleeve, {
          depth: 0.075,
          bevelEnabled: true,
          bevelSize: 0.0015,
          bevelThickness: 0.0015,
          bevelSegments: 3,
          curveSegments: 24,
        }),
        enamel,
      );
      barrel.rotation.y = Math.PI / 2;
      barrel.position.set(x - 0.0375, 0.158, z);
      barrel.name = "Rolled hinge sleeve";
      g.add(barrel);
    }
  }
  return g;
}
export function paperClip(o: Item, mat: Materials) {
  const g = new T.Group(),
    path = new T.Path();
  path.moveTo(-0.045, 0.14);
  path.lineTo(-0.045, -0.205);
  path.absarc(0.025, -0.205, 0.07, Math.PI, Math.PI * 2, false);
  path.lineTo(0.095, 0.245);
  path.absarc(-0.015, 0.245, 0.11, 0, Math.PI, false);
  path.lineTo(-0.125, -0.265);
  path.absarc(0.015, -0.265, 0.14, Math.PI, Math.PI * 2, false);
  path.lineTo(0.155, 0.13);
  const points = path
    .getSpacedPoints(300)
    .map(
      (v, i) =>
        new T.Vector3(
          v.x,
          v.y,
          0.026 + 0.014 * Math.pow(Math.sin((i / 300) * Math.PI), 2),
        ),
    );
  const curve = new T.CatmullRomCurve3(points, false, "centripetal"),
    metal = mat.metal.clone();
  metal.color.set(o.color);
  metal.roughness = o.roughness ?? 0.22;
  metal.anisotropy = 0.5;
  const wire = cappedWire(curve, 0.0105, metal, 384);
  wire.name = "Continuous round-bent Gem wire";
  g.add(wire);
  return g;
}
