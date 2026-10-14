import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const b = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
try {
  await p.goto("http://127.0.0.1:5173");
  await p.waitForFunction(() => window.__XPIN);
  await p.evaluate(() => window.__XPIN.ready);
  for (const t of [15, 2, 15, 15]) {
    await p.evaluate((t) => window.__XPIN.seek(t), t);
    await p.waitForTimeout(80);
    const uri = await p.evaluate(async () => {
      const blob = await window.__XPIN.png(1280);
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result);
        f.readAsDataURL(blob);
      });
    });
    const i = globalThis.i ?? 0;
    globalThis.i = i + 1;
    await writeFile(
      `test-results/seek-${i}.png`,
      Buffer.from(uri.split(",")[1], "base64"),
    );
  }
  console.log(await p.evaluate(() => window.__XPIN.audit()));
} finally {
  await b.close();
}
