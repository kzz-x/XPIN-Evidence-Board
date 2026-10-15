import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.XPIN_EVIDENCE_DIR ?? "test-results/v51-final";
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
async function test(name, fn) {
  const evidence = await fn();
  results.push({ name, evidence });
  console.log("PASS " + name);
}
async function reveal(selector) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      for (let d = el.parentElement; d; d = d.parentElement)
        if (d.tagName === "DETAILS") d.open = true;
    });
}
async function png(name) {
  const bytes = await page.evaluate(async () => {
    const s = window.__XPIN.studio;
    return Array.from(
      new Uint8Array(
        await (await s.view.png(s.p, s.time, "build", 1280)).arrayBuffer(),
      ),
    );
  });
  await writeFile(`${out}/${name}.png`, Buffer.from(bytes));
}
try {
  await page.goto(process.env.XPIN_URL ?? "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__XPIN);
  await page.evaluate(() => window.__XPIN.ready);
  await test("all 15 physical module kinds cast real shadows onto another sheet under key and spotlight", async () => {
    const evidence = [];
    for (const kind of [
      "photo",
      "polaroid",
      "film",
      "file",
      "news",
      "folder",
      "profile",
      "map",
      "note",
      "label",
      "date",
      "pin",
      "clip",
      "tape",
      "staple",
    ]) {
      const row = await page.evaluate(async (kind) => {
        const s = window.__XPIN.studio,
          hw = ["clip", "pin", "staple"].includes(kind);
        const p = window.__XPIN.compile({
          format: "xpin-scene/1",
          settings: {
            grain: 0,
            dof: 0,
            ambient: 0.12,
            keyIntensity: 3,
            keyAzimuth: 140,
            keyElevation: 27,
            softness: 0.8,
          },
          camera: {
            target: [0, 0, 0.03],
            distance: 10,
            yaw: 0,
            pitch: 0,
            roll: 0,
            focal: 48,
          },
          items: [
            {
              id: "receiver",
              kind: "file",
              position: [0, 0, 0.025],
              width: 7,
              height: 5,
              wear: 0,
              paperCurl: 0,
            },
            {
              id: "caster",
              kind,
              position: [0, 0, 0.23],
              ...(hw ? {} : { width: 2, height: 1.6 }),
            },
          ],
          lights: [
            {
              id: "spot",
              position: [-4, 5, 7],
              target: [0, 0, 0],
              intensity: 0,
              angle: 45,
              shadow: true,
            },
          ],
        });
        s.store.replace(p);
        await s.view.sync(s.p);
        s.view.pose = p.camera;
        s.setMode("build");
        const caster = s.view.objects.get("caster"),
          capture = async () => {
            const blob = await s.view.png(s.p, 0, "build", 640),
              bitmap = await createImageBitmap(blob),
              c = document.createElement("canvas");
            c.width = bitmap.width;
            c.height = bitmap.height;
            const g = c.getContext("2d");
            g.drawImage(bitmap, 0, 0);
            bitmap.close();
            return {
              data: g.getImageData(0, 0, c.width, c.height).data,
              width: c.width,
              height: c.height,
            };
          };
        const rows = [];
        for (const light of ["key", "spot"]) {
          s.p.settings.keyIntensity = light === "key" ? 3 : 0;
          s.p.lights[0].intensity = light === "spot" ? 850 : 0;
          caster.traverse((n) => {
            if (n.isMesh) n.castShadow = true;
          });
          const on = await capture();
          // Project actual mesh bounds, so only RECEIVER pixels outside the caster can prove a shadow.
          const V = s.view.camera.position.constructor,
            bounds = { x0: 1, y0: 1, x1: -1, y1: -1 };
          caster.updateWorldMatrix(true, true);
          caster.traverse((n) => {
            if (!n.isMesh) return;
            n.geometry.computeBoundingBox();
            const b = n.geometry.boundingBox;
            for (const x of [b.min.x, b.max.x])
              for (const y of [b.min.y, b.max.y])
                for (const z of [b.min.z, b.max.z]) {
                  const v = new V(x, y, z)
                    .applyMatrix4(n.matrixWorld)
                    .project(s.view.camera);
                  bounds.x0 = Math.min(bounds.x0, v.x);
                  bounds.x1 = Math.max(bounds.x1, v.x);
                  bounds.y0 = Math.min(bounds.y0, v.y);
                  bounds.y1 = Math.max(bounds.y1, v.y);
                }
          });
          caster.traverse((n) => {
            if (n.isMesh) n.castShadow = false;
          });
          const off = await capture();
          let changed = 0,
            darkened = 0,
            max = 0;
          for (let y = Math.ceil(on.height * 0.08); y < on.height * 0.92; y++)
            for (let x = Math.ceil(on.width * 0.1); x < on.width * 0.9; x++) {
              const nx = (x / on.width) * 2 - 1,
                ny = 1 - (y / on.height) * 2;
              if (
                nx > bounds.x0 - 0.01 &&
                nx < bounds.x1 + 0.01 &&
                ny > bounds.y0 - 0.01 &&
                ny < bounds.y1 + 0.01
              )
                continue;
              let d = 0;
              for (let c = 0; c < 3; c++)
                d +=
                  off.data[(y * on.width + x) * 4 + c] -
                  on.data[(y * on.width + x) * 4 + c];
              max = Math.max(max, Math.abs(d));
              if (Math.abs(d) > 6) changed++;
              if (d > 6) darkened++;
            }
          rows.push({ light, changed, darkened, max });
        }
        return { kind, rows };
      }, kind);
      for (const r of row.rows)
        assert.ok(r.darkened > 8, `${kind} ${r.light}: ${JSON.stringify(r)}`);
      evidence.push(row);
    }
    return evidence;
  });
  await test("pin anchors and rope shadows survive curved hosts; silver shafts keep their metal after recoloring", async () => {
    const data = await page.evaluate(async () => {
      const s = window.__XPIN.studio,
        p = window.__XPIN.compile({
          format: "xpin-scene/1",
          settings: {
            dof: 0,
            grain: 0,
            keyIntensity: 3,
            ambient: 0.15,
            keyElevation: 27,
          },
          items: [
            {
              id: "paper",
              kind: "file",
              width: 5,
              height: 4,
              position: [0, 0, 0.03],
            },
          ],
          pins: [
            {
              id: "a",
              hostId: "paper",
              local: [-1, 0.4, 0.16],
              color: "#ff2233",
            },
            {
              id: "b",
              hostId: "paper",
              local: [1, 0.4, 0.16],
              color: "#ff2233",
            },
          ],
          ropes: [{ id: "rope", from: "a", to: "b" }],
        });
      s.store.replace(p);
      await s.view.sync(s.p);
      s.view.pose = {
        target: [0, 0.2, 0.1],
        distance: 7,
        yaw: 0.1,
        pitch: -0.15,
        roll: 0,
        focal: 48,
      };
      s.setMode("build");
      const capture = async () => {
        const b = await s.view.png(s.p, 0, "build", 640);
        return Array.from(new Uint8Array(await b.arrayBuffer()));
      };
      const on = await capture();
      s.view.ropes.get("rope").traverse((n) => {
        if (n.isMesh) n.castShadow = false;
      });
      const off = await capture();
      s.p.pins[0].color = "#2266ff";
      s.view.reconcile(s.p);
      const colors = [];
      s.view.pins.get("a").traverse((n) => {
        if (n.isMesh)
          colors.push({
            plastic: !!n.userData.pinPlastic,
            color: n.material.color.getHexString(),
          });
      });
      return { different: JSON.stringify(on) !== JSON.stringify(off), colors };
    });
    assert.ok(data.different);
    assert.equal(data.colors.find((c) => !c.plastic).color, "a6aaa5");
    assert.equal(data.colors.find((c) => c.plastic).color, "2266ff");
    await png("rope-and-pin-shadows");
    return data;
  });
  await test("wear sliders, presets, seed refresh, undo and project reopen preserve authored state", async () => {
    await page.evaluate(async () => {
      const s = window.__XPIN.studio;
      await s.action("new");
      s.add("photo", [0, 0, 0.025]);
      s.view.pose = {
        target: [0, 0, 0.07],
        distance: 8,
        yaw: 0.5,
        pitch: -0.25,
        roll: 0,
        focal: 48,
      };
      s.select([s.p.items[0].id]);
    });
    await reveal('[data-bind="item.wear"]');
    await page.selectOption('[data-bind="item.wearPreset"]', "torn");
    assert.equal(
      await page.locator('[data-bind="item.wear"][type="number"]').inputValue(),
      "1",
    );
    const before = await page.evaluate(() => {
      const s = window.__XPIN.studio;
      return structuredClone(s.p.items[0]);
    });
    await page
      .locator('[data-bind="item.stainAmount"][type="range"]')
      .evaluate((el) => {
        el.value = ".65";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    await page.locator('[data-action="paper-random"]').click();
    const after = await page.evaluate(() => window.__XPIN.studio.p.items[0]);
    assert.ok(Number.isInteger(after.wearSeed));
    assert.deepEqual(after.position, before.position);
    assert.equal(after.stainAmount, 0.65);
    await page.locator('[data-action="undo"]').click();
    assert.equal(
      await page.evaluate(() => window.__XPIN.studio.p.items[0].wearSeed),
      undefined,
    );
    await page.locator('[data-action="redo"]').click();
    const wait = page.waitForEvent("download");
    await page.locator('[data-action="save"]').click();
    const file = await wait;
    await file.saveAs(`${out}/wear.project.json`);
    await page
      .locator("#project-file")
      .setInputFiles(`${out}/wear.project.json`);
    assert.equal(
      await page.evaluate(() => window.__XPIN.studio.p.items[0].wearSeed),
      after.wearSeed,
    );
    await png("torn-photo");
    return {
      wear: after.wear,
      stains: after.stainAmount,
      seed: after.wearSeed,
      sourceTransformPreserved: true,
    };
  });
  await test("wear geometry and stain pigment change actual data independently at the same authored transform", async () => {
    const data = await page.evaluate(async () => {
      const s = window.__XPIN.studio,
        o = s.p.items[0],
        before = JSON.stringify(o.position);
      o.wear = 1;
      o.edgeTear = 1;
      o.paperCurl = 1.5;
      o.stainAmount = 0;
      await s.view.sync(s.p);
      const geo = () =>
          Array.from(
            s.view.objects.get(o.id).children[0].geometry.attributes.position
              .array,
          ),
        atlas = () => {
          const m = s.view.objects.get(o.id).children[0].material[0],
            c = m.map.image;
          return c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        };
      const shape = geo(),
        clean = atlas();
      o.stainAmount = 1;
      await s.view.sync(s.p);
      const stained = atlas();
      let changed = 0;
      for (let i = 0; i < clean.length; i += 4)
        if (Math.abs(clean[i] - stained[i]) > 1) changed++;
      const stainShape = JSON.stringify(shape) === JSON.stringify(geo());
      o.edgeTear = 0;
      await s.view.sync(s.p);
      const contourChanged = JSON.stringify(shape) !== JSON.stringify(geo());
      return {
        changed,
        stainShape,
        contourChanged,
        positionPreserved: before === JSON.stringify(o.position),
      };
    });
    assert.ok(data.changed > 500);
    assert.ok(data.stainShape && data.contourChanged && data.positionPreserved);
    return data;
  });
  await test("new overlapping paper is placed above the real curled surface, while source layouts are retained", async () => {
    const data = await page.evaluate(async () => {
      const s = window.__XPIN.studio;
      await s.action("new");
      s.add("file", [0, 0, 0]);
      const first = structuredClone(s.p.items[0]);
      s.add("note", [0, 0, 0]);
      return { first, retained: s.p.items[0], top: s.p.items[1] };
    });
    assert.deepEqual(data.first, data.retained);
    assert.ok(data.top.position[2] > data.first.position[2] + 0.015);
    return { lowerZ: data.first.position[2], upperZ: data.top.position[2] };
  });
  await test("folder depth and opening controls rebuild real layered geometry; folder typing still seeks", async () => {
    await page.evaluate(async () => {
      const s = window.__XPIN.studio,
        p = window.__XPIN.compile({
          format: "xpin-scene/1",
          settings: { dof: 0, grain: 0 },
          items: [{ id: "folder", kind: "folder", position: [0, 0, 0.04] }],
          shots: [
            {
              id: "shot",
              duration: 4,
              targetIds: ["folder"],
              actions: [
                {
                  id: "type",
                  targetId: "folder",
                  type: "type",
                  start: 0,
                  duration: 2,
                  strength: 1,
                },
              ],
            },
          ],
        });
      s.store.replace(p);
      await s.view.sync(s.p);
      s.view.pose = {
        target: [0, 0, 0.15],
        distance: 11,
        yaw: 0.7,
        pitch: -0.3,
        roll: 0,
        focal: 48,
      };
      s.setMode("build");
      s.select(["folder"]);
    });
    await reveal('[data-bind="item.folderOpen"]');
    await page
      .locator('[data-bind="item.folderOpen"][type="number"]')
      .fill("15");
    await page
      .locator('[data-bind="item.folderOpen"][type="number"]')
      .dispatchEvent("change");
    const data = await page.evaluate(() => {
      const s = window.__XPIN.studio;
      let leaves = 0,
        angle = 0;
      s.view.objects.get("folder").traverse((n) => {
        if (n.name.startsWith("Individual document leaf")) leaves++;
        if (n.name === "Raised front cover") angle = n.parent.rotation.y;
      });
      s.view.renderAt(s.p, 1, "play");
      s.view.renderAt(s.p, 0, "build");
      return { leaves, angle };
    });
    assert.equal(data.leaves, 5);
    assert.ok(Math.abs(data.angle + (15 * Math.PI) / 180) < 1e-6);
    await png("folder-open");
    return data;
  });
  await test("ink remains surface pigment and all three upgraded models render in macro without GPU errors", async () => {
    const ink = await page.evaluate(async () => {
      const s = window.__XPIN.studio,
        p = window.__XPIN.compile({
          format: "xpin-scene/1",
          items: [{ id: "stamp", kind: "stamp" }],
        });
      s.store.replace(p);
      await s.view.sync(s.p);
      let casts = 0;
      s.view.objects.get("stamp").traverse((n) => {
        if (n.isMesh) casts += n.castShadow;
      });
      return casts;
    });
    assert.equal(ink, 0);
    for (const kind of ["clip", "staple", "folder"]) {
      await page.evaluate(async (kind) => {
        const s = window.__XPIN.studio,
          p = window.__XPIN.compile({
            format: "xpin-scene/1",
            settings: {
              dof: 0,
              grain: 0,
              keyIntensity: 3,
              ambient: 0.25,
              keyAzimuth: 140,
              keyElevation: 35,
            },
            items: [{ id: "model", kind, position: [0, 0, 0.04] }],
          });
        s.store.replace(p);
        await s.view.sync(s.p);
        s.view.pose = {
          target: [0, kind === "clip" ? 0.18 : 0, 0.14],
          distance: kind === "folder" ? 11 : 2.8,
          yaw: kind === "folder" ? 0.75 : 0.5,
          pitch: -0.35,
          roll: 0,
          focal: 50,
        };
        s.setMode("build");
      }, kind);
      await png(`${kind}-macro`);
    }
    return { inkCastsShadow: false, models: 3 };
  });
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ passed: results.length, results, errors }, null, 2),
  );
  console.log(`${results.length}/${results.length} V5.1 cases passed`);
} finally {
  await browser.close();
}
