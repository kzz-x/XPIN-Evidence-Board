import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const out = process.env.XPIN_EVIDENCE_DIR ?? "test-results/motion";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.XPIN_BROWSER ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
async function test(name, fn) {
  const evidence = await fn();
  results.push({ name, evidence });
  console.log("PASS " + name);
}
async function image(t, name) {
  const data = await page.evaluate(async (t) => {
    const s = window.__XPIN.studio;
    const blob = await s.view.png(s.p, t, "play", 1280, 1, "studio");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, t);
  const bytes = Buffer.from(data);
  if (name) await writeFile(`${out}/${name}.png`, bytes);
  return bytes.toString("base64");
}
try {
  await page.goto(process.env.XPIN_URL ?? "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__XPIN);
  await page.evaluate(() => window.__XPIN.ready);
  await page.evaluate(async () => {
    const s = window.__XPIN.studio,
      assets = window.__XPIN.project().assets;
    const p = window.__XPIN.compile({
      format: "xpin-scene/1",
      name: "V4.1 · 证据的抵达与离开",
      look: 5,
      settings: {
        board: "cork",
        dof: 0.15,
        grain: 0,
        boardWidth: 15,
        boardHeight: 10,
      },
      camera: {
        target: [0, 0, 0],
        distance: 12,
        yaw: 0.2,
        pitch: -0.12,
        roll: 0,
        focal: 48,
      },
      items: [
        {
          id: "paper",
          kind: "photo",
          title: "THE MIDNIGHT ARCHIVE",
          body: "CASE 047",
          width: 4.2,
          height: 3.4,
          position: [-0.8, 0.2, 0.06],
          rotationDeg: -5,
        },
        {
          id: "note",
          kind: "note",
          title: "证据抵达",
          body: "先加速，再缓缓停稳。",
          position: [2, -1.2, 0.04],
          width: 2,
          height: 2.3,
        },
      ],
      pins: [
        { id: "pin", hostId: "paper", local: [0, 1.5, 0.04], color: "#c12532" },
        { id: "free-pin", local: [-3, -1.4, 0.06], color: "#383e3a" },
      ],
      ropes: [{ id: "rope", from: "pin", to: "free-pin" }],
      marks: [
        {
          id: "ink",
          hostId: "paper",
          shape: "circle",
          brush: "ink",
          radius: 0.008,
        },
      ],
      shots: [
        {
          id: "shot",
          title: "01 / 画外滑入 → 缓停 → 淡出",
          duration: 7,
          targetIds: ["paper"],
          motion: "focus",
          camera: {
            target: [0, 0, 0],
            distance: 12,
            yaw: 0.2,
            pitch: -0.12,
            roll: 0,
            focal: 48,
          },
          actions: [
            {
              id: "enter",
              targetId: "paper",
              start: 0.5,
              duration: 2,
              type: "slide",
              strength: 0.5,
              direction: "left",
              fade: 0.85,
            },
            {
              id: "note-in",
              targetId: "note",
              start: 0.9,
              duration: 2,
              type: "peel",
              strength: 0.5,
              direction: "bottom",
              ease: "smooth",
              fade: 0.8,
            },
            {
              id: "exit",
              targetId: "paper",
              start: 4.5,
              duration: 2,
              type: "slide",
              strength: 0.5,
              phase: "out",
              direction: "right",
              fade: 0.85,
            },
          ],
        },
      ],
    });
    p.assets = assets;
    p.items[0].assetId = "bridge";
    s.stop();
    s.store.replace(p);
    s.selection = [];
    s.selectedShot = "shot";
    s.setMode("director");
    s.panel = "shot";
    await s.view.sync(s.p);
    s.renderInspector();
  });
  const original = await page.evaluate(() => window.__XPIN.project());
  await test("GPU fades propagate to attachments, shadows and focal depth; build restores original opacity", async () => {
    return await page.evaluate(() => {
      const s = window.__XPIN.studio,
        before = JSON.stringify(s.p);
      const sample = (t) => {
        s.view.renderAt(s.p, t, "play");
        const mat = s.view.objects.get("paper").children[0].material[0],
          depth = s.view.objects.get("paper").children[0].customDepthMaterial;
        return {
          opacity: mat.opacity,
          transparent: mat.transparent,
          depth: depth.opacity,
          shadowDissolve: depth.alphaHash,
          pin: s.view.pins.get("pin").userData.opacity,
          rope: s.view.ropes.get("rope").userData.opacity,
          ink: s.view.marks.get("ink").userData.opacity,
          free: s.view.pins.get("free-pin").children[0].material.opacity,
          position: s.view.objects.get("paper").position.toArray(),
        };
      };
      const first = sample(0.5),
        mid = sample(1.1),
        end = sample(2.5),
        exit = sample(5.6),
        gone = sample(6.5),
        repeat = sample(1.1);
      if (
        first.opacity !== 0 ||
        mid.opacity <= 0 ||
        mid.opacity >= 1 ||
        end.opacity !== 1 ||
        gone.opacity !== 0
      )
        throw Error("fade discontinuity");
      for (const key of ["depth", "pin", "rope", "ink"])
        if (mid[key] !== mid.opacity) throw Error("detached fade " + key);
      if (
        !mid.shadowDissolve ||
        mid.free !== 1 ||
        JSON.stringify(mid) !== JSON.stringify(repeat)
      )
        throw Error("shared state / seeking");
      s.view.renderAt(s.p, 0, "build");
      const restored = s.view.objects.get("paper").children[0].material[0];
      if (
        restored.opacity !== 1 ||
        restored.transparent ||
        before !== JSON.stringify(s.p)
      )
        throw Error("source polluted");
      return { first, mid, end, exit, gone, unchanged: true };
    });
  });
  await test("actual PNG frames repeat through entry, exit and reverse seeking", async () => {
    const a = await image(1.1, "entry-mid");
    await image(6.5, "exit-end");
    const b = await image(1.1);
    const difference = await page.evaluate(
      async ([a, b]) => {
        const pixels = async (x) => {
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
        const [x, y] = await Promise.all([pixels(a), pixels(b)]);
        let max = 0,
          changed = 0;
        for (let i = 0; i < x.length; i++) {
          const d = Math.abs(x[i] - y[i]);
          max = Math.max(max, d);
          changed += d > 0;
        }
        return { max, changed, total: x.length };
      },
      [a, b],
    );
    assert.ok(
      difference.max <= 1 && difference.changed / difference.total < 0.001,
      JSON.stringify(difference),
    );
    const empty = await image(0.5, "entry-start"),
      full = await image(3, "settled");
    assert.notEqual(a, empty);
    assert.notEqual(a, full);
    return { difference, distinctStates: true };
  });
  await test("curve selector, live custom handles, direction and fade sliders are editable and undoable", async () => {
    await page.locator('[data-bind="action.enter.ease"]').evaluate((el) => {
      for (let d = el.parentElement; d; d = d.parentElement)
        if (d.tagName === "DETAILS") d.open = true;
    });
    await page.selectOption('[data-bind="action.enter.ease"]', "custom");
    const graph = await page
      .locator('[data-curve="enter"] polyline')
      .getAttribute("points");
    await page
      .locator('[data-bind="action.enter.bezier.1"][type="range"]')
      .evaluate((el) => {
        el.value = "0.2";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    assert.notEqual(
      await page
        .locator('[data-curve="enter"] polyline')
        .getAttribute("points"),
      graph,
    );
    assert.equal(
      await page.evaluate(
        () => window.__XPIN.project().shots[0].actions[0].bezier[1],
      ),
      0.2,
    );
    await page.evaluate(() => window.__XPIN.studio.store.undo());
    assert.equal(
      await page.evaluate(
        () => window.__XPIN.project().shots[0].actions[0].bezier[1],
      ),
      1,
    );
    await page.selectOption('[data-bind="action.enter.direction"]', "bottom");
    await page
      .locator('[data-bind="action.enter.fade"][type="number"]')
      .fill("0.9");
    await page
      .locator('[data-bind="action.enter.fade"][type="number"]')
      .dispatchEvent("change");
    const a = await page.evaluate(
      () => window.__XPIN.project().shots[0].actions[0],
    );
    assert.equal(a.direction, "bottom");
    assert.equal(a.fade, 0.9);
    const overflow = await page
      .locator(".track-row .numeric-control")
      .evaluateAll((rows) =>
        rows.some((row) =>
          Array.from(row.children).some(
            (el) =>
              el.getBoundingClientRect().right >
              row.getBoundingClientRect().right + 1,
          ),
        ),
      );
    assert.equal(
      overflow,
      false,
      "paired controls must fit inside their track",
    );
    return a;
  });
  await test("add-exit button creates late fade-out and saved project keeps curve controls", async () => {
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      s.select(["note"]);
      s.panel = "shot";
      s.renderInspector();
    });
    await page.click('[data-action="action-out"]');
    const a = await page.evaluate(() =>
      window.__XPIN.project().shots[0].actions.at(-1),
    );
    assert.equal(a.phase, "out");
    assert.ok(a.start > 4);
    const saved = await page.evaluate(() =>
      JSON.stringify(window.__XPIN.project()),
    );
    await page.setInputFiles("#project-file", {
      name: "motion.json",
      mimeType: "application/json",
      buffer: Buffer.from(saved),
    });
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() => JSON.stringify(window.__XPIN.project())),
      saved,
    );
    return { exit: a, roundtrip: true };
  });
  // Keyframes from the same GPU scene, arranged only for inspection.
  await page.evaluate(async (p) => {
    const s = window.__XPIN.studio;
    s.store.replace(p);
    await s.view.sync(s.p);
    s.setMode("director");
    s.panel = "shot";
    s.renderInspector();
  }, original);
  const times = [0.5, 0.7, 1.1, 1.6, 2.5, 4.5, 5.1, 5.6, 6.1, 6.5],
    frames = [];
  for (const [i, t] of times.entries())
    frames.push(await image(t, `motion-${i + 1}`));
  const sheet = await page.evaluate(
    async ({ frames, times }) => {
      const c = document.createElement("canvas");
      c.width = 1920;
      c.height = 520;
      const g = c.getContext("2d");
      g.fillStyle = "#111a16";
      g.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < frames.length; i++) {
        const im = new Image();
        im.src = "data:image/png;base64," + frames[i];
        await im.decode();
        const x = (i % 5) * 384,
          y = Math.floor(i / 5) * 260;
        g.drawImage(im, x, y, 384, 216);
        g.fillStyle = "#d9cead";
        g.font = "16px sans-serif";
        g.fillText(
          `${i < 5 ? "IN" : "OUT"} · ${times[i].toFixed(1)}s`,
          x + 14,
          y + 244,
        );
      }
      return c.toDataURL("image/png").split(",")[1];
    },
    { frames, times },
  );
  await writeFile(out + "/XPIN-V4.1-Motion.png", Buffer.from(sheet, "base64"));
  await writeFile(
    out + "/XPIN-V4.1-Motion-Project.json",
    JSON.stringify(original, null, 2),
  );
  await page.evaluate(() => {
    window.__XPIN.studio.seek(1.1);
  });
  await page.screenshot({ path: out + "/XPIN-V4.1-Controls.png" });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const audit = await page.evaluate(() => window.__XPIN.audit());
  await writeFile(
    out + "/motion-regression.json",
    JSON.stringify({ passed: results.length, results, errors, audit }, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length, errors }));
} finally {
  await browser.close();
}
