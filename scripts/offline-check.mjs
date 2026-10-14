import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const file = resolve(process.argv[2] ?? "dist/XPIN-Evidence-Board-Studio.html");
const browser = await chromium.launch({
  executablePath:
    process.env.XPIN_BROWSER ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    }),
    errors = [],
    external = [];
  page.on("pageerror", (e) => {
    errors.push(String(e));
    console.log("PAGE ERROR " + e);
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.log(m.text());
  });
  await page.route(/^https?:/, (route) => {
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(file).href);
  try {
    await page.waitForFunction(() => window.__XPIN, { timeout: 15000 });
  } catch (e) {
    console.log(await page.locator("body").innerText());
    throw e;
  }
  await page.evaluate(() => window.__XPIN.ready);
  await page.waitForTimeout(1500);
  await page.click('[data-module="note"]');
  const p = await page.evaluate(() => window.__XPIN.project());
  assert.equal(p.items.length, 16);
  assert.equal(external.length, 0);
  assert.equal(errors.length, 0);
  const audit = await page.evaluate(() => window.__XPIN.audit());
  await writeFile(
    "test-results/offline.json",
    JSON.stringify({ file, audit, errors, external, addModule: true }, null, 2),
  );
  console.log(
    JSON.stringify({ audit, errors, external, addModule: true }, null, 2),
  );
} finally {
  await browser.close();
}
