import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
const report = {};
try {
  const legacy = await browser.newPage();
  await legacy.goto(
    "http://127.0.0.1:5173/prototypes/XPIN-Evidence-Board-True3D-V2.html",
  );
  const waiting = legacy.waitForEvent("download");
  await legacy.click("#exportBtn");
  const file = await waiting;
  await file.saveAs("test-results/v2-fixture.json");
  const v2 = JSON.parse(await readFile("test-results/v2-fixture.json", "utf8"));
  await legacy.close();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__XPIN);
  await page.evaluate(() => window.__XPIN.ready);
  await page.setInputFiles("#project-file", "test-results/v2-fixture.json");
  await page.waitForTimeout(250);
  const p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.version, 3);
  assert.equal(p.items.length, v2.objects.length);
  assert.equal(p.ropes.length, v2.links.length);
  assert.equal(p.pins.length, v2.pins.length);
  report.migration = {
    items: p.items.length,
    pins: p.pins.length,
    ropes: p.ropes.length,
  };
  await page.click('[data-action="demo"]');
  await page.waitForTimeout(200);
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
    s.p.settings.ambient = 0.2;
    s.p.settings.keyIntensity = 2.1;
  });
  await page.evaluate(() =>
    window.__XPIN.studio.view.sync(window.__XPIN.studio.p),
  );
  await page.waitForTimeout(150);
  const uri = await page.evaluate(async () => {
    const blob = await window.__XPIN.png(1920);
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result);
      f.readAsDataURL(blob);
    });
  });
  await writeFile(
    "test-results/macro.png",
    Buffer.from(uri.split(",")[1], "base64"),
  );
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.p.shots = s.p.shots.slice(0, 1);
    s.p.shots[0].duration = 1;
    s.p.settings.dof = 0;
  });
  await page.click('[data-action="output"]');
  await page.selectOption("#export-format", "mp4");
  const wait = page.waitForEvent("download", { timeout: 60000 });
  await page.click('[data-action="video"]');
  const d = await wait;
  await d.saveAs("test-results/video-fixture.mp4");
  report.mp4 = {
    bytes: (await readFile("test-results/video-fixture.mp4")).length,
  };
  await writeFile(
    "test-results/targeted.json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} finally {
  await browser.close();
}
