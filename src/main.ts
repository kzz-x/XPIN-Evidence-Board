import "./styles.css";
import { Studio } from "./studio";
import { restore } from "./store";
import { demoProject } from "./modules";
const root = document.querySelector<HTMLDivElement>("#app")!;
try {
  const saved = await restore().catch(() => undefined);
  const studio = new Studio(root, saved ?? demoProject());
  await studio.ready;
  document.querySelector("#loading")?.remove();
} catch (error) {
  root.innerHTML =
    '<div class="fatal"><h1>三维工作台未能启动</h1><p>需要支持 WebGL2 的 Chrome 或 Edge。此版本没有模拟光影后备。</p><pre></pre></div>';
  root.querySelector("pre")!.textContent = String(error);
  console.error(error);
}
