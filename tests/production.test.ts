import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compileScene,
  auditProduction,
  liftToSurface,
  surfaceAt,
  ropeHeights,
  evaluate,
  cameraPosition,
  validateProject,
} from "../src/authoring";
const fixture = () =>
  compileScene({
    format: "xpin-scene/1",
    settings: { dof: 0 },
    items: [
      {
        id: "base",
        kind: "map",
        width: 4,
        height: 4,
        position: [0, 0, 0.05],
        paperCurl: 0,
      },
      {
        id: "top",
        kind: "note",
        width: 2,
        height: 2,
        position: [0, 0, 0.05],
        paperCurl: 0,
      },
    ],
    pins: [
      { id: "a", local: [-3, 0, 0.04], color: "#aa2222" },
      { id: "b", local: [3, 0, 0.04], color: "#aa2222" },
    ],
    ropes: [{ id: "r", from: "a", to: "b" }],
    shots: [{ id: "s", duration: 4, motion: "focus", targetIds: ["base"] }],
  });

test("production audit detects coplanar overlap and explicit lift fixes it without moving XY or source", () => {
  const p = fixture(),
    original = JSON.stringify(p),
    report = auditProduction(p);
  assert.ok(report.issues.some((i) => i.code === "PAPER_SURFACE_INTERSECTION"));
  assert.equal(JSON.stringify(p), original);
  assert.equal(report.renderValidated, false);
  assert.equal(report.continuousCollisionVerified, false);
  const xy = p.items[1].position.slice(0, 2);
  assert.equal(liftToSurface(p, "top"), true);
  assert.deepEqual(p.items[1].position.slice(0, 2), xy);
  assert.ok(
    !auditProduction(p).issues.some(
      (i) => i.code === "PAPER_SURFACE_INTERSECTION",
    ),
  );
  assert.equal(liftToSurface(p, "missing"), false);
});

test("rope routing clears raised rotated paper while preserving both exact pin anchors", () => {
  const p = fixture();
  p.items[0].position[2] = 0.6;
  p.items[0].rotation = 0.23;
  p.items[1].hidden = true;
  const a: [number, number, number] = [-3, 0, 0.185],
    b: [number, number, number] = [3, 0, 0.185];
  const h = ropeHeights(p, p.ropes[0], a, b);
  assert.equal(h[0], a[2]);
  assert.equal(h.at(-1), b[2]);
  for (let i = 1; i < h.length - 1; i++) {
    const x = -3 + (6 * i) / (h.length - 1);
    assert.ok(
      h[i] >= surfaceAt(p, x, 0) + p.ropes[0].radius * 1.8 + 0.008 - 1e-9,
    );
  }
});

test("audit flags buried pin, early rope and camera collision with entity IDs", () => {
  const p = fixture();
  p.items[0].position[2] = 1;
  p.pins[0].local = [0, 0, 0.02];
  p.shots[0].actions = [
    {
      id: "a-in",
      targetId: "a",
      type: "pin",
      start: 1,
      duration: 1,
      strength: 1,
      origin: "stationary",
    },
  ];
  p.camera = {
    target: [0, 0, -1],
    distance: 0.1,
    yaw: 0,
    pitch: 0,
    roll: 0,
    focal: 50,
  };
  p.shots[0].camera = structuredClone(p.camera);
  const report = auditProduction(p, 0.1),
    codes = report.issues.map((i) => i.code);
  for (const code of [
    "PIN_HEAD_BURIED",
    "CONNECTION_BEFORE_ANCHOR_READY",
    "CAMERA_SURFACE_COLLISION",
  ])
    assert.ok(codes.includes(code), code);
  assert.throws(() => auditProduction(p, NaN));
  assert.throws(() => auditProduction(p, 0));
});

test("camera shortest angular path and push settle avoid full spin and endpoint speed", () => {
  const p = fixture(),
    s = p.shots[0];
  p.items[1].hidden = true;
  p.camera.yaw = 3.05;
  s.camera = { ...p.camera, yaw: -3.05 };
  s.ease = "linear";
  s.motion = "focus";
  assert.ok(Math.abs(evaluate(p, 2).camera.yaw) > 3);
  p.camera.yaw = 0;
  s.camera = { ...p.camera };
  s.motion = "push";
  s.ease = "smooth";
  const d0 = evaluate(p, 3.3).camera.distance,
    d1 = evaluate(p, 3.39).camera.distance,
    d2 = evaluate(p, 3.4).camera.distance;
  assert.ok(Math.abs((d2 - d1) / 0.01) < Math.abs((d1 - d0) / 0.09));
  assert.ok(cameraPosition(evaluate(p, 2).camera).every(Number.isFinite));
});

test("independent editor view validates without changing authored camera or time samples", () => {
  const p = fixture(),
    before = evaluate(p, 1).camera;
  p.editorView = { ...p.camera, target: [7, 4, 0], distance: 30 };
  validateProject(p);
  assert.deepEqual(evaluate(p, 1).camera, before);
  p.editorView.distance = NaN;
  assert.throws(() => validateProject(p), /编辑视角/);
});
