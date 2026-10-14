import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile,access,mkdir } from "node:fs/promises";
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const fontList=process.env.XPIN_FONTS_PATH??'test-results/local-fonts.json';
try{await access(fontList);}catch{await mkdir('test-results',{recursive:true});await promisify(execFile)('powershell.exe',['-NoProfile','-File','scripts/export-fonts.ps1','-OutputPath',fontList]);}
const b = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"],
});
try {
  const p = await b.newPage({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [];
  p.on("pageerror", (e) => {
    errors.push(String(e));
    console.log("ERROR " + e);
  });
  p.on("console", (m) => {
    if (m.type() === "error") console.log(m.text());
  });
  await p.goto("http://127.0.0.1:5173");
  await p.waitForFunction(() => window.__XPIN);
  await p.evaluate(() => window.__XPIN.ready);
  await p.setInputFiles(
    "#font-file",
    fontList,
  );
  const count = await p.evaluate(() => window.__XPIN.studio.fonts.length);
  assert.ok(count > 1000);
  console.log("font catalogue imported: " + count);
  await p.evaluate(() => {
    const s = window.__XPIN.studio;
    s.panel = "object";
    s.select([s.p.items.find((o) => o.kind === "clip").id]);
  });
  const hardware=await p.evaluate(async()=>{const s=window.__XPIN.studio,o=s.p.items.find(o=>o.id===s.selection[0]);s.store.edit(()=>{o.width*=2;o.roughness=.85;});await s.view.sync(s.p);s.view.renderAt(s.p,s.time,'build');const g=s.view.objects.get(o.id);return {scale:g.scale.x,roughness:g.children[0].material.roughness,paperControls:document.querySelectorAll('[data-bind="item.paperCurl"]').length};});
  assert.equal(hardware.scale,2);assert.equal(hardware.roughness,.85);assert.equal(hardware.paperControls,0);console.log('hardware controls: '+JSON.stringify(hardware));
  await p.click('[data-action="entrance"]');
  const action = await p.evaluate(
    () => window.__XPIN.studio.p.shots[0].actions.at(-1).type,
  );
  assert.equal(action, "clamp");
  console.log("component entrance: " + action);
  await p.setInputFiles("#audio-file", "test-results/audio-fixture.wav");
  await p.click('[data-action="output"]');
  await p.selectOption("#export-quality", "master");
  await p.selectOption("#export-fps", "30");
  await p.click('[data-action="record-start"]');
  await p.evaluate(() => window.__XPIN.studio.togglePlay());
  await p.waitForTimeout(2200);
  const d = p.waitForEvent("download", { timeout: 30000 });
  await p.click('[data-action="record-stop-top"]');
  await p.waitForTimeout(1500);
  console.log(
    await p.evaluate(() => ({
      state: window.__XPIN.studio.recorder.recorder?.state,
      chunks: window.__XPIN.studio.recorder.chunks.length,
      notice: document.querySelector("#toast").textContent,
    })),
  );
  await (await d).saveAs("test-results/v4/live-audio.webm");
  console.log("live audio recorded and remuxed");
  await p.click('[data-action="output"]');
  await p.evaluate(() => {
    const s = window.__XPIN.studio;
    s.p.shots = s.p.shots.slice(0, 1);
    s.p.shots[0].duration = 0.5;
    s.p.settings.dof = 0.3;
  });
  await p.selectOption("#export-format", "mp4");
  await p.selectOption("#export-quality", "master");
  await p.selectOption("#export-fps", "60");
  const video = p.waitForEvent("download", { timeout: 60000 });
  await p.click('[data-action="video"]');
  await (await video).saveAs("test-results/v4/master-60.mp4");
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/v4/controls-media.json",
    JSON.stringify({ fontCount: count, entrance: action,hardware, errors }, null, 2),
  );
  console.log("60fps master with 2x supersampling encoded");
} finally {
  await b.close();
}
