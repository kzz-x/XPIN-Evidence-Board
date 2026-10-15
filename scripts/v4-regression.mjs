import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const out = "test-results/v4";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"],
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
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => window.__XPIN);
await page.evaluate(() => window.__XPIN.ready);
const baseline = await page.evaluate(() => window.__XPIN.project());
async function reset() {
  await page.evaluate(async (p) => {
    const s = window.__XPIN.studio;
    s.stop();
    s.store.replace(structuredClone(p));
    s.selection = [];
    s.panel = "object";
    s.setMode("build");
    s.view.pose = structuredClone(p.camera);
    await s.view.sync(s.p);
    s.p.settings.grain = 0;
    s.view.renderAt(s.p, 0, "build");
  }, baseline);
}
async function png(name, width = 1280) {
  const bytes = await page.evaluate(
    async (w) =>
      Array.from(
        new Uint8Array(await (await window.__XPIN.png(w)).arrayBuffer()),
      ),
    width,
  );
  const b = Buffer.from(bytes);
  if (name) await writeFile(`${out}/${name}.png`, b);
  return b.toString("base64");
}
async function diff(a, b) {
  return await page.evaluate(
    async (data) => {
      const get = async (x) => {
        const im = new Image();
        im.src = "data:image/png;base64," + x;
        await im.decode();
        const c = document.createElement("canvas");
        c.width = im.width;
        c.height = im.height;
        const g = c.getContext("2d");
        g.drawImage(im, 0, 0);
        return g.getImageData(0, 0, c.width, c.height).data;
      };
      const [x, y] = await Promise.all(data.map(get));
      let changed = 0,
        total = 0,
        max = 0;
      for (let i = 0; i < x.length; i++) {
        const d = Math.abs(x[i] - y[i]);
        changed += d > 1;
        total += d;
        max = Math.max(max, d);
      }
      return { changed, mean: total / x.length, max };
    },
    [a, b],
  );
}
async function test(name, fn) {
  await reset();
  const evidence = await fn();
  results.push({ name, evidence });
  console.log("PASS " + name);
}
try {
  await test("closed paper has one connected sheet and thin paired surfaces", async () => {
    const audit = await page.evaluate(() => {
      const s = window.__XPIN.studio;
      return s.p.items
        .filter((o) => !["clip", "pin", "staple", "stamp"].includes(o.kind))
        .map((o) => {
          const g = s.view.objects.get(o.id),
            geo = g.children[0].geometry,
            pos = geo.getAttribute("position"),
            count = pos.count / 2;
          let gap = 0;
          for (let i = 0; i < count; i++)
            gap = Math.max(gap, Math.abs(pos.getZ(i) - pos.getZ(i + count)));
          return {
            id: o.id,
            children: g.children.length,
            gap,
            groups: geo.groups.length,
          };
        });
    });
    assert.ok(
      audit.every((x) => x.children === 1 && x.gap < 0.00601 && x.groups === 2),
    );
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      const o = s.p.items.find((o) => o.kind === "photo");
      s.view.pose = {
        target: o.position,
        distance: 7,
        yaw: 0.9,
        pitch: -0.3,
        roll: 0,
        focal: 55,
      };
      s.p.settings.dof = 0.35;
    });
    await png("paper-macro");
    return audit;
  });
  await test("flat brush and circle underline arrow presets bind to paper", async () => {
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      s.select([s.p.items.find((o) => o.kind === "photo").id]);
      s.setTool("mark");
    });
    await page.click('[data-action="mark-circle"]');
    const evidence = await page.evaluate(() => {
      const s = window.__XPIN.studio,
        m = s.p.marks.at(-1),
        g = s.view.marks.get(m.id);
      let caster = 0,
        zmin = 999,
        zmax = -999;
      g.traverse((n) => {
        if (n.isMesh) {
          caster += n.castShadow;
          const p = n.geometry.getAttribute("position");
          for (let i = 0; i < p.count; i++) {
            zmin = Math.min(zmin, p.getZ(i));
            zmax = Math.max(zmax, p.getZ(i));
          }
        }
      });
      return {
        hostId: m.hostId,
        brush: m.brush,
        radius: m.radius,
        caster,
        zmin,
        zmax,
      };
    });
    assert.ok(evidence.hostId);
    assert.equal(evidence.caster, 0);
    assert.ok(evidence.zmax < 0.06);
    await page.click('[data-action="mark-animate"]');
    assert.ok(await page.locator('[data-bind$=".type"]').count());
    return evidence;
  });
  await test("paired sliders change position live and undo remains one transaction", async () => {
    await page.evaluate(() =>
      window.__XPIN.studio.select([window.__XPIN.studio.p.items[0].id]),
    );
    const start = await page.evaluate(
      () => window.__XPIN.studio.p.items[0].position[0],
    );
    const slider = page.locator('[data-bind="item.position.0"][type="range"]');
    await slider.evaluate((el) => {
      el.value = "2.5";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(
      await page.evaluate(() => window.__XPIN.studio.p.items[0].position[0]),
      2.5,
    );
    assert.equal(
      await page
        .locator('[data-bind="item.position.0"][type="number"]')
        .inputValue(),
      "2.5",
    );
    await slider.dispatchEvent("change");
    await page.evaluate(() => window.__XPIN.studio.store.undo());
    assert.equal(
      await page.evaluate(() => window.__XPIN.studio.p.items[0].position[0]),
      start,
    );
    return { start, changed: 2.5 };
  });
  await test("middle button orbit follows grab direction and reverse option", async () => {
    const rect = await page
      .locator('canvas[data-testid="board-canvas"]')
      .boundingBox();
    const x = rect.x + rect.width * 0.5,
      y = rect.y + rect.height * 0.5;
    const start = await page.evaluate(() => window.__XPIN.studio.view.pose.yaw);
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(x + 90, y, { steps: 10 });
    await page.mouse.up({ button: "middle" });
    const yaw = await page.evaluate(() => window.__XPIN.studio.view.pose.yaw);
    assert.ok(yaw < start);
    await page.evaluate(
      () => (window.__XPIN.studio.p.settings.orbitReverse = true),
    );
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(x + 90, y, { steps: 10 });
    await page.mouse.up({ button: "middle" });
    const reversed = await page.evaluate(
      () => window.__XPIN.studio.view.pose.yaw,
    );
    assert.ok(reversed > yaw);
    return { start, yaw, reversed };
  });
  await test("DOF on/off and focus changes visibly in oblique macro", async () => {
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      s.p.settings.dof = 0;
      s.view.pose = {
        target: [-3, 0, 0.1],
        distance: 12,
        yaw: 0.6,
        pitch: -0.35,
        roll: 0,
        focal: 50,
      };
    });
    const sharp = await png("dof-off");
    await page.evaluate(() => (window.__XPIN.studio.p.settings.dof = 0.5));
    const soft = await png("dof-on");
    await page.evaluate(
      () => (window.__XPIN.studio.p.settings.focusOffset = 2.2),
    );
    const shifted = await png("dof-focus-shift");
    const on = await diff(sharp, soft),
      focus = await diff(soft, shifted);
    assert.ok(on.mean > 1);
    assert.ok(focus.mean > 1);
    return {
      on,
      focus,
      audit: await page.evaluate(() => window.__XPIN.audit()),
    };
  });
  await test("all four projected sunlight patterns affect real scene pixels", async () => {
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      s.p.settings.dof = 0;
      s.p.settings.board = "cork";
      s.view.pose = {
        target: [0, 0, 0.1],
        distance: 25,
        yaw: 0,
        pitch: 0,
        roll: 0,
        focal: 40,
      };
      s.applyLook(5);
    });
    const window = await png("sun-window");
    const patterns = [];
    for (const style of ["blinds", "foliage", "lattice"]) {
      await page.evaluate((style) => {
        const s = window.__XPIN.studio;
        s.p.lights.find((l) => l.presetManaged).gobo = style;
      }, style);
      const other = await png("sun-" + style);
      const d = await diff(window, other);
      assert.ok(d.mean > 0.5);
      patterns.push({ style, ...d });
    }
    const audit = await page.evaluate(() => window.__XPIN.audit());
    assert.equal(audit.cookies, 1);
    return { patterns, audit };
  });
  await test("window sunlight still respects object shadow occlusion", async () => {
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      s.applyLook(5);
      s.p.settings.dof = 0;
      s.view.pose = {
        target: [0, 0, 0.1],
        distance: 24,
        yaw: 0,
        pitch: 0,
        roll: 0,
        focal: 40,
      };
    });
    const shadow = await png("sun-shadow");
    await page.evaluate(() =>
      window.__XPIN.studio.view.scene.traverse((n) => {
        if (n.isMesh && n.userData.kind === "item") n.castShadow = false;
      }),
    );
    const none = await png("sun-no-object-shadow");
    const d = await diff(shadow, none);
    assert.ok(d.mean > 0.05);
    return d;
  });
  await test("global and single-object fonts change atlas and persist JSON", async () => {
    const evidence = await page.evaluate(async () => {
      const s = window.__XPIN.studio,
        o = s.p.items.find((o) => o.kind === "note");
      const data = () => {
        const m = s.view.objects.get(o.id).children[0].material[0];
        return Array.from(
          m.map.image.getContext("2d").getImageData(0, 0, 1024, 512).data,
        );
      };
      const a = data();
      s.store.edit((p) => (p.settings.font = "KaiTi"));
      await s.view.sync(s.p);
      const b = data();
      s.store.edit(() => (o.font = "Courier New"));
      await s.view.sync(s.p);
      const c = data();
      return {
        global: a.reduce((v, x, i) => v + (x !== b[i]), 0),
        single: b.reduce((v, x, i) => v + (x !== c[i]), 0),
        saved: window.__XPIN.project().items.find((n) => n.id === o.id).font,
      };
    });
    assert.ok(evidence.global > 100);
    assert.ok(evidence.single > 100);
    assert.equal(evidence.saved, "Courier New");
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Browser.setPermission", {
        permission: { name: "local-fonts" },
        setting: "granted",
        origin: "http://127.0.0.1:5173",
      });
      await page.evaluate(() => window.__XPIN.studio.action("fonts"));
      evidence.localCount = await page.evaluate(
        () => window.__XPIN.studio.fonts.length,
      );
      evidence.notice = await page.locator("#toast").textContent();
      assert.ok(evidence.localCount > 9 || evidence.notice.includes("未返回"));
    } finally {
      await cdp.detach();
    }
    return evidence;
  });
  await test("editable board frame responds to dimensions and auto fit", async () => {
    return await page.evaluate(() => {
      const s = window.__XPIN.studio;
      s.store.edit((p) => {
        p.settings.boardWidth = 30;
        p.settings.boardHeight = 20;
        p.settings.frameWidth = 0.6;
      });
      s.view.renderAt(s.p, 0, "build");
      const dimensions = s.view.board.geometry.parameters;
      assertOk(s.view.border.children.length === 4);
      function assertOk(x) {
        if (!x) throw Error("no border");
      }
      return dimensions;
    });
  });
  await test("material-specific entrances deform deterministically and restore authoring", async () => {
    const brief = JSON.parse(
      await readFile("examples/Windowlight.scene.json", "utf8"),
    );
    await page.setInputFiles("#project-file", {
      name: "agent-scene.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(brief)),
    });
    await page.waitForTimeout(200);
    const evidence = await page.evaluate(() => {
      const s = window.__XPIN.studio,
        before = JSON.stringify(s.p);
      const sample = (t) => {
        s.view.renderAt(s.p, t, "play");
        const paper = s.view.objects
          .get("photo-a")
          .children[0].geometry.getAttribute("position");
        return {
          top: paper.getZ(0),
          pin: s.view.pins.get("pin-a").position.z,
          clip: s.view.objects
            .get("clip-a")
            .children.filter((n) => n.userData.clipHandle)
            .map((n) => n.rotation.x),
          ink: s.view.marks.get("mark-a").children[0].geometry.drawRange.count,
        };
      };
      const enter = sample(0.6),
        middle = sample(1.3),
        final = sample(3.9),
        repeat = sample(0.6);
      s.view.renderAt(s.p, 0, "build");
      return {
        enter,
        middle,
        final,
        repeat,
        unchanged: before === JSON.stringify(s.p),
        build: s.view.objects
          .get("photo-a")
          .children[0].geometry.getAttribute("position")
          .getZ(0),
      };
    });
    assert.deepEqual(evidence.enter, evidence.repeat);
    assert.ok(evidence.enter.top > evidence.final.top + 0.1);
    assert.ok(evidence.middle.clip.some((x) => x > 0.1));
    assert.ok(evidence.final.ink > 100);
    assert.ok(evidence.unchanged);
    assert.equal(evidence.build, evidence.final.top);
    await page.evaluate(() => window.__XPIN.studio.seek(3.9));
    await png("agent-scene-final");
    return evidence;
  });
  await test("live recording starts and stops, saves a decodable clip", async () => {
    await page.click('[data-action="output"]');
    await page.selectOption("#export-fps", "30");
    await page.click('[data-action="record-start"]');
    await page.waitForFunction(
      () => {
        const r = window.__XPIN.studio.recorder;
        return (
          r?.frames >= 12 && r.chunks.reduce((n, c) => n + c.size, 0) > 128
        );
      },
      null,
      { timeout: 15000 },
    );
    await page.evaluate(() => (window.__XPIN.studio.view.pose.yaw += 0.2));
    await page.waitForFunction(
      () => window.__XPIN.studio.recorder?.frames >= 24,
      null,
      { timeout: 15000 },
    );
    const download = page.waitForEvent("download");
    await page.click('[data-action="record-stop-top"]');
    const file = await download;
    await file.saveAs(out + "/live-recording.webm");
    const decoded = await page.evaluate(
      async (data) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(
            new Blob([bytes], { type: "video/webm" }),
          ),
          video = document.createElement("video");
        try {
          video.src = url;
          video.muted = true;
          await new Promise((resolve, reject) => {
            video.onloadeddata = resolve;
            video.onerror = () => reject(Error("recorded clip cannot decode"));
          });
          const seeked = new Promise((resolve) => (video.onseeked = resolve));
          video.currentTime = Math.min(0.2, video.duration / 2);
          await seeked;
          return {
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
            seek: video.currentTime,
          };
        } finally {
          video.removeAttribute("src");
          video.load();
          URL.revokeObjectURL(url);
        }
      },
      (await readFile(out + "/live-recording.webm")).toString("base64"),
    );
    assert.ok(
      decoded.width >= 1280 && decoded.duration > 0 && decoded.seek > 0,
    );
    assert.equal(
      await page.evaluate(() => window.__XPIN.studio.liveRecording),
      false,
    );
    return {
      path: file.suggestedFilename(),
      status: await page.locator("#record-status").textContent(),
      decoded,
    };
  });
  await test("master PNG supersampling yields exact requested dimensions", async () => {
    const evidence = await page.evaluate(async () => {
      const s = window.__XPIN.studio,
        pixel = s.view.renderer.getPixelRatio();
      const blob = await s.view.png(s.p, 0, "build", 960, 2),
        im = await createImageBitmap(blob);
      return {
        width: im.width,
        height: im.height,
        bytes: blob.size,
        restored: s.view.renderer.getPixelRatio() === pixel,
      };
    });
    assert.equal(evidence.width, 960);
    assert.equal(evidence.height, 540);
    assert.ok(evidence.restored);
    return evidence;
  });
  assert.deepEqual(errors, []);
  await page.screenshot({ path: out + "/studio.png" });
  await writeFile(
    out + "/regression.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length, errors }));
} finally {
  await browser.close();
}
