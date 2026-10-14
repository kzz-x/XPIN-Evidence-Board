import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const out = resolve(process.argv[2] ?? "dist/XPIN-Evidence-Board-Studio.html");
const files = await readdir("dist/assets"),
  js = files.find((f) => f.endsWith(".js")),
  css = files.find((f) => f.endsWith(".css"));
if (!js || !css) throw Error("Run npm run build first.");
let html = await readFile("dist/index.html", "utf8"),
  code = await readFile("dist/assets/" + js, "utf8"),
  style = await readFile("dist/assets/" + css, "utf8");
html = html
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, "")
  .replace(/<link rel="stylesheet"[^>]+>/, "");
html = html
  .replace("</head>", () => `<style>${style}</style></head>`)
  .replace(
    "</body>",
    () =>
      `<script type="module">${code.replace(/<\/script/gi, "<\\/script")}</script></body>`,
  );
await mkdir(resolve(out, ".."), { recursive: true });
if (process.argv[3]) {
  const fonts = JSON.parse(
    (await readFile(process.argv[3], "utf8")).replace(/^\uFEFF/, ""),
  );
  if (
    fonts.format !== "xpin-fonts/1" ||
    !Array.isArray(fonts.families) ||
    !fonts.families.every((f) => typeof f === "string")
  )
    throw Error("Invalid font catalogue");
  html = html.replace(
    "</head>",
    () =>
      `<script type="application/json" id="xpin-local-fonts">${JSON.stringify(fonts).replace(/</g, "\\u003c")}</script></head>`,
  );
}
await writeFile(out, html);
console.log(out);
