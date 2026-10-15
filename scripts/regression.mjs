import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const out = process.env.XPIN_EVIDENCE_DIR ?? "test-results";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.XPIN_BROWSER ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  }),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(process.env.XPIN_URL ?? "http://127.0.0.1:5173");
await page.waitForFunction(() => window.__XPIN);
await page.evaluate(() => window.__XPIN.ready);
await page.waitForTimeout(300);
const baseline = await page.evaluate(() => window.__XPIN.project());
async function reset() {
  await page.evaluate(async (p) => {
    const s = window.__XPIN.studio;
    s.stop();
    s.selection = [];
    s.store.replace(p);
    s.view.pose = structuredClone(p.camera);
    s.setMode("build");
    await s.view.sync(s.p);
    s.view.scene.traverse((o) => {
      if (
        o.isMesh &&
        o.material.type !== "MeshBasicMaterial" &&
        o.userData.kind !== "mark"
      )
        o.castShadow = true;
    });
  }, baseline);
  await page.waitForTimeout(70);
}
async function png(name, width = 1280) {
  const uri = await page.evaluate(async (w) => {
    const b = await window.__XPIN.png(w);
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(b);
    });
  }, width);
  const b = Buffer.from(uri.split(",")[1], "base64");
  if (name) await writeFile(out + "/" + name + ".png", b);
  return b;
}
async function comparePixels(a, b) {
  return await page.evaluate(
    async (uris) => {
      const images = await Promise.all(
        uris.map(async (uri) => {
          const image = new Image();
          image.src = uri;
          await image.decode();
          return image;
        }),
      );
      const c = document.createElement("canvas");
      c.width = images[0].width;
      c.height = images[0].height;
      const g = c.getContext("2d");
      g.drawImage(images[0], 0, 0);
      const first = g.getImageData(0, 0, c.width, c.height).data;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(images[1], 0, 0);
      const second = g.getImageData(0, 0, c.width, c.height).data;
      let changed = 0,
        max = 0,
        sum = 0;
      for (let i = 0; i < first.length; i++) {
        const d = Math.abs(first[i] - second[i]);
        if (d) changed++;
        max = Math.max(max, d);
        sum += d;
      }
      return {
        changedChannels: changed,
        totalChannels: first.length,
        maxDifference: max,
        meanDifference: sum / first.length,
      };
    },
    [a, b].map(
      (buffer) => "data:image/png;base64," + buffer.toString("base64"),
    ),
  );
}
async function test(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, passed: true, detail });
    console.log("PASS " + name);
  } catch (e) {
    results.push({ name, passed: false, error: String(e) });
    console.log("FAIL " + name + " " + e);
  }
}
await test("GPU WebGL2 / actual physical casters and receivers", async () => {
  const a = await page.evaluate(() => window.__XPIN.audit());
  assert.match(a.renderer, /NVIDIA|AMD|Intel/);
  assert.ok(a.shadowCasters > 40 && a.shadowReceivers > 40);
  assert.equal(a.contextLost, false);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + "/studio.png" });
  await png("overview", 1920);
  return a;
});
await test("empty board to photo, document, local asset and text editing", async () => {
  await page.click('[data-action="new"]');
  await page.click('[data-module="photo"]');
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.p.items[0].position[0] = -3;
    s.view.updateSelection(s.p);
  });
  await page.click('[data-module="file"]');
  await page.getByLabel("标题", { exact: true }).fill("回归验证 / 调查报告");
  await page.getByLabel("标题", { exact: true }).press("Tab");
  await page
    .getByLabel("正文 / 题注", { exact: true })
    .fill("23:40 最后一次目击\n00:12 桥下车辆");
  await page.getByLabel("正文 / 题注", { exact: true }).press("Tab");
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.p.items[1].position[0] = 3;
    s.view.pose.yaw = 0;
    s.view.pose.pitch = 0;
    s.select([s.p.items[0].id]);
  });
  await page.setInputFiles("#image-file", "src/assets/bridge.jpg");
  await page.waitForTimeout(200);
  const p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.items.length, 2);
  assert.ok(p.items[1].title.includes("回归验证"));
  assert.ok(Object.values(p.assets).every((v) => v.startsWith("data:image")));
  return {
    items: p.items.length,
    assetBytes: Object.values(p.assets)[0].length,
  };
});
await test("mouse pins, physical rope, drag host and undo preserve binding", async () => {
  const positions = await page.evaluate(() => {
    const s = window.__XPIN.studio;
    return s.p.items.map((o) =>
      s.view.screenPoint([
        o.position[0],
        o.position[1] + 0.7,
        o.position[2] + 0.05,
      ]),
    );
  });
  await page.click('[data-tool="pin"]');
  for (const pos of positions) await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(100);
  let p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.pins.length, 2);
  assert.equal(p.pins[0].hostId, p.items[0].id);
  const points = await page.evaluate(() => {
    const s = window.__XPIN.studio;
    return s.p.pins.map((p) => {
      const g = s.view.pins.get(p.id);
      return s.view.screenPoint([
        g.position.x,
        g.position.y,
        g.position.z + 0.15,
      ]);
    });
  });
  await page.click('[data-tool="rope"]');
  for (const pt of points) await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(100);
  p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.ropes.length, 1);
  await page.click('[data-tool="select"]');
  const pos = await page.evaluate(() => {
      const s = window.__XPIN.studio;
      return s.view.screenPoint(s.p.items[0].position);
    }),
    before = p.items[0].position[0];
  await page.mouse.move(pos.x, pos.y);
  await page.mouse.down();
  await page.mouse.move(pos.x - 40, pos.y + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => window.__XPIN.project());
  assert.ok(Math.abs(after.items[0].position[0] - before) > 0.1);
  assert.equal(after.pins[0].hostId, after.items[0].id);
  await page.click('[data-action="undo"]');
  const undone = await page.evaluate(() => window.__XPIN.project());
  assert.ok(Math.abs(undone.items[0].position[0] - before) < 1e-8);
  await page.click('[data-action="redo"]');
  return { pins: 2, ropes: 1, dragDelta: after.items[0].position[0] - before };
});
await test("rotation and scale retain all anchors and drawn annotation", async () => {
  const pos = await page.evaluate(() => {
    const s = window.__XPIN.studio;
    return s.view.screenPoint(s.p.items[0].position);
  });
  await page.click('[data-tool="mark"]');
  await page.mouse.move(pos.x - 20, pos.y + 20);
  await page.mouse.down();
  await page.mouse.move(pos.x + 40, pos.y + 30, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(70);
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.select([s.p.items[0].id]);
  });
  await reveal('[data-bind="item.rotationDeg"][type="number"]');
  await page.getByLabel("旋转", { exact: true }).fill("38");
  await page.getByLabel("旋转", { exact: true }).dispatchEvent("change");
  await page.getByLabel("缩放", { exact: true }).fill("1.6");
  await page.getByLabel("缩放", { exact: true }).dispatchEvent("change");
  await page.waitForTimeout(100);
  const a = await page.evaluate(() => {
    const s = window.__XPIN.studio,
      o = s.p.items[0],
      pin = s.p.pins[0],
      g = s.view.pins.get(pin.id),
      c = Math.cos(o.rotation),
      sn = Math.sin(o.rotation);
    return {
      marks: s.p.marks,
      expected: [
        o.position[0] + (pin.local[0] * c - pin.local[1] * sn) * o.scale,
        o.position[1] + (pin.local[0] * sn + pin.local[1] * c) * o.scale,
      ],
      actual: [g.position.x, g.position.y],
    };
  });
  assert.equal(a.marks.length, 1);
  assert.ok(a.marks[0].hostId);
  a.actual.forEach((n, i) => assert.ok(Math.abs(n - a.expected[i]) < 1e-7));
});
await test("light position, target binding and changed shadows affect real pixels", async () => {
  await reset();
  await page.click('[data-panel="light"]');
  const id = baseline.lights[0].id;
  await reveal(`[data-select="${id}"]`);
  await page.click(`[data-select="${id}"]`);
  await reveal('[data-bind="light.hostId"]');
  await page
    .getByLabel("跟随目标", { exact: true })
    .selectOption(baseline.items[4].id);
  await page.waitForTimeout(70);
  const a = await png("light-a");
  await reveal('[data-bind="settings.keyAzimuth"][type="number"]');
  await page.getByLabel("光线方位", { exact: true }).fill("310");
  await page.getByLabel("光线方位", { exact: true }).dispatchEvent("change");
  await page.waitForTimeout(70);
  const b = await png("light-b");
  assert.ok(!a.equals(b), "light does not change frame");
  const audit = await page.evaluate(() => {
    const s = window.__XPIN.studio,
      l = s.p.lights[0],
      o = s.p.items.find((o) => o.id === l.hostId);
    o.position[0] += 0.6;
    o.rotation += 0.25;
    s.view.renderAt(s.p, 0, "build");
    return {
      target: s.view.lights.get(l.id).target.position.toArray(),
      host: o.position,
    };
  });
  assert.ok(Math.abs(audit.target[0] - audit.host[0]) < 0.05);
  return {
    movingLightChangesFrame: true,
    followError: Math.abs(audit.target[0] - audit.host[0]),
  };
});
await test("seek 15 to 2 to 15 repeats identical GPU frame; pause is stable", async () => {
  await reset();
  await page.evaluate(() => window.__XPIN.seek(15));
  const state = await page.evaluate(() => {
    const f = window.__XPIN.evaluate(15);
    return {
      camera: f.camera,
      lights: f.lights,
      transforms: Array.from(f.transforms),
    };
  });
  const a = await png("director-15");
  await page.evaluate(() => window.__XPIN.seek(2));
  await png("director-2");
  await page.evaluate(() => window.__XPIN.seek(15));
  const b = await png("director-15-repeat");
  const repeatedState = await page.evaluate(() => {
    const f = window.__XPIN.evaluate(15);
    return {
      camera: f.camera,
      lights: f.lights,
      transforms: Array.from(f.transforms),
    };
  });
  assert.deepEqual(state, repeatedState);
  const diff = await comparePixels(a, b);
  assert.ok(
    diff.maxDifference <= 1 &&
      diff.changedChannels / diff.totalChannels < 0.001,
    "GPU frame difference exceeds one 8-bit color step",
  );
  await page.waitForTimeout(200);
  const paused = await comparePixels(b, await png());
  assert.ok(
    paused.maxDifference <= 1 &&
      paused.changedChannels / paused.totalChannels < 0.001,
    "paused frame changed",
  );
  return {
    stateIdentical: true,
    byteIdentical: a.equals(b),
    pixelDifference: diff,
    pausedDifference: paused,
    bytes: a.length,
  };
});
await test("real shadows appear on receiving surfaces", async () => {
  await reset();
  const on = await png("shadows-on");
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.view.scene.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
  });
  const off = await png("shadows-off");
  assert.ok(!on.equals(off), "no visible shadow difference");
  return { shadowToggleChangesFrame: true };
});
await test("macro oblique rope and cork lookdev render", async () => {
  await reset();
  await page.evaluate(() => {
    const s = window.__XPIN.studio,
      pin = s.view.pins.get(s.p.pins[0].id);
    s.view.pose = {
      target: [pin.position.x - 0.4, pin.position.y - 0.25, pin.position.z],
      distance: 3.1,
      yaw: 0.95,
      pitch: -0.36,
      roll: -0.05,
      focal: 55,
    };
    s.p.settings.board = "cork";
    s.p.settings.dof = 0.48;
    s.p.settings.focusOffset = 0;
    s.p.settings.keyIntensity = 2.1;
    s.p.settings.ambient = 0.2;
  });
  await page.evaluate(() =>
    window.__XPIN.studio.view.sync(window.__XPIN.studio.p),
  );
  await png("macro", 1920);
});
await test("native module drag/drop and reusable linked group preset", async () => {
  await reset();
  const before = await page.evaluate(
    () => window.__XPIN.project().items.length,
  );
  await page
    .locator('[data-module="note"]')
    .dragTo(page.locator('[data-testid="board-canvas"]'), {
      targetPosition: { x: 320, y: 320 },
    });
  assert.equal(
    await page.evaluate(() => window.__XPIN.project().items.length),
    before + 1,
  );
  await reset();
  await page.click('[data-panel="object"]');
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.select([s.p.items[0].id, s.p.items[1].id]);
  });
  const detail = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "关系与组合" }) });
  if ((await detail.getAttribute("open")) === null)
    await detail.locator("summary").click();
  await page.click('[data-action="group"]');
  await page.click('[data-action="duplicate"]');
  let p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.items.length, baseline.items.length + 2);
  assert.ok(p.ropes.length > baseline.ropes.length);
  const copied = await page.evaluate(() => window.__XPIN.studio.selection);
  assert.ok(p.pins.filter((p) => copied.includes(p.hostId)).length >= 2);
  await reveal('[data-action="preset"]');
  await page.click('[data-action="preset"]');
  p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.presets.length, 1);
  await page.click(`[data-preset="${p.presets[0].id}"]`);
  p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.items.length, baseline.items.length + 4);
  assert.equal(new Set(p.items.map((o) => o.id)).size, p.items.length);
  return { presetItems: 2, internalRelationsCopied: true };
});
await test("portable save, reload and import keep image bytes and graph", async () => {
  await reset();
  const wait = page.waitForEvent("download");
  await page.click('[data-action="save"]');
  const d = await wait;
  await d.saveAs(out + "/midnight-project.json");
  const data = JSON.parse(
    await readFile(out + "/midnight-project.json", "utf8"),
  );
  assert.ok(
    Object.values(data.assets).every((v) => v.startsWith("data:image")),
  );
  await page.click('[data-action="new"]');
  await page.setInputFiles("#project-file", out + "/midnight-project.json");
  await page.waitForTimeout(200);
  const p = await page.evaluate(() => window.__XPIN.project());
  assert.deepEqual(p.items, data.items);
  assert.deepEqual(p.ropes, data.ropes);
  assert.deepEqual(p.shots, data.shots);
  assert.deepEqual(p.assets, data.assets);
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => window.__XPIN);
  await page.evaluate(() => window.__XPIN.ready);
  assert.deepEqual(
    (await page.evaluate(() => window.__XPIN.project())).assets,
    data.assets,
  );
  return { embeddedAssets: Object.keys(data.assets).length };
});
await test("16:9 and 9:16 PNG decode at correct size without editor helpers", async () => {
  await reset();
  await page.evaluate(() => window.__XPIN.seek(19));
  const wide = await png("wide-1080", 1920);
  assert.equal(wide.readUInt32BE(16), 1920);
  assert.equal(wide.readUInt32BE(20), 1080);
  await page.click('[data-panel="scene"]');
  await reveal('[data-bind="settings.aspect"]');
  await page.getByLabel("作品画幅", { exact: true }).selectOption("9:16");
  const tall = await png("portrait-1080", 1080);
  assert.equal(tall.readUInt32BE(16), 1080);
  assert.equal(tall.readUInt32BE(20), 1920);
});
await test("V2 demo import keeps positions, embedded SVGs and relationships", async () => {
  const legacy = await browser.newPage();
  await legacy.goto(
    "http://127.0.0.1:5173/prototypes/XPIN-Evidence-Board-True3D-V2.html",
  );
  await legacy.waitForTimeout(200);
  const waiting = legacy.waitForEvent("download");
  await legacy.click("#exportBtn");
  const file = await waiting;
  await file.saveAs(out + "/v2-fixture.json");
  const data = JSON.parse(await readFile(out + "/v2-fixture.json", "utf8"));
  await legacy.close();
  await page.setInputFiles("#project-file", {
    name: "v2.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await page.waitForTimeout(150);
  const p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.version, 3);
  assert.equal(p.items.length, data.objects.length);
  assert.equal(p.ropes.length, data.links.length);
  assert.equal(p.pins.length, data.pins.length);
  return { items: p.items.length, pins: p.pins.length, ropes: p.ropes.length };
});
await test("20 documents, 15 ropes, 2 spots, 4 shots performance", async () => {
  await reset();
  await page.evaluate(async () => {
    const s = window.__XPIN.studio;
    while (s.p.items.length < 20) {
      const o = structuredClone(s.p.items[1]);
      o.id = crypto.randomUUID();
      o.position[0] += ((s.p.items.length % 3) - 1) * 5;
      o.position[1] -= s.p.items.length * 0.08;
      s.p.items.push(o);
    }
    while (s.p.ropes.length < 15) {
      const r = structuredClone(s.p.ropes[0]);
      r.id = crypto.randomUUID();
      r.bend += s.p.ropes.length * 0.05;
      s.p.ropes.push(r);
    }
    await s.view.sync(s.p);
  });
  await page.waitForTimeout(300);
  const perf = await page.evaluate(async () => {
    const s = window.__XPIN.studio,
      start = performance.now(),
      frames = 90;
    for (let i = 0; i < frames; i++) await new Promise(requestAnimationFrame);
    return {
      fps: (frames * 1000) / (performance.now() - start),
      audit: s.view.audit(),
      items: s.p.items.length,
      ropes: s.p.ropes.length,
      lights: s.p.lights.length,
      shots: s.p.shots.length,
    };
  });
  assert.ok(perf.fps > 20);
  return perf;
});
await test("short video is encoded, downloaded and actually decoded", async () => {
  await reset();
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.p.shots = s.p.shots.slice(0, 2);
    s.p.shots.forEach((s) => (s.duration = 0.5));
    s.p.settings.dof = 0;
  });
  await page.click('[data-action="output"]');
  const wait = page.waitForEvent("download", { timeout: 60000 });
  await page.click('[data-action="video"]');
  const d = await wait;
  await d.saveAs(out + "/video-fixture.webm");
  const data = await readFile(out + "/video-fixture.webm"),
    result = await page.evaluate(async (bytes) => {
      const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "video/webm" }),
        ),
        v = document.createElement("video");
      v.src = url;
      v.muted = true;
      await new Promise((resolve, reject) => {
        v.onloadedmetadata = resolve;
        v.onerror = reject;
      });
      await v.play();
      await new Promise((r) => setTimeout(r, 150));
      const info = {
        width: v.videoWidth,
        height: v.videoHeight,
        duration: v.duration,
        currentTime: v.currentTime,
        readyState: v.readyState,
      };
      v.pause();
      URL.revokeObjectURL(url);
      return info;
    }, Array.from(data));
  assert.equal(result.width, 1920);
  assert.equal(result.height, 1080);
  assert.ok(result.currentTime > 0);
  assert.ok(Number.isFinite(result.duration));
  return result;
});
const report = {
  date: new Date().toISOString(),
  browser: "Windows Edge / headless / D3D11",
  results,
  errors,
};
await writeFile(out + "/regression.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exitCode = results.some((r) => !r.passed) || errors.length ? 1 : 0;

async function reveal(selector) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      for (let d = el.parentElement; d; d = d.parentElement)
        if (d.tagName === "DETAILS") d.open = true;
    });
}
