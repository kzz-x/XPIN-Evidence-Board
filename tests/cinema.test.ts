import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileScene, type SceneBrief } from "../src/compose";
import { animationOptions, upgrade, applyCinemaLook } from "../src/cinema";
import { emptyProject, clone, validateProject } from "../src/model";
import { evaluate } from "../src/story";
const brief = JSON.parse(
  readFileSync("examples/Windowlight.scene.json", "utf8"),
) as SceneBrief;
test("agent description makes portable editable graph with material-specific tracks", () => {
  const p = compileScene(brief);
  assert.equal(p.items.length, 3);
  assert.equal(p.ropes[0].from, "pin-a");
  assert.equal(p.marks[0].hostId, "note-a");
  assert.equal(p.shots[0].actions.length, 7);
  assert.ok(p.marks[0].points.length > 50);
  assert.equal(validateProject(p).settings.board, "cork");
});
test("agent patch keeps manual transforms, camera, unrelated assets and tracks", () => {
  const p = compileScene(brief),
    original = clone(p);
  p.camera.yaw = 0.55;
  p.assets.keep = "data:image/png;base64,AAAA";
  const result = compileScene(
    {
      format: "xpin-scene/1",
      items: [{ id: "note-a", kind: "note", body: "新线索" }],
    },
    p,
  );
  assert.deepEqual(result.items[0], original.items[0]);
  assert.deepEqual(result.items[1].position, p.items[1].position);
  assert.deepEqual(result.shots, p.shots);
  assert.equal(result.camera.yaw, 0.55);
  assert.equal(result.assets.keep, p.assets.keep);
  assert.equal(p.items[1].body, original.items[1].body);
});
test("unknown modules and dangling agent anchors fail before output", () => {
  assert.throws(() =>
    compileScene({
      format: "xpin-scene/1",
      items: [{ id: "bad", kind: "missing" as never }],
    }),
  );
  assert.throws(() =>
    compileScene({
      format: "xpin-scene/1",
      pins: [
        { id: "pin", hostId: "missing", local: [0, 0, 0], color: "#ffffff" },
      ],
    }),
  );
});
test("legacy v3 additions preserve authored state and supply defaults", () => {
  const p = compileScene(brief),
    original = clone(p.items);
  delete (p.settings as any).renderScale;
  delete (p.settings as any).boardTextureScale;
  upgrade(p);
  assert.equal(p.settings.renderScale, 1.25);
  assert.equal(p.settings.boardTextureScale, 2.5);
  assert.deepEqual(p.items, original);
});
test("sun presets preserve manual lights and replace only managed preset", () => {
  const p = emptyProject();
  applyCinemaLook(p, 5);
  const originalId = p.lights[0].id;
  const manual = clone(p.lights[0]);
  manual.id = "manual";
  delete manual.presetManaged;
  p.lights.push(manual);
  applyCinemaLook(p, 6);
  assert.equal(p.lights.length, 2);
  assert.deepEqual(
    p.lights.find((l) => l.id === "manual"),
    manual,
  );
  assert.equal(p.lights.find((l) => l.presetManaged)?.gobo, "blinds");
  assert.equal(p.lights.find((l) => l.presetManaged)?.id, originalId);
  applyCinemaLook(p, 0);
  assert.deepEqual(
    p.lights.find((l) => l.id === "manual"),
    manual,
  );
  assert.equal(p.lights.find((l) => l.id === originalId)?.enabled, false);
});
test("per-component defaults and legacy choices are available", () => {
  const p = compileScene(brief);
  assert.equal(animationOptions(p, "clip-a")[0][0], "clamp");
  assert.equal(animationOptions(p, "pin-a")[0][0], "pin");
  assert.equal(animationOptions(p, "note-a")[0][0], "peel");
  assert.ok(
    animationOptions(p, "clip-a", "settle").some((o) => o[0] === "settle"),
  );
});
test("new entrance deformation seeks repeatably without baseline mutation", () => {
  const p = compileScene(brief),
    before = JSON.stringify(p),
    a = evaluate(p, 0.6);
  evaluate(p, 3.9);
  assert.deepEqual(evaluate(p, 0.6), a);
  assert.equal(JSON.stringify(p), before);
  assert.equal(a.deformation.get("photo-a")?.type, "peel");
  assert.ok(a.progress.get("photo-a")! < 1);
});
