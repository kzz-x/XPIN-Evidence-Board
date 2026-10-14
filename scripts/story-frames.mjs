import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__XPIN);
  await page.evaluate(() => window.__XPIN.ready);
  const frames = [];
  for (const t of [0, 2.5, 5.5, 8, 10.5, 13, 16, 19.8]) {
    const uri = await page.evaluate(async (t) => {
      const s = window.__XPIN.studio;
      s.seek(t);
      const blob = await s.view.png(s.p, t, "play", 480);
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result);
        f.readAsDataURL(blob);
      });
    }, t);
    frames.push({ t, uri });
  }
  const sheet = await page.evaluate(async (frames) => {
    const c = document.createElement("canvas");
    c.width = 1920;
    c.height = 624;
    const g = c.getContext("2d");
    g.fillStyle = "#141c16";
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < frames.length; i++) {
      const im = new Image();
      im.src = frames[i].uri;
      await im.decode();
      const x = (i % 4) * 480,
        y = Math.floor(i / 4) * 312;
      g.drawImage(im, x, y, 480, 270);
      g.fillStyle = "#cbbc92";
      g.font = "14px monospace";
      g.fillText(
        `${String(i + 1).padStart(2, "0")} / ${frames[i].t.toFixed(1)}s`,
        x + 18,
        y + 297,
      );
    }
    return c.toDataURL("image/png");
  }, frames);
  await writeFile(
    "test-results/storyboard.png",
    Buffer.from(sheet.split(",")[1], "base64"),
  );
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.time = 0;
    s.togglePlay();
  });
  await page.waitForFunction(
    () => !window.__XPIN.studio.playing && window.__XPIN.studio.time >= 20,
    {},
    { timeout: 30000 },
  );
  await writeFile(
    "test-results/playback.json",
    JSON.stringify(
      {
        duration: await page.evaluate(() => window.__XPIN.studio.time),
        errors,
      },
      null,
      2,
    ),
  );
  console.log({ fullPlaybackSeconds: 20, errors });
} finally {
  await browser.close();
}
