import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { compileScene, type SceneBrief } from "../src/compose";
const [input, output, baseFile] = process.argv.slice(2);
if (!input || !output)
  throw Error(
    "用法：npm run compose -- scene.json output.json [existing-project.json]",
  );
const b = JSON.parse(await readFile(input, "utf8")) as SceneBrief & {
  assetFiles?: Record<string, string>;
};
for (const [id, file] of Object.entries(b.assetFiles ?? {})) {
  const path = resolve(dirname(input), file),
    extension = extname(path).toLowerCase();
  const mime = (
    {
      ".png": "png",
      ".jpg": "jpeg",
      ".jpeg": "jpeg",
      ".webp": "webp",
      ".svg": "svg+xml",
    } as Record<string, string>
  )[extension];
  if (!mime) throw Error("不支持的图片格式 " + extension);
  b.assets ??= {};
  b.assets[id] =
    `data:image/${mime};base64,${(await readFile(path)).toString("base64")}`;
}
const base = baseFile
  ? JSON.parse(await readFile(baseFile, "utf8"))
  : undefined;
const p = compileScene(b, base);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(p, null, 2));
console.log(
  `已生成可编辑工程：${output}；${p.items.length} 物件 / ${p.shots.length} 镜头`,
);
