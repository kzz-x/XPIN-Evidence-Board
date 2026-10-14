import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { paperGeometry, deformPaper, paperSurface } from "../src/geometry";
import { compileScene, type SceneBrief } from "../src/compose";
const o = compileScene({
  format: "xpin-scene/1",
  items: [{ id: "sheet", kind: "note" }],
}).items[0];
test("paper is a closed manifold instead of separate floating surfaces", () => {
  const g = paperGeometry(o),
    edges = new Map<string, number>(),
    idx = g.index!.array;
  for (let i = 0; i < idx.length; i += 3)
    for (let n = 0; n < 3; n++) {
      const a = idx[i + n],
        b = idx[i + ((n + 1) % 3)],
        key = a < b ? `${a}/${b}` : `${b}/${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  assert.ok([...edges.values()].every((n) => n === 2));
  assert.equal(g.groups.length, 2);
  g.dispose();
});
test("soft-paper bend restores baseline exactly and repeated seeking is deterministic", () => {
  const g = paperGeometry(o),
    mesh = new T.Mesh(g),
    original = Array.from(g.getAttribute("position").array);
  deformPaper(mesh, o, 0.3);
  const bent = Array.from(g.getAttribute("position").array);
  assert.notDeepEqual(bent, original);
  deformPaper(mesh, o, 1);
  assert.deepEqual(Array.from(g.getAttribute("position").array), original);
  deformPaper(mesh, o, 0.3);
  assert.deepEqual(Array.from(g.getAttribute("position").array), bent);
  g.dispose();
});
test("surface projection never explodes outside the paper boundary", () => {
  assert.ok(paperSurface(o, 100, 100) < 0.1);
});
