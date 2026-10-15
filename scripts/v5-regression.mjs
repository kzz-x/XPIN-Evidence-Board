import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.XPIN_EVIDENCE_DIR ?? "test-results/v5";
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
async function reveal(selector) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      for (let d = el.parentElement; d; d = d.parentElement)
        if (d.tagName === "DETAILS") d.open = true;
    });
}
try {
  await page.goto(process.env.XPIN_URL ?? "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__XPIN);
  await page.evaluate(() => window.__XPIN.ready);
  await page.evaluate(async () => {
    const s = window.__XPIN.studio;
    await s.action("demo");
    await s.view.sync(s.p);
    s.view.pose = {
      ...s.p.camera,
      target: [1, -0.6, 0.1],
      distance: 15,
      yaw: 0.36,
      pitch: -0.2,
    };
  });
  await test("unified workspace and free view survive shot selection, seek, playback", async () => {
    const before = await page.evaluate(() =>
      structuredClone(window.__XPIN.studio.view.pose),
    );
    assert.equal(await page.locator(".modes").count(), 0);
    await page.locator(".shot-card").nth(1).click();
    await page.locator("#scrub").evaluate((el) => {
      el.value = "8";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator('[data-action="play"]').click();
    await page.waitForTimeout(450);
    await page.locator('[data-action="play"]').click();
    const state = await page.evaluate(() => {
      const s = window.__XPIN.studio;
      return {
        follow: s.followCamera,
        pose: s.view.pose,
        actual: s.view.camera.position.toArray(),
        time: s.time,
      };
    });
    assert.equal(state.follow, false);
    assert.deepEqual(state.pose, before);
    assert.ok(state.time > 8);
    return state;
  });
  await test("0 and playback checkbox opt into camera then restore the saved free view", async () => {
    const pose = await page.evaluate(() =>
      structuredClone(window.__XPIN.studio.view.pose),
    );
    await page.locator(".brand").click();
    await page.keyboard.press("0");
    await page.waitForTimeout(150);
    assert.equal(await page.locator("#follow-camera").isChecked(), true);
    const actual = await page.evaluate(() => {
      const s = window.__XPIN.studio;
      return { position: s.view.camera.position.toArray(), pose: s.view.pose };
    });
    assert.deepEqual(actual.pose, pose);
    await page.keyboard.press("0");
    assert.equal(await page.locator("#follow-camera").isChecked(), false);
    assert.deepEqual(
      await page.evaluate(() => window.__XPIN.studio.view.pose),
      pose,
    );
    await page.locator("#follow-camera").check();
    await page.waitForTimeout(150);
    await page.mouse.move(700, 400);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(740, 420, { steps: 4 });
    await page.mouse.up({ button: "middle" });
    assert.equal(await page.locator("#follow-camera").isChecked(), false);
    return {
      storyCamera: actual.position,
      restored: true,
      orbitReleases: true,
    };
  });
  await test("object animation and camera all-track editors share tracks across shots", async () => {
    const ids = await page.evaluate(() => {
      const s = window.__XPIN.studio,
        o = s.p.items[0];
      s.p.shots[0].actions = [
        {
          id: "v5-in",
          targetId: o.id,
          type: "slide",
          phase: "in",
          start: 0,
          duration: 1.8,
          strength: 1,
          ease: "smooth",
        },
      ];
      s.p.shots[1].actions = [
        {
          id: "v5-out",
          targetId: o.id,
          type: "slide",
          phase: "out",
          start: 2,
          duration: 1.8,
          strength: 1,
          ease: "smooth",
        },
      ];
      s.selectedShot = s.p.shots[3].id;
      s.select([o.id]);
      return { item: o.id, shot: s.p.shots[0].id };
    });
    assert.equal(await page.locator(".animation-shot").count(), 2);
    await reveal('[data-bind="action.v5-out.duration"]');
    await page
      .locator('[data-bind="action.v5-out.duration"][type="number"]')
      .fill("2.1");
    await page
      .locator('[data-bind="action.v5-out.duration"][type="number"]')
      .dispatchEvent("change");
    await page.locator('[data-panel="shot"]').click();
    await reveal('[data-bind="action.v5-out.duration"]');
    assert.equal(
      await page
        .locator('[data-bind="action.v5-out.duration"][type="number"]')
        .inputValue(),
      "2.1",
    );
    await page.selectOption('[data-bind="action.v5-out.shotId"]', ids.shot);
    assert.equal(
      await page.evaluate(
        () =>
          window.__XPIN.studio.p.shots[0].actions.find((a) => a.id === "v5-out")
            .duration,
      ),
      2.1,
    );
    await page.evaluate((id) => window.__XPIN.studio.select([id]), ids.item);
    await reveal('[data-bind="action.v5-out.ease"]');
    await page.selectOption('[data-bind="action.v5-out.ease"]', "custom");
    const old = await page
      .locator('[data-curve="v5-out"] polyline')
      .getAttribute("points");
    await page
      .locator('[data-bind="action.v5-out.bezier.1"][type="range"]')
      .evaluate((el) => {
        el.value = ".2";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    assert.notEqual(
      await page
        .locator('[data-curve="v5-out"] polyline')
        .getAttribute("points"),
      old,
    );
    return { sameTrack: true, moveOwner: true, curveAcrossShots: true };
  });
  await test("advanced controls fold by default and preserve user fold choices", async () => {
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      s.select([s.p.items[1].id]);
    });
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      document.querySelector(".inspector-panel").scrollTop = 500;
      s.select([s.p.items[2].id]);
    });
    assert.equal(
      await page.locator(".inspector-panel").evaluate((el) => el.scrollTop),
      0,
    );
    const counts = await page
      .locator("#inspector > details.section")
      .evaluateAll((ds) => ({
        total: ds.length,
        open: ds.filter((d) => d.open).length,
      }));
    assert.ok(counts.open <= 2);
    assert.ok(counts.total > counts.open);
    const position = page
      .locator("#inspector > details.section")
      .filter({ has: page.locator('[data-bind="item.position.0"]') });
    await position.locator(":scope > summary").click();
    await page.evaluate(() => window.__XPIN.studio.renderInspector());
    assert.equal(await position.getAttribute("open"), "");
    await page.screenshot({ path: `${out}/unified-workspace.png` });
    return counts;
  });
  await test("saving free navigation preserves authored camera and animation", async () => {
    const before = await page.evaluate(() => {
      const s = window.__XPIN.studio;
      return {
        camera: structuredClone(s.p.camera),
        shots: structuredClone(s.p.shots),
      };
    });
    const wait = page.waitForEvent("download");
    await page.locator('[data-action="save"]').click();
    const d = await wait;
    await d.saveAs(`${out}/saved.project.json`);
    const saved = JSON.parse(
      await (
        await import("node:fs/promises")
      ).readFile(`${out}/saved.project.json`, "utf8"),
    );
    assert.deepEqual(saved.camera, before.camera);
    assert.deepEqual(saved.shots, before.shots);
    assert.ok(saved.editorView);
    return { cameraPreserved: true, editorView: saved.editorView };
  });
  await test("production audit is visible and lift aid is explicit", async () => {
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      const a = s.p.items[0],
        b = s.p.items[1];
      b.position = structuredClone(a.position);
      b.width = a.width;
      b.height = a.height;
      b.rotation = a.rotation;
      b.paperCurl = a.paperCurl;
      s.select([b.id]);
    });
    await reveal('[data-action="lift-surface"]');
    await page.locator('[data-action="lift-surface"]').click();
    const z = await page.evaluate(
      () => window.__XPIN.studio.p.items[1].position[2],
    );
    await page.locator('[data-panel="shot"]').click();
    await reveal('[data-action="production-audit"]');
    await page.locator('[data-action="production-audit"]').click();
    assert.ok(await page.locator(".audit-list").count());
    return { liftedTo: z, auditShown: true };
  });
  await test("real high resolution depth shadows and world-scaled softness change macro pixels", async () => {
    const frames = await page.evaluate(async () => {
      const s = window.__XPIN.studio;
      await s.action("demo");
      await s.view.sync(s.p);
      const map = s.p.items.find((o) => o.kind === "map");
      s.view.pose = {
        target: [
          map.position[0],
          map.position[1] + 0.65,
          map.position[2] + 0.1,
        ],
        distance: 4.4,
        yaw: 0.42,
        pitch: -0.32,
        roll: 0,
        focal: 52,
      };
      s.p.settings.dof = 0;
      s.p.settings.grain = 0;
      s.p.settings.quality = "studio";
      const capture = async (softness) => {
        s.p.settings.softness = softness;
        const bytes = Array.from(
          new Uint8Array(
            await (
              await s.view.png(s.p, 0, "build", 1280, 1, "studio", s.view.pose)
            ).arrayBuffer(),
          ),
        );
        return {
          bytes,
          audit: s.view.audit(),
          radius: s.view.key.shadow.radius,
        };
      };
      return [await capture(0.2), await capture(1.7)];
    });
    for (let i = 0; i < frames.length; i++)
      await writeFile(
        `${out}/shadow-${i ? "soft" : "hard"}.png`,
        Buffer.from(frames[i].bytes),
      );
    assert.notDeepEqual(frames[0].bytes, frames[1].bytes);
    assert.ok(frames[1].radius > frames[0].radius);
    assert.equal(frames[1].audit.shadowMap, 4096);
    assert.ok(frames[1].audit.shadowExtent < 4);
    assert.ok(frames[1].audit.shadowCasters > 0);
    return frames.map(({ audit, radius }) => ({ audit, radius }));
  });
  await test("camera custom curves and aperture/focus controls update the same native timeline", async () => {
    await page.evaluate(() => {
      const s = window.__XPIN.studio;
      s.selectedShot = s.p.shots[0].id;
      s.panel = "shot";
      s.renderInspector();
    });
    await page.selectOption('[data-bind="shot.ease"]', "custom");
    const before = await page
      .locator("[data-camera-curve] polyline")
      .getAttribute("points");
    await page
      .locator('[data-bind="shot.bezier.1"][type="range"]')
      .evaluate((el) => {
        el.value = ".3";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    assert.notEqual(
      await page.locator("[data-camera-curve] polyline").getAttribute("points"),
      before,
    );
    await reveal('[data-bind="shot.camera.fStop"]');
    await page
      .locator('[data-bind="shot.camera.fStop"][type="number"]')
      .fill("2.8");
    await page
      .locator('[data-bind="shot.camera.fStop"][type="number"]')
      .dispatchEvent("change");
    await page.locator('[data-bind="shot.hasFocusPull"]').check();
    assert.ok(await page.locator('[data-bind="shot.focusPull.from"]').count());
    const data = await page.evaluate(() => {
      const s = window.__XPIN.studio;
      return s.p.shots[0];
    });
    assert.equal(data.camera.fStop, 2.8);
    assert.ok(data.focusPull);
    return {
      ease: data.ease,
      fStop: data.camera.fStop,
      focusPull: data.focusPull,
    };
  });
  await test("focus pull and f-stop affect actual depth-of-field pixels; materials expose distinct physical finishes", async () => {
    const captures = await page.evaluate(async () => {
      const s = window.__XPIN.studio,
        p = window.__XPIN.compile({
          format: "xpin-scene/1",
          settings: {
            grain: 0,
            dof: 0.65,
            board: "felt",
            keyAzimuth: 140,
            keyElevation: 35,
          },
          items: [
            {
              id: "photo",
              kind: "photo",
              position: [-0.8, 0, 0.05],
              width: 3,
              height: 2.5,
            },
            {
              id: "note",
              kind: "note",
              position: [1.4, 0.15, 0.8],
              width: 1.8,
              height: 2,
            },
          ],
          camera: {
            target: [0, 0, 0.3],
            distance: 7,
            yaw: 0.48,
            pitch: -0.16,
            roll: 0,
            focal: 42,
            fStop: 1.8,
          },
          shots: [
            {
              id: "lens",
              duration: 4,
              motion: "focus",
              targetIds: ["photo"],
              camera: {
                target: [0, 0, 0.3],
                distance: 7,
                yaw: 0.48,
                pitch: -0.16,
                roll: 0,
                focal: 42,
                fStop: 1.8,
              },
              focusPull: {
                from: 5.8,
                to: 7.5,
                start: 0.2,
                duration: 2,
                ease: "smooth",
              },
            },
          ],
        });
      s.store.replace(p);
      await s.view.sync(s.p);
      const capture = async (t) => ({
        bytes: Array.from(
          new Uint8Array(
            await (
              await s.view.png(s.p, t, "play", 1280, 1, "studio")
            ).arrayBuffer(),
          ),
        ),
        audit: s.view.audit(),
      });
      const a = await capture(0.2),
        b = await capture(2.3);
      s.p.camera.fStop = 16;
      s.p.shots[0].camera.fStop = 16;
      const c = await capture(2.3);
      const material = s.view.objects.get("photo").children[0].material[0],
        paper = s.view.objects.get("note").children[0].material[0];
      return {
        frames: [a, b, c],
        finish: {
          emulsionMask: !!material.clearcoatMap,
          photoClearcoat: material.clearcoat,
          paperSheen: paper.sheen,
          metalAnisotropy: s.view.materials.metal.anisotropy,
          metalMicrofinish: !!s.view.materials.metal.roughnessMap,
        },
      };
    });
    for (let i = 0; i < captures.frames.length; i++)
      await writeFile(
        `${out}/lens-${i}.png`,
        Buffer.from(captures.frames[i].bytes),
      );
    const [a, b, c] = captures.frames;
    assert.notDeepEqual(a.bytes, b.bytes);
    assert.notDeepEqual(b.bytes, c.bytes);
    assert.ok(a.audit.focus < b.audit.focus);
    assert.ok(c.audit.aperture < b.audit.aperture / 5);
    assert.ok(
      captures.finish.emulsionMask &&
        captures.finish.paperSheen > 0 &&
        captures.finish.metalMicrofinish,
    );
    return {
      frames: captures.frames.map((f) => f.audit),
      finish: captures.finish,
    };
  });
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ ok: true, results, errors }, null, 2),
  );
  console.log(`${results.length}/${results.length} V5 cases passed`);
} finally {
  await browser.close();
}
