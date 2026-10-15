import { compileFile, writeNewJson } from "./lib/project-files";
async function main() {
  const [input, output, baseFile, ...rest] = process.argv.slice(2);
  if (!input || !output || rest.length)
    throw Error(
      "用法：npm run compose -- scene.json output.json [existing-project.json]",
    );
  const p = await compileFile(input, baseFile);
  await writeNewJson(output, p);
  console.log(
    `已生成可编辑工程：${output}；${p.items.length} 物件 / ${p.shots.length} 镜头`,
  );
}
main().catch((e) => {
  console.error("XPIN：" + (e instanceof Error ? e.message : String(e)));
  process.exitCode = 1;
});
