# 从这里开始

适用 Studio V5.1，工程格式 `version: 3`，Agent 描述格式 `xpin-scene/1`。

| 你想做什么 | 入口 |
|---|---|
| 手动搭板、安排镜头、播放与输出 | [人类使用指南](USER-GUIDE.md) |
| 让 Agent 从源代码直接制作工程 | [Agent 原生制作指南](AGENT-NATIVE.md) |
| 查字段、坐标、时间和增量更新规则 | [工程与场景协议速查](SCENE-REFERENCE.md) |
| 调整入场、退场、淡化和缓动 | [动画控制](MOTION.md) |
| 接续开发、了解真实进度 | [开发入口](../AGENTS.md)、[进度](../PROGRESS.md)、[架构](ARCHITECTURE.md) |

## 人类：三步开始

1. 下载仓库 `releases/XPIN-Evidence-Board-Studio-V5.1.html`，保存为 HTML 后用桌面 Edge / Chrome 打开。GitHub 文件页本身不是工作台。
2. 在「午夜档案」里体验，或选「空白调查板」开始；先摆物件，再加图钉／绳／标注，最后编排镜头。
3. 「保存工程」下载可编辑 JSON；「输出」生成图片或视频。HTML 是软件，JSON 是作品，视频是成片，三者分开保留。

## Agent：原生制作与检查

在源码仓库运行，首次先 `npm ci`。需要 Node.js 22.12+；本机验收使用 Node 24。

```sh
npm run project -- compose examples/quickstart/scene.json test-results/quickstart/project.json
npm run project -- validate test-results/quickstart/project.json
npm run project -- inspect test-results/quickstart/project.json test-results/quickstart/inspect.json
npm run project -- audit test-results/quickstart/project.json test-results/quickstart/audit.json
npm run project -- sample test-results/quickstart/project.json 1.1 test-results/quickstart/frame.json
```

`audit` 报告数值安全问题；发现 error 时退出码 2，只有 warning 则为 0。按报告修正后重测，不要忽略退出码。详见 [防穿模与运镜规范](PRODUCTION.md)。

这些命令直接运行 TypeScript 编译器、数据模型和时间线引擎，不启动浏览器、不模拟点击。输出只新建；重跑时使用新的输出文件名。自带本地素材，无需联网下载图片。

原生代码示例：

```sh
npm run native:example -- test-results/native-quickstart
```

它从本地场景描述生成工程，再按稳定 ID 增量修改，输出源工程、修改版、检查报告与 1.1 秒动画状态。源工程不被覆盖。

**能力边界：** 原生路径完成内容、布局、引用、灯光、镜头、动画和数据／时序检查。最终像素仍由工作台的 WebGL2 渲染器生成；当前没有纯 Node 的 PNG／MP4 渲染 CLI。把 JSON 交给人类在工作台播放检查、输出即可，不能把数值采样当作画面或视频验收。

`PRODUCT.md` 和 `ROADMAP.md` 包含长期目标；当前是否实现以本组指南和 `PROGRESS.md` 为准。
