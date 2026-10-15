import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { compileScene } from "../src/compose";
import { evaluate } from "../src/story";
import {
  clone,
  validateProject,
  ratio,
  type Action,
  type Settings,
} from "../src/model";
import { actionSample, cubicEase } from "../src/motion";

function fixture() {
  const p = compileScene({
    format: "xpin-scene/1",
    items: [
      {
        id: "paper",
        kind: "photo",
        width: 4,
        height: 3,
        position: [1, -0.5, 0.1],
        rotation: 0.3,
        scale: 1.2,
      },
      { id: "other", kind: "note", position: [-3, 0, 0.1] },
    ],
    pins: [
      { id: "pin", hostId: "paper", local: [0, 1, 0.04], color: "#cc2222" },
    ],
    ropes: [{ id: "rope", from: "pin", to: "pin" }],
    marks: [{ id: "ink", hostId: "paper", shape: "circle" }],
    shots: [{ id: "shot", duration: 8, targetIds: ["paper"] }],
  });
  p.camera = clone(p.shots[0].camera);
  p.shots[0].actions = [
    {
      id: "in",
      targetId: "paper",
      start: 1,
      duration: 2,
      type: "slide",
      strength: 1,
    },
  ];
  return p;
}
test("legacy tracks fade continuously from zero and settle exactly", () => {
  const p = fixture(),
    before = clone(p);
  assert.equal(evaluate(p, 1).opacity.get("paper"), 0);
  assert.ok(evaluate(p, 1.01).opacity.get("paper")! < 0.001);
  const mid = evaluate(p, 1.5);
  assert.ok(mid.opacity.get("paper")! > 0 && mid.opacity.get("paper")! < 1);
  assert.deepEqual(
    evaluate(p, 3).transforms.get("paper")!.position,
    p.items[0].position,
  );
  assert.equal(evaluate(p, 3).opacity.get("paper"), 1);
  assert.deepEqual(p, before);
});
test("all component actions have a soft envelope and reversible exit", () => {
  const types: Action["type"][] = [
    "settle",
    "slide",
    "type",
    "grow",
    "draw",
    "stamp",
    "peel",
    "clamp",
    "pin",
    "thread",
  ];
  for (const type of types) {
    const a: Action = {
      id: "a",
      targetId: "paper",
      start: 0,
      duration: 2,
      type,
      strength: 1,
      fade: 1,
    };
    assert.equal(actionSample(a, 0).opacity, 0);
    assert.equal(actionSample(a, 0.5).opacity, 0.5);
    assert.equal(actionSample(a, 1).progress, 1);
    assert.equal(actionSample({ ...a, phase: "out" }, 0).progress, 1);
    assert.equal(actionSample({ ...a, phase: "out" }, 1).opacity, 0);
  }
});
test("exit-only tracks begin visible, persist hidden, and can re-enter", () => {
  const p = fixture(),
    s = p.shots[0];
  s.actions = [{ ...s.actions[0], phase: "out", id: "out" }];
  assert.equal(evaluate(p, 0).opacity.get("paper"), 1);
  assert.equal(evaluate(p, 3).visible.get("paper"), false);
  s.actions.unshift({ ...s.actions[0], id: "reenter", phase: "in", start: 5 });
  assert.equal(evaluate(p, 4).opacity.get("paper"), 0);
  assert.equal(evaluate(p, 7).opacity.get("paper"), 1);
});
test("host fade reaches pins, ropes and ink without changing unrelated material state", () => {
  const f = evaluate(fixture(), 1.5),
    a = f.opacity.get("paper");
  for (const id of ["pin", "rope", "ink"]) assert.equal(f.opacity.get(id), a);
  assert.equal(f.opacity.get("other"), 1);
});
test("screen starts and exit ends clear all four gates for portrait, roll and oblique cameras", () => {
  const p = fixture();
  for (const aspect of ["16:9", "9:16", "3:4", "1:1"] as Settings["aspect"][])
    for (const direction of ["left", "right", "top", "bottom"] as const) {
      p.settings.aspect = aspect;
      p.camera = {
        target: [0, 0, 0],
        distance: 16,
        yaw: 0.7,
        pitch: -0.5,
        roll: 0.22,
        focal: 55,
      };
      p.shots[0].camera = clone(p.camera);
      const action = p.shots[0].actions[0];
      action.direction = direction;
      for (const phase of ["in", "out"] as const) {
        action.phase = phase;
        const f = evaluate(p, phase === "in" ? 1 : 3),
          pose = f.camera;
        const c = new T.PerspectiveCamera(42, ratio(aspect));
        c.setFocalLength(pose.focal);
        c.up.set(-Math.sin(pose.roll), Math.cos(pose.roll), 0);
        c.position.set(
          pose.target[0] +
            Math.sin(pose.yaw) * Math.cos(pose.pitch) * pose.distance,
          pose.target[1] + Math.sin(pose.pitch) * pose.distance,
          pose.target[2] +
            Math.cos(pose.yaw) * Math.cos(pose.pitch) * pose.distance,
        );
        c.lookAt(new T.Vector3(...pose.target));
        c.updateMatrixWorld();
        const o = p.items[0],
          tr = f.transforms.get(o.id)!;
        assert.ok(
          tr.position[2] >= o.position[2],
          "flight must stay in front of the solid board",
        );
        for (const x of [-o.width / 2, o.width / 2])
          for (const y of [-o.height / 2, o.height / 2]) {
            const point = new T.Vector3(x, y, 0)
              .multiplyScalar(o.scale)
              .applyAxisAngle(new T.Vector3(0, 0, 1), tr.rotation)
              .add(new T.Vector3(...tr.position))
              .project(c);
            assert.ok(
              direction === "left"
                ? point.x < -1
                : direction === "right"
                  ? point.x > 1
                  : direction === "top"
                    ? point.y > 1
                    : point.y < -1,
              `${aspect}/${direction}/${phase}`,
            );
          }
      }
    }
});
test("bezier inversion, slow arrival and custom timing work at arbitrary seeks", () => {
  for (const x of [0, 0.1, 0.5, 0.9, 1])
    assert.ok(Math.abs(cubicEase(x, [0, 0, 1, 1]) - x) < 1e-8);
  const p = fixture(),
    a = p.shots[0].actions[0];
  const slow = 1 - actionSample(a, 0.95).progress,
    fast = actionSample(a, 0.05).progress;
  assert.ok(fast > slow * 20);
  a.ease = "custom";
  a.bezier = [0.65, 0, 0.35, 1];
  const mid = evaluate(p, 1.6);
  evaluate(p, 6);
  evaluate(p, 0);
  assert.deepEqual(evaluate(p, 1.6), mid);
  assert.ok(Math.abs(actionSample(a, 0.5).progress - 0.5) < 1e-8);
});
test("bad curves and fade parameters fail portable-project validation", () => {
  for (const patch of [
    { fade: -1 },
    { travel: 0 },
    { bezier: [1, NaN, 0, 1] },
    { ease: "bad" },
    { phase: "bad" },
  ]) {
    const p = fixture();
    Object.assign(p.shots[0].actions[0], patch);
    assert.throws(() => validateProject(p));
  }
});
test("independent pin queries never mutate the baseline", async () => {
  const { pinWorld } = await import("../src/model");
  const p = fixture();
  delete p.pins[0].hostId;
  const before = clone(p),
    endpoint = pinWorld(p, p.pins[0]);
  endpoint[2] += 9;
  assert.deepEqual(p, before);
});
