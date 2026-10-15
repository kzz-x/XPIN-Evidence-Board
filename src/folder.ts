import * as T from "three";
import { physical } from "./mesh";
import {
  folderCover,
  folderSettings,
  paperSurface,
  paperSeed,
} from "./paper-profile";
import type { Item } from "./model";
import type { Materials } from "./materials";
export function folderMesh(
  o: Item,
  mat: Materials,
  paperGeometry: (o: Item, thickness?: number) => T.BufferGeometry,
) {
  const g = new T.Group(),
    { depth, angle } = folderSettings(o),
    w = o.width,
    h = o.height,
    r = 0.035;
  const card = new T.MeshPhysicalMaterial({
    color: o.color,
    roughness: o.roughness ?? 0.9,
    bumpMap: mat.paperFinish,
    bumpScale: 0.0012,
    roughnessMap: mat.paperFinish,
    sheen: 0.14,
    sheenColor: new T.Color("#c9b286"),
  });
  const shape = new T.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(w * 0.43, h / 2);
  shape.lineTo(w * 0.43, h * 0.56);
  shape.quadraticCurveTo(w * 0.43, h * 0.58, w * 0.41, h * 0.58);
  shape.lineTo(w * 0.14, h * 0.58);
  shape.quadraticCurveTo(w * 0.12, h * 0.58, w * 0.12, h * 0.56);
  shape.lineTo(w * 0.12, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const backSpec = { ...o, kind: "file" as const },
    backGeo = new T.ExtrudeGeometry(shape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelSize: 0.002,
      bevelThickness: 0.002,
      bevelSegments: 2,
      curveSegments: 24,
    }),
    pos = backGeo.attributes.position;
  for (let i = 0; i < pos.count; i++)
    pos.setZ(
      i,
      pos.getZ(i) - 0.016 + paperSurface(backSpec, pos.getX(i), pos.getY(i)),
    );
  backGeo.computeVertexNormals();
  backGeo.userData.base = new Float32Array(pos.array);
  const back = physical(backGeo, card);
  back.name = "Tabbed cardstock back";
  back.userData.paper = true;
  back.userData.paperSpec = backSpec;
  g.add(back);
  for (let i = 0; i < 5; i++) {
    const spec: Item = {
      ...o,
      id: o.id + "-leaf-" + i,
      kind: "file",
      width: w * 0.92,
      height: h * 0.88,
      wear: 0.18,
      edgeTear: 0.25,
      wearSeed: (paperSeed(o) + i * 17) % 2147483647,
      paperCurl: 0.3,
    };
    const material = new T.MeshStandardMaterial({
      color: i % 2 ? "#dfd7c0" : "#ece5d2",
      roughness: 0.92,
      bumpMap: mat.paperFinish,
      bumpScale: 0.0007,
    });
    const leaf = physical(paperGeometry(spec), material);
    leaf.position.set(
      0.01 * (i - 2),
      -0.025 * h,
      depth * 0.18 + i * depth * 0.145,
    );
    leaf.name = "Individual document leaf " + (i + 1);
    leaf.userData.paper = true;
    leaf.userData.paperSpec = spec;
    g.add(leaf);
  }
  const cover = folderCover(o),
    hinge = new T.Group();
  hinge.position.set(-w * 0.49, -h * 0.02, depth);
  hinge.rotation.y = -angle;
  const front = physical(paperGeometry(cover, 0.016), [
    mat.paperMaterial(o),
    card,
  ]);
  front.position.x = cover.width / 2;
  front.name = "Raised front cover";
  front.userData.paper = true;
  front.userData.paperSpec = cover;
  hinge.add(front);
  g.add(hinge);
  const spine = physical(
    new T.CylinderGeometry(0.016, 0.016, h * 0.94, 24),
    card,
  );
  spine.position.set(-w * 0.49, -h * 0.02, depth * 0.5);
  spine.name = "Folded cardstock spine";
  g.add(spine);
  return g;
}
