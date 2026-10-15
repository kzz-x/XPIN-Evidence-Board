import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  compileScene,
  clone,
  evaluate,
  inspectProject,
  sampleProject,
  pinWorld,
} from "../src/authoring";
import {
  compileFile,
  readBrief,
  readProject,
  writeNewJson,
} from "../scripts/lib/project-files";

const fixture = () => compileFile("examples/quickstart/scene.json");
const directory = async () => {
  const p = resolve("test-results", "native-" + randomUUID());
  await mkdir(p, { recursive: true });
  return p;
};
function run(...args: string[]) {
  const r = spawnSync(
    process.execPath,
    [resolve("node_modules/tsx/dist/cli.mjs"), ...args],
    { encoding: "utf8", timeout: 20000 },
  );
  if (r.error) throw r.error;
  return r;
}
test("native authoring loads local assets and complete tutorial without a DOM", async () => {
  assert.equal(typeof globalThis.window, "undefined");
  const p = await fixture(),
    report = inspectProject(p);
  assert.equal(p.items.length, 4);
  assert.equal(p.shots.length, 3);
  assert.equal(report.duration, 12);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.renderValidated, false);
  assert.ok(p.assets["evidence-map"].startsWith("data:image/svg+xml;base64,"));
  assert.ok(!JSON.stringify(report).includes("data:image"));
});
test("native frame is serializable, follows actual pin transforms and preserves input", async () => {
  const p = await fixture(),
    before = clone(p),
    f = sampleProject(p, 1.1);
  evaluate(p, 11);
  assert.deepEqual(sampleProject(p, 1.1), f);
  assert.deepEqual(p, before);
  const parsed = JSON.parse(JSON.stringify(f));
  assert.equal(parsed.items.length, 4);
  assert.ok(parsed.items[0].opacity > 0 && parsed.items[0].opacity < 1);
  const engine = evaluate(p, 1.1),
    pin = p.pins[0],
    pos = pinWorld(p, pin, engine.transforms);
  assert.deepEqual(f.pins[0].position, pos);
  assert.deepEqual(f.ropes[0].from, [pos[0], pos[1], pos[2] + 0.145]);
  assert.equal(sampleProject(p, -1).time, 0);
  assert.equal(sampleProject(p, 99).time, 12);
  assert.throws(() => sampleProject(p, NaN));
  assert.throws(() => sampleProject(p, Infinity));
});
test("inspect reports overlaps, cross-shot and beyond-story actions without claiming pixels", async () => {
  const p = await fixture(),
    a = p.shots[0].actions[0];
  p.shots[0].actions.push({ ...a, id: "overlap", start: 0.3 });
  p.shots[2].actions.push({ ...a, id: "late", start: 3, duration: 2 });
  const before = JSON.stringify(p),
    r = inspectProject(p);
  assert.equal(JSON.stringify(p), before);
  for (const code of [
    "OVERLAPPING_ACTIONS",
    "TRACK_EXTENDS_SHOT",
    "ACTION_EXTENDS_STORY",
  ])
    assert.ok(r.warnings.some((w) => w.code === code));
  assert.equal(r.shots[1].start, 4);
  assert.equal(r.shots[2].start, 8);
  assert.equal(r.renderValidated, false);
});
test("documented native patch preserves authored layout, tracks, camera and assets", async () => {
  const p = await fixture(),
    before = clone(p),
    patch = await readBrief("examples/quickstart/patch.json");
  const q = compileScene(patch, clone(p));
  assert.deepEqual(p, before);
  assert.notEqual(q.items[2].body, p.items[2].body);
  assert.deepEqual(q.items[2].position, p.items[2].position);
  assert.deepEqual(q.camera, p.camera);
  assert.deepEqual(q.shots, p.shots);
  assert.deepEqual(q.assets, p.assets);
});
test("exclusive JSON output preserves an existing source byte for byte and BOM input loads", async () => {
  const dir = await directory(),
    path = resolve(dir, "source.json"),
    p = await fixture();
  await writeFile(path, "\uFEFF" + JSON.stringify(p));
  const before = await readFile(path);
  assert.equal((await readProject(path)).name, p.name);
  await assert.rejects(writeNewJson(path, { bad: true }), /已存在/);
  assert.deepEqual(await readFile(path), before);
});
test("native CLI compose validate inspect sample and patch run as documented", async () => {
  const dir = await directory(),
    source = resolve(dir, "source.json"),
    report = resolve(dir, "inspect.json"),
    frame = resolve(dir, "frame.json"),
    result = resolve(dir, "revised.json");
  for (const args of [
    ["compose", "examples/quickstart/scene.json", source],
    ["validate", source],
    ["inspect", source, report],
    ["sample", source, "1.1", frame],
    ["compose", "examples/quickstart/patch.json", result, source],
  ]) {
    const r = run("scripts/project.ts", ...args);
    assert.equal(r.status, 0, r.stderr);
  }
  const r = JSON.parse(await readFile(report, "utf8")),
    f = JSON.parse(await readFile(frame, "utf8"));
  assert.equal(r.format, "xpin-inspect/1");
  assert.equal(f.format, "xpin-frame/1");
  assert.equal(f.time, 1.1);
  const before = await readFile(source),
    failure = run(
      "scripts/project.ts",
      "compose",
      "examples/quickstart/patch.json",
      source,
      source,
    );
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /已存在/);
  assert.deepEqual(await readFile(source), before);
  const invalid = run("scripts/project.ts", "sample", source, "not-a-time");
  assert.notEqual(invalid.status, 0);
});
test("legacy compose uses the same native loader and rejects invalid references before writing", async () => {
  const dir = await directory(),
    out = resolve(dir, "old-command.json");
  const r = run("scripts/compose.ts", "examples/quickstart/scene.json", out);
  assert.equal(r.status, 0, r.stderr);
  assert.equal((await readProject(out)).shots.length, 3);
  const invalid = resolve(dir, "bad.scene.json"),
    badOut = resolve(dir, "bad.project.json");
  await writeFile(
    invalid,
    JSON.stringify({
      format: "xpin-scene/1",
      ropes: [{ id: "rope", from: "missing", to: "missing" }],
    }),
  );
  const bad = run("scripts/project.ts", "compose", invalid, badOut);
  assert.notEqual(bad.status, 0);
  await assert.rejects(access(badOut));
});
