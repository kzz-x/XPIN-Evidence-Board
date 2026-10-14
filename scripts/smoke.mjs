import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const out = process.env.XPIN_EVIDENCE_DIR ?? "test-results";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => window.__XPIN, { timeout: 30000 });
await page.evaluate(() => window.__XPIN.ready);
await page.waitForTimeout(2000);
await page.screenshot({ path: out + "/studio.png" });
const audit = await page.evaluate(() => window.__XPIN.audit());
const png = await page.evaluate(async () => {
  const b = await window.__XPIN.png(1600);
  return Array.from(new Uint8Array(await b.arrayBuffer()));
});
await writeFile(out + "/overview.png", Buffer.from(png));
await writeFile(
  out + "/smoke.json",
  JSON.stringify({ audit, errors }, null, 2),
);
console.log(JSON.stringify({ audit, errors }, null, 2));
await browser.close();
