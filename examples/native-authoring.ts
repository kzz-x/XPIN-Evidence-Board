/** Run from the repo: npm run native:example -- test-results/my-native-project */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileScene,
  clone,
  validateProject,
  evaluate,
  inspectProject,
  auditProduction,
  sampleProject,
  type SceneBrief,
} from "../src/authoring";
import { readBrief, writeNewJson } from "../scripts/lib/project-files";

const here = fileURLToPath(new URL(".", import.meta.url));
const output = resolve(process.argv[2] ?? "test-results/native-quickstart");
const project = compileScene(
  await readBrief(resolve(here, "quickstart/scene.json")),
);
// Existing source: load the saved version-3 JSON and validate a clone instead.
// const project=validateProject(JSON.parse(await readFile("source.project.json","utf8")));
const before = JSON.stringify(project);
const patch = JSON.parse(
  await readFile(resolve(here, "quickstart/patch.json"), "utf8"),
) as SceneBrief;
const revised = compileScene(patch, clone(project));
validateProject(revised);
const frame = evaluate(revised, 1.1); // Native Maps: no DOM and no browser session.
if (JSON.stringify(project) !== before) throw Error("源工程被修改");
await writeNewJson(resolve(output, "source.project.json"), project);
await writeNewJson(resolve(output, "revised.project.json"), revised);
await writeNewJson(resolve(output, "inspect.json"), inspectProject(revised));
await writeNewJson(
  resolve(output, "production-audit.json"),
  auditProduction(revised),
);
await writeNewJson(
  resolve(output, "frame-1.1.json"),
  sampleProject(revised, 1.1),
);
console.log(
  JSON.stringify(
    {
      output,
      sourcePreserved: true,
      camera: frame.camera,
      photoProgress: frame.progress.get("photo-a"),
      browserRequired: false,
      renderValidated: false,
    },
    null,
    2,
  ),
);
