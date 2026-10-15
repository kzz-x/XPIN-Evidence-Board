import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compileScene,
  evaluate,
  cameraProgress,
  mixFocus,
  validateProject,
  clone,
} from "../src/authoring";
const fixture = () =>
  compileScene({
    format: "xpin-scene/1",
    items: [{ id: "o", kind: "photo" }],
    shots: [
      {
        id: "s",
        duration: 5,
        motion: "focus",
        targetIds: ["o"],
        ease: "smoother",
        moveFraction: 0.8,
      },
    ],
  });
test("quintic camera path settles with near-zero velocity and acceleration at both endpoints", () => {
  const p = fixture(),
    s = p.shots[0],
    h = 0.0001;
  for (const x of [0, 0.8]) {
    const a = cameraProgress(s, x - h),
      b = cameraProgress(s, x),
      c = cameraProgress(s, x + h);
    assert.ok(Math.abs((c - a) / (2 * h)) < 0.00001);
    assert.ok(Math.abs((c - 2 * b + a) / (h * h)) < 0.01);
  }
  assert.equal(cameraProgress(s, 1), 1);
  s.ease = "custom";
  s.bezier = [0.2, 0, 0.75, 1];
  assert.notEqual(cameraProgress(s, 0.3), 0.3 / 0.8);
});
test("per-shot aperture, diopter focus pull and next-shot transition are deterministic and continuous", () => {
  const p = fixture(),
    s = p.shots[0];
  s.camera.fStop = 2;
  s.camera.focusDistance = 4;
  s.focusPull = { from: 2, to: 6, start: 1, duration: 2, ease: "smooth" };
  const next = {
    ...clone(s),
    id: "s2",
    focusPull: undefined,
    camera: { ...s.camera, focusDistance: 10, fStop: 8 },
  };
  p.shots.push(next);
  assert.equal(evaluate(p, 1).camera.focusDistance, 2);
  assert.ok(Math.abs(evaluate(p, 2).camera.focusDistance! - 3) < 1e-6);
  assert.equal(evaluate(p, 4).camera.focusDistance, 6);
  assert.ok(
    Math.abs(
      evaluate(p, 5 - 1e-5).camera.focusDistance! -
        evaluate(p, 5 + 1e-5).camera.focusDistance!,
    ) < 1e-5,
  );
  assert.equal(evaluate(p, 5).camera.fStop, 2);
  assert.ok(Math.abs(evaluate(p, 10).camera.fStop! - 8) < 1e-8);
  const before = JSON.stringify(p),
    f = evaluate(p, 2);
  evaluate(p, 7);
  assert.deepEqual(evaluate(p, 2), f);
  assert.equal(JSON.stringify(p), before);
  assert.equal(mixFocus(2, 6, 0.5), 3);
});
test("bad camera curves, iris and focus tracks fail validation", () => {
  for (const patch of [
    { camera: { fStop: 0 } },
    { camera: { focusDistance: NaN } },
    { moveFraction: 0 },
    { bezier: [-1, 0, 1, 1] },
    { focusPull: { from: 2, to: 4, start: 0, duration: 0 } },
  ]) {
    const p = fixture(),
      s = p.shots[0];
    Object.assign(s, {
      ...patch,
      camera: { ...s.camera, ...(patch.camera ?? {}) },
    });
    assert.throws(() => validateProject(p));
  }
});
