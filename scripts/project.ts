import { inspectProject, sampleProject } from "../src/authoring";
import { compileFile, readProject, writeNewJson } from "./lib/project-files";

const help = `XPIN 原生工程工具（Node，无浏览器）
npm run project -- compose scene.json output.project.json [source.project.json]
npm run project -- validate project.json
npm run project -- inspect project.json [report.json]
npm run project -- sample project.json seconds [frame.json]
所有输出文件只新建，不覆盖。inspect 的 warnings 需人工判断，验证通过不代表视觉验收。`;
async function main() {
  const [command, file, arg, extra, ...rest] = process.argv.slice(2);
  if (command === "--help" || command === "help" || !command) {
    console.log(help);
    return;
  }
  if (!file || rest.length) throw Error(help);
  if (command === "compose") {
    if (!arg) throw Error(help);
    const p = await compileFile(file, extra);
    await writeNewJson(arg, p);
    console.log(
      JSON.stringify({ ok: true, output: arg, ...inspectProject(p) }, null, 2),
    );
    return;
  }
  const p = await readProject(file);
  if (command === "validate" && !arg && !extra) {
    console.log(
      JSON.stringify({
        ok: true,
        version: p.version,
        name: p.name,
        scope: "structure-and-references",
        renderValidated: false,
      }),
    );
    return;
  }
  if (command === "inspect" && !extra) {
    const report = inspectProject(p);
    if (arg) await writeNewJson(arg, report);
    else console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (command === "sample" && arg !== undefined && arg.trim() !== "") {
    const frame = sampleProject(p, Number(arg));
    if (extra) await writeNewJson(extra, frame);
    else console.log(JSON.stringify(frame, null, 2));
    return;
  }
  throw Error(help);
}
main().catch((e) => {
  console.error("XPIN：" + (e instanceof Error ? e.message : String(e)));
  process.exitCode = 1;
});
