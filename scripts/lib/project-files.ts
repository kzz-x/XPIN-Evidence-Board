import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import {
  compileScene,
  clone,
  validateProject,
  type Project,
  type SceneBrief,
} from "../../src/authoring";

export async function readJson(file: string) {
  return JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
}
export async function readProject(file: string): Promise<Project> {
  const value = await readJson(file);
  if (value?.version !== 3)
    throw Error(
      "需要 version 3 工程；场景描述先用 compose 编译，V2 先在工作台转换保存。",
    );
  return validateProject(clone(value));
}
export async function readBrief(file: string): Promise<SceneBrief> {
  const b = (await readJson(file)) as SceneBrief & {
    assetFiles?: Record<string, string>;
  };
  if (b.format !== "xpin-scene/1") throw Error("需要 xpin-scene/1 场景描述");
  const mime: Record<string, string> = {
    ".png": "png",
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".webp": "webp",
    ".svg": "svg+xml",
  };
  for (const [id, local] of Object.entries(b.assetFiles ?? {})) {
    const path = resolve(dirname(file), local),
      type = mime[extname(path).toLowerCase()];
    if (!type) throw Error("不支持的图片格式：" + path);
    b.assets ??= {};
    b.assets[id] =
      `data:image/${type};base64,${(await readFile(path)).toString("base64")}`;
  }
  return b;
}
export async function compileFile(file: string, baseFile?: string) {
  return compileScene(
    await readBrief(file),
    baseFile ? await readProject(baseFile) : undefined,
  );
}
/** New output only: a typo must not replace the user's source or a previous deliverable. */
export async function writeNewJson(file: string, value: unknown) {
  await mkdir(dirname(resolve(file)), { recursive: true });
  try {
    await writeFile(file, JSON.stringify(value, null, 2) + "\n", {
      flag: "wx",
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST")
      throw Error("输出文件已存在，请换一个新文件名：" + file);
    throw e;
  }
}
