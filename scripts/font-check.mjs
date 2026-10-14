import { chromium } from "@playwright/test";
const b = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: process.env.XPIN_FONT_HEADED !== "1",
  args: ["--window-position=-3000,-3000"],
});
try {
  const p = await b.newPage();
  await p.goto("http://127.0.0.1:5173");
  await p.waitForFunction(() => window.__XPIN);
  const c = await p.context().newCDPSession(p);
  await c.send("Browser.setPermission", {
    permission: { name: "local-fonts" },
    setting: "granted",
    origin: "http://127.0.0.1:5173",
  });
  console.log(
    await p.evaluate(async () => {
      let result, error;
      try {
        result = (await window.queryLocalFonts()).length;
      } catch (e) {
        error = String(e);
      }
      await window.__XPIN.studio.action("fonts");
      return {
        result,
        error,
        loaded: window.__XPIN.studio.fonts.length,
        toast: document.querySelector("#toast").textContent,
      };
    }),
  );
} finally {
  await b.close();
}
