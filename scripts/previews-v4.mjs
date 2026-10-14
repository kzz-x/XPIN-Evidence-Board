import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const out = process.env.XPIN_EVIDENCE_DIR ?? "test-results/v4";
await mkdir(out, { recursive: true });
const b = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
try {
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto("http://127.0.0.1:5173");
  await p.waitForFunction(() => window.__XPIN);
  await p.evaluate(() => window.__XPIN.ready);
  const brief = JSON.parse(
    await readFile("examples/Windowlight.scene.json", "utf8"),
  );
  await p.evaluate(async (brief) => {
    const s = window.__XPIN.studio,
      assets = window.__XPIN.project().assets;
    const project = window.__XPIN.compile(brief);
    project.assets = assets;
    project.items.find((o) => o.id === "photo-a").assetId = "bridge";
    const clip = project.items.find((o) => o.id === "clip-a");
    clip.position = [-1.2, 2.05, 0.045];
    s.store.replace(project);
    await s.view.sync(project);
    s.view.pose = structuredClone(project.camera);
    s.time = 3.9;
    s.setMode("build");
    s.panel = "scene";
    s.select([]);
    s.renderInspector();
  }, brief);
  async function png(name, t = 3.9, mode = "build") {
    const bytes = await p.evaluate(
      async ({ t, mode }) => {
        const s = window.__XPIN.studio;
        const blob = await s.view.png(s.p, t, mode, 1920, 2, "ultra");
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      },
      { t, mode },
    );
    await writeFile(`${out}/${name}.png`, Buffer.from(bytes));
  }
  await p.evaluate(() => {
    const s = window.__XPIN.studio;
    s.view.pose = {
      target: [0, 0.35, 0.1],
      distance: 12,
      yaw: 0.12,
      pitch: -0.2,
      roll: 0,
      focal: 52,
    };
    s.p.settings.dof = 0.18;
  });
  await png("XPIN-V4-Windowlight");
  await p.evaluate(() => {
    const s = window.__XPIN.studio;
    s.view.pose = {
      target: [1.2, -0.5, 0.05],
      distance: 6.5,
      yaw: 0.65,
      pitch: -0.3,
      roll: 0.03,
      focal: 60,
    };
    s.p.settings.dof = 0.2;
  });
  await png("XPIN-V4-Ink-Macro");
  await p.evaluate(() => {
    const s = window.__XPIN.studio;
    s.view.pose = {
      target: [-1.2, 1.85, 0.06],
      distance: 4.2,
      yaw: 0.55,
      pitch: -0.25,
      roll: 0,
      focal: 65,
    };
    s.p.settings.dof = 0.3;
  });
  await png("XPIN-V4-Clip-Macro");
  for (const [i, t] of [0.3, 0.8, 1.35, 2.5, 3.9].entries())
    await png(`XPIN-V4-Motion-${i + 1}`, t, "play");
  await p.evaluate(() => {
    const s = window.__XPIN.studio;
    s.view.pose = structuredClone(s.p.camera);
    s.time = 3.9;
    s.panel = "light";
    s.setMode("build");
    s.renderInspector();
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + "/XPIN-V4-Studio.png" });
  await writeFile(
    out + "/XPIN-Windowlight-Project.json",
    JSON.stringify(await p.evaluate(() => window.__XPIN.project()), null, 2),
  );
  console.log(
    "V4 scene, macro, motion keyframes, editor and editable project saved.",
  );
} finally {
  await b.close();
}
