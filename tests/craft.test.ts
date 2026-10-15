import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  compileScene,
  clone,
  validateProject,
  paperPoint,
  paperSurface,
  paperThickness,
  liftToSurface,
  pinWorld,
  evaluate,
} from "../src/authoring";
import { paperGeometry, deformPaper } from "../src/geometry";
import { binderClip, paperClip } from "../src/hardware";
import { folderMesh } from "../src/folder";
import type { Materials } from "../src/materials";
const item = (kind = "photo") =>
  compileScene({
    format: "xpin-scene/1",
    items: [{ id: "test", kind: kind as "photo" }],
  }).items[0];
const fake = {
  metal: new T.MeshPhysicalMaterial({ metalness: 1 }),
  metalFinish: new T.Texture(),
  paperFinish: new T.Texture(),
  paperMaterial: () => new T.MeshPhysicalMaterial(),
} as unknown as Materials;

test("worn sheets stay closed with paired thickness, deterministic contour and restorable deformation", () => {
  for (const kind of ["photo", "file", "note", "news", "map", "label"]) {
    const o = item(kind);
    o.wear = 1;
    o.edgeTear = 1;
    o.wearSeed = 123;
    const g = paperGeometry(o),
      same = paperGeometry(clone(o)),
      pos = g.attributes.position;
    assert.deepEqual(pos.array, same.attributes.position.array);
    const edges = new Map<string, number>(),
      idx = g.index!.array;
    for (let i = 0; i < idx.length; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = idx[i + j],
          b = idx[i + ((j + 1) % 3)],
          k = a < b ? `${a}/${b}` : `${b}/${a}`;
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    assert.ok([...edges.values()].every((n) => n === 2));
    for (let i = 0; i < pos.count / 2; i++)
      assert.ok(
        Math.abs(
          pos.getZ(i) - pos.getZ(i + pos.count / 2) - paperThickness(o),
        ) < 1e-6,
      );
    const original = Array.from(pos.array),
      m = new T.Mesh(g);
    deformPaper(m, o, 0.3);
    deformPaper(m, o, 1);
    assert.deepEqual(Array.from(pos.array), original);
    assert.notDeepEqual(paperPoint(o, o.width / 2, 0), [o.width / 2, 0]);
    o.wear = 0;
    assert.deepEqual(paperPoint(o, o.width / 2, 0), [o.width / 2, 0]);
    g.dispose();
    same.dispose();
  }
});
test("wear seed changes geometric details without changing authored transform, and bad fields fail validation", () => {
  const p = compileScene({
    format: "xpin-scene/1",
    items: [
      {
        id: "photo",
        kind: "photo",
        wear: 0.7,
        edgeTear: 0.8,
        stainAmount: 0.4,
        wearSeed: 1,
      },
    ],
  });
  const before = clone(p.items[0]),
    a = paperPoint(before, before.width / 2, 0.1);
  p.items[0].wearSeed = 2;
  assert.notDeepEqual(paperPoint(p.items[0], before.width / 2, 0.1), a);
  assert.deepEqual(p.items[0].position, before.position);
  for (const fields of [
    { wear: NaN },
    { edgeTear: 2 },
    { stainAmount: -1 },
    { wearSeed: 1.5 },
    { folderDepth: 0 },
    { folderOpen: 36 },
  ]) {
    const bad = clone(p);
    Object.assign(bad.items[0], fields);
    assert.throws(() => validateProject(bad));
  }
});
test("binder clip is a hollow thin shell with real pivot handles and rolled hinge sleeves", () => {
  const g = binderClip(item("clip"), fake);
  g.updateMatrixWorld(true);
  const ray = new T.Raycaster(
    new T.Vector3(-1, 0, 0.12),
    new T.Vector3(1, 0, 0),
  );
  assert.equal(ray.intersectObject(g, true).length, 0);
  ray.ray.origin.set(-1, 0, 0.228);
  assert.ok(ray.intersectObject(g, true).length > 0);
  let pivots = 0,
    sleeves = 0;
  g.traverse((n) => {
    pivots += !!n.userData.clipHandle ? 1 : 0;
    sleeves += n.name === "Rolled hinge sleeve" ? 1 : 0;
    if (n instanceof T.Mesh) {
      assert.ok(n.castShadow && n.receiveShadow);
      assert.ok(
        Array.from(n.geometry.attributes.position.array).every(Number.isFinite),
      );
    }
  });
  assert.equal(pivots, 2);
  assert.equal(sleeves, 4);
});
test("paper clip has continuous rounded Gem wire, capped ends and nonzero spring lift", () => {
  const g = paperClip(item("staple"), fake),
    wire = g.children[0] as T.Group,
    mesh = wire.children[0] as T.Mesh;
  assert.equal(wire.children.length, 3);
  assert.ok(mesh.geometry.attributes.position.count > 8000);
  const box = new T.Box3().setFromObject(g);
  assert.ok(box.max.z - box.min.z > 0.03);
  assert.ok(box.max.y - box.min.y > 0.7);
});
test("folder has separate leaves, raised hinged cover and a native surface matching its geometry", () => {
  for (const open of [0, 4, 25, 35]) {
    const o = item("folder");
    o.folderOpen = open;
    const g = folderMesh(o, fake, paperGeometry);
    g.updateMatrixWorld(true);
    let leaves = 0,
      cover: T.Mesh | undefined;
    g.traverse((n) => {
      if (n.name.startsWith("Individual document leaf")) leaves++;
      if (n.name === "Raised front cover") cover = n as T.Mesh;
    });
    assert.equal(leaves, 5);
    assert.ok(cover);
    const pos = cover.geometry.attributes.position;
    for (const i of [32, 1020, 2112]) {
      const q = cover.localToWorld(new T.Vector3().fromBufferAttribute(pos, i));
      assert.ok(Math.abs(paperSurface(o, q.x, q.y) - q.z) < 0.003);
    }
    assert.ok(new T.Box3().setFromObject(g).max.z > 0.08);
  }
});
test("lifting samples curled undersides and folder-hosted pins sit on the raised cover without source mutation", () => {
  const p = compileScene({
    format: "xpin-scene/1",
    items: [
      { id: "base", kind: "folder", position: [0, 0, 0.04] },
      { id: "top", kind: "note", position: [0, 0, 0.04] },
    ],
    pins: [
      { id: "pin", hostId: "base", local: [0.5, 0, 0.025], color: "#aa2233" },
    ],
  });
  const raw = clone(p.pins[0]);
  const pin = pinWorld(p, p.pins[0]);
  assert.ok(pin[2] > p.items[0].position[2] + 0.1);
  assert.deepEqual(p.pins[0], raw);
  assert.ok(liftToSurface(p, "top", 0.015));
  assert.ok(p.items[1].position[2] > 0.1);
});

test("both hinged clip handles stay in front of the board throughout a local clamp entrance", () => {
  const p = compileScene({
    format: "xpin-scene/1",
    items: [{ id: "clip", kind: "clip", position: [0, 0, 0.025] }],
    shots: [
      {
        id: "s",
        duration: 3,
        actions: [
          {
            id: "in",
            targetId: "clip",
            type: "clamp",
            start: 0,
            duration: 2,
            strength: 1,
            origin: "local",
          },
        ],
      },
    ],
  });
  const g = binderClip(p.items[0], fake);
  for (const t of [0, 0.1, 0.3, 0.6, 1, 1.5, 1.9, 2]) {
    const f = evaluate(p, t),
      q = f.progress.get("clip") ?? 1;
    g.position.set(...f.transforms.get("clip")!.position);
    g.scale.z = 1 + (1 - q) * 0.35;
    g.traverse((n) => {
      if (n.userData.clipHandle)
        n.rotation.x = (1 - q) * 0.85 * (n.userData.clipSign ?? 1);
      if (n.userData.clipJaw) n.rotation.x = (1 - q) * 0.65;
    });
    assert.ok(
      new T.Box3().setFromObject(g).min.z >= 0.001,
      `clip crosses board at ${t}`,
    );
  }
});
