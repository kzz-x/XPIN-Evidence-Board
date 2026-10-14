import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyProject,
  localToWorld,
  worldToLocal,
  pinWorld,
  duplicateSelection,
  removeIds,
  validateProject,
  makeLight,
  makeShot,
  clone,
  type Item,
} from "../src/model";
import { evaluate, ropePoint } from "../src/story";
import { Store } from "../src/store";
const item = (id: string, x = 0): Item => ({
  id,
  kind: "photo",
  title: id,
  body: "evidence",
  width: 3,
  height: 4,
  color: "#ffffff",
  position: [x, 1, 0.1],
  rotation: 0.7,
  scale: 1.3,
  hidden: false,
  locked: false,
  groupId: "group",
});
function fixture() {
  const p = emptyProject();
  p.items = [item("A"), item("B", 4)];
  p.pins = [
    { id: "pA", hostId: "A", local: [0.5, 0.9, 0.02], color: "#b32121" },
    { id: "pB", hostId: "B", local: [-0.5, 0.5, 0.02], color: "#b32121" },
  ];
  p.ropes = [
    {
      id: "r",
      from: "pA",
      to: "pB",
      radius: 0.02,
      slack: 0.1,
      bend: 0.05,
      color: "#b32121",
      style: "cotton",
    },
  ];
  p.marks = [
    {
      id: "m",
      hostId: "A",
      points: [
        [0, 0, 0.025],
        [1, 1, 0.025],
      ],
      color: "#b32121",
      radius: 0.02,
    },
  ];
  return p;
}
test("host-local anchors invert under rotation, scaling and depth", () => {
  const o = item("a");
  const v: [number, number, number] = [0.8, -1, 0.025],
    w = localToWorld(o, v),
    r = worldToLocal(o, w);
  r.forEach((n, i) => assert.ok(Math.abs(n - v[i]) < 1e-12));
});
test("copying a linked group remaps all references and keeps originals intact", () => {
  const p = fixture(),
    before = clone(p);
  const ids = duplicateSelection(p, ["A", "B"]);
  assert.equal(ids.length, 2);
  const pins = p.pins.filter((x) => ids.includes(x.hostId!));
  assert.equal(pins.length, 2);
  const r = p.ropes[1];
  assert.ok(pins.some((x) => x.id === r.from));
  assert.ok(pins.some((x) => x.id === r.to));
  assert.equal(p.marks[1].hostId, ids[0]);
  assert.notEqual(p.items[2].groupId, "group");
  assert.deepEqual(p.items.slice(0, 2), before.items);
  validateProject(p);
});
test("undo and redo restore complete relation graph", () => {
  const p = fixture(),
    store = new Store(p),
    before = clone(p);
  store.edit((p) => {
    p.items[0].position[0] += 3;
    p.items[0].rotation += 1;
  });
  const changed = clone(store.project);
  store.undo();
  assert.deepEqual(store.project, before);
  store.redo();
  assert.deepEqual(store.project, changed);
});
test("15 to 2 to 15 evaluates exactly without mutating authored layout", () => {
  const p = fixture(),
    l = makeLight();
  p.lights.push(l);
  for (let i = 0; i < 4; i++) {
    const s = makeShot(p, [p.items[i % 2].id]);
    s.duration = 5;
    s.cues = [
      {
        id: "cue" + i,
        lightId: l.id,
        start: 0.5,
        duration: 3,
        from: [0, 0, 0],
        to: [i, 1, 0],
        fromIntensity: 0,
        toIntensity: 90,
        fromAngle: 40,
        toAngle: 20,
        ease: "smooth",
      },
    ];
    if (i === 0)
      s.actions.push({
        id: "action",
        targetId: "A",
        start: 1,
        duration: 2,
        type: "settle",
        strength: 1,
      });
    p.shots.push(s);
  }
  const before = clone(p),
    f = evaluate(p, 15);
  evaluate(p, 2);
  assert.deepEqual(evaluate(p, 15), f);
  assert.deepEqual(p, before);
});
test("light follows the final animated host transform", () => {
  const p = fixture(),
    l = makeLight();
  l.hostId = "A";
  p.lights = [l];
  const s = makeShot(p, ["A"]);
  s.duration = 4;
  s.actions.push({
    id: "a",
    targetId: "A",
    type: "slide",
    start: 0,
    duration: 3,
    strength: 1,
  });
  p.shots = [s];
  const f = evaluate(p, 1);
  assert.deepEqual(
    f.lights[0].target,
    localToWorld(f.transforms.get("A")!, l.local),
  );
  assert.notDeepEqual(f.lights[0].target, localToWorld(p.items[0], l.local));
});
test("rope centerline endpoints remain exact with bend, slack and control", () => {
  const a = pinWorld(fixture(), fixture().pins[0]),
    b = pinWorld(fixture(), fixture().pins[1]);
  assert.deepEqual(ropePoint(a, b, 0.2, 0.4, 0, [1, 2, 3]), a);
  assert.deepEqual(ropePoint(a, b, 0.2, 0.4, 1, [1, 2, 3]), b);
});
test("removing a host removes dependent pins, marks and links, including multi-links", () => {
  const p = fixture();
  p.ropes.push({ ...p.ropes[0], id: "r2" });
  removeIds(p, ["A"]);
  assert.equal(p.pins.length, 1);
  assert.equal(p.ropes.length, 0);
  assert.equal(p.marks.length, 0);
  validateProject(p);
});
test("portable projects reject blob assets, duplicate IDs and dangling anchors", () => {
  let p = fixture();
  p.assets.bad = "blob:temporary";
  assert.throws(() => validateProject(p));
  p = fixture();
  p.pins[0].hostId = "missing";
  assert.throws(() => validateProject(p));
  p = fixture();
  p.items[1].id = "A";
  assert.throws(() => validateProject(p));
});
