import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const rate = 48000,
  count = rate,
  b = Buffer.alloc(44 + count * 2);
b.write("RIFF");
b.writeUInt32LE(b.length - 8, 4);
b.write("WAVEfmt ", 8);
b.writeUInt32LE(16, 16);
b.writeUInt16LE(1, 20);
b.writeUInt16LE(1, 22);
b.writeUInt32LE(rate, 24);
b.writeUInt32LE(rate * 2, 28);
b.writeUInt16LE(2, 32);
b.writeUInt16LE(16, 34);
b.write("data", 36);
b.writeUInt32LE(count * 2, 40);
for (let i = 0; i < count; i++)
  b.writeInt16LE(
    Math.round(Math.sin((i * 2 * Math.PI * 440) / rate) * 5000),
    44 + i * 2,
  );
await writeFile("test-results/audio-fixture.wav", b);
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__XPIN);
  await page.evaluate(() => window.__XPIN.ready);
  await page.evaluate(() => {
    const s = window.__XPIN.studio;
    s.p.shots = s.p.shots.slice(0, 1);
    s.p.shots[0].duration = 1;
    s.p.settings.dof = 0;
  });
  await page.setInputFiles("#audio-file", "test-results/audio-fixture.wav");
  await page.waitForTimeout(100);
  await page.click('[data-action="output"]');
  for (const format of ["webm", "mp4"]) {
    await page.selectOption("#export-format", format);
    const wait = page.waitForEvent("download", { timeout: 60000 });
    await page.click('[data-action="video"]');
    const d = await wait;
    await d.saveAs(`test-results/with-audio.${format}`);
    console.log("encoded " + format + " with audio");
  }
} finally {
  await browser.close();
}
