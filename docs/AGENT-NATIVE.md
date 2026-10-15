# Agent 原生制作指南

目标：Agent 直接用 TypeScript 数据模型、场景编译器和时间线引擎制作可编辑作品。**本指南不要求浏览器会话、页面点击、DOM 选择器或 `window.__XPIN`。** 人类只需打开最终工程，播放检查并决定输出。

适用 Studio V5 / Project version 3；这是仓库内源码 API，不是已发布到 npm 的 SDK 包。字段详见 [协议速查](SCENE-REFERENCE.md)，人类操作见 [USER-GUIDE](USER-GUIDE.md)。

## 1. 先拿到正确的源

在已有仓库执行 `git pull --ff-only`，记录读取的 commit；有本地未提交修改时先保留，不重置、不强制覆盖。读 `AGENTS.md`、`PROGRESS.md` 和用户提供的工程 JSON，确认要保留的手动布局、机位、文字、素材与轨道。

需要的是 **模块化源码仓库**，不只是一份打包后的 HTML。HTML 供人类使用；不要反编译 HTML 再另造一套场景。

运行需要 Node.js 22.12+、npm 和源码依赖。本机测试使用 Node 24。第一次在仓库执行 `npm ci`；之后直接运行命令，无需启动 `npm run dev`。

## 2. 先跑通最短闭环

下面所有编译、修改、检查和采样都在 Node 内完成，使用自带本地素材：

```sh
npm run project -- compose examples/quickstart/scene.json test-results/quickstart/project.json
npm run project -- validate test-results/quickstart/project.json
npm run project -- inspect test-results/quickstart/project.json test-results/quickstart/inspect.json
npm run project -- audit test-results/quickstart/project.json test-results/quickstart/audit.json
npm run project -- sample test-results/quickstart/project.json 1.1 test-results/quickstart/frame.json
npm run project -- compose examples/quickstart/patch.json test-results/quickstart/revised.json test-results/quickstart/project.json
```

输出必须使用新文件名。CLI 以独占新建方式写入；目标已存在会报错，不覆盖源或上次结果。`test-results/` 被 Git 忽略，适合练习；正式交付请选择明确的交付目录。

| 命令 | 输入 | 输出及含义 |
|---|---|---|
| `compose` | 描述、输出路径、可选源工程 | 新的 version 3 可编辑工程；读取本地图片并内嵌 |
| `validate` | 完整工程 | 结构、参数与引用验证；成功退出码 0，失败非 0 |
| `inspect` | 完整工程、可选报告路径 | `xpin-inspect/1`；ID、引用、镜头全局时段、时序警告，不打印内嵌素材正文 |
| `audit` | 完整工程、可选报告路径 | `xpin-production-audit/1`；采样纸面、端点和摄影机；error 退出码 2，warning 为 0 |
| `sample` | 完整工程、全局秒数、可选帧路径 | `xpin-frame/1`；相机、物件变换、淡化、钉位置、绳端、灯光等可序列化状态 |

`inspect` 的 `warnings` 不导致失败：跨镜头延长可能是有意的，但重叠动作、超出故事的动作必须审查。成功验证只证明数据，不证明构图、无遮挡、电影质感或声音语义同步。

使用报告文件参数可以避免 shell 重定向的编码差异。要从 stdout 读取 JSON，可用 `npm run --silent project -- inspect path.json` 或 `npx tsx scripts/project.ts inspect path.json`。JSON 读取兼容 UTF-8 BOM。

原有 `npm run compose -- scene.json output.json [source.json]` 仍可用，现在和新命令共享文件加载与保护逻辑，同样只新建输出。

## 3. 用 TypeScript 直接调用

原生入口是 [src/authoring.ts](../src/authoring.ts)，不导入 `studio.ts`、DOM、Three 渲染器或图片打包资源。

完整示例位于 [examples/native-authoring.ts](../examples/native-authoring.ts)：

```sh
npm run native:example -- test-results/native-quickstart
```

得到 `source.project.json`、`revised.project.json`、`inspect.json`、`production-audit.json`、`frame-1.1.json`。示例直接调用编译器和 `evaluate`，并断言源工程未被修改。

自己写代码时，可将以下脚本保存到仓库 `examples/my-scene.ts`，通过 `npx tsx examples/my-scene.ts` 运行：

```ts
import { writeFile } from "node:fs/promises";
import {
  compileScene, makeShot, validateProject, sampleProject,
} from "../src/authoring";

const p = compileScene({
  format: "xpin-scene/1",
  name: "我的第一个原生作品",
  items: [{ id: "note", kind: "note", title: "线索 01",
    body: "先展示事实，再建立关系。", position: [0, 0, 0.04] }],
});
const shot = makeShot(p, ["note"], "push");
shot.id = "shot-intro";
shot.duration = 4;
shot.actions.push({ id: "note-in", targetId: "note", type: "peel",
  start: 0.2, duration: 2, strength: 0.5,
  phase: "in", ease: "smooth", direction: "bottom", fade: 0.85 });
p.shots.push(shot);
p.camera = structuredClone(shot.camera); // 明确首镜过渡起点
validateProject(p);
await writeFile("my-project.json", JSON.stringify(p, null, 2), { flag: "wx" });
console.log(sampleProject(p, 1.1));
```

| 原生 API | 用途 / 注意 |
|---|---|
| `compileScene(brief, base?)` | 默认值合并、稳定 ID upsert、引用验证；已有源请传 `clone(base)` |
| `modules / moduleByKind` | 查询当前真实母版及尺寸；不要照长期 PRODUCT 清单发明 kind |
| `makeShot / poseFor` | 自动构图；`makeShot` 返回镜头，需要自行加入 `p.shots` |
| `makeLight / sunlight / applyCinemaLook` | 构造灯或应用布光；应用预设会修改传入工程 |
| `annotation` | 生成宿主局部的 circle / underline / arrow / wave 笔迹 |
| `localToWorld / worldToLocal / pinWorld` | 坐标换算与绑定；钉和绳不能写成屏幕像素 |
| `duplicateSelection / removeIds` | 修改工程并维护相关引用；副本使用新 ID，删除可能级联 |
| `evaluate(p, seconds)` | 纯时间求值，返回 Map，不应向原工程写回中间姿态 |
| `inspectProject / sampleProject` | 克隆后验证，返回普通 JSON 对象；`renderValidated:false` |
| `auditProduction(p, step?)` | 非破坏检查；默认 0.25 秒采样，长故事最多约 480 等间隔样本并加动作边界；明确连续碰撞未证明 |
| `surfaceAt / liftToSurface / ropeHeights` | 查询稳定纸面高度、明确抬高单件、计算实体绳安全高度；不代表完整形体碰撞 |
| `validateProject` | 验证并补缺省值，会规范化传入对象；保护原对象时先 clone |

`evaluate` 的 Map 不能直接 `JSON.stringify`，否则会变成 `{}`。用 `sampleProject`，或显式 `Object.fromEntries(frame.transforms)`。采样时间是全局秒数，超出故事范围会按引擎规则钳制；NaN / Infinity 不允许。

需要嵌入声音时，可在 Node 中读取音轨，写入 `p.audio = "data:audio/wav;base64," + bytes.toString("base64")`，再验证保存；MIME 应匹配实际格式。`SceneBrief` 当前没有 `audioFile` 字段，不能虚构这个参数。

## 4. 从用户描述变成可编辑工程

必须配合 [制作规范：防穿模、时序与摄影机](PRODUCTION.md)。先设计叙事节拍和空间层级，再生成轨道。分镜表必须考虑不同角度、不同景别和焦点交接；有意保持一致时说明叙事原因，不能默认全程正面同景别。只有源文件和描述也能完成数据制作；不得用页面点击作为制作接口。不要承诺数据报告通过就已达到电影写实。

1. **列实体与保留项。** 建立稳定 ID 表，区分纸张、宿主钉、绳、笔迹、灯、镜头；标记不能动的源数据。
2. **先做静态布局。** 用 XY 板面、Z 高度和真实尺寸摆好，选字体、画幅、材料。必要时用 `fitBoard` 调板框；它不会移动物件，也不是相机重构图。
3. **建引用关系。** `Pin.hostId/local` → 纸；`Rope.from/to` → 钉；`Mark.hostId/points` → 局部纸面；灯可绑定宿主。
4. **拆成可读镜头。** 每镜明确目标、时长、运动、开始／结束信息。先自动构图，确有要求再填完整手动 `camera`。
5. **编排动作和追光。** 纸稳 → 钉入 → 拉绳 → 标注；固定件与阅读留白错开。出入场曲线见 [MOTION](MOTION.md)。
6. **生成新工程、检查、交接。** 输出独立 JSON、修改说明、数据报告与关键时刻状态。由人类打开工作台检查视觉和播放，授权后输出作品。

给每条轨道和每个实体显式 ID，便于下一轮定位。自动构造函数可能生成 UUID；`look` 的管理灯也可能生成新 ID。因此“相同输入的时间求值可重复”不代表“多次重新编译得到逐字节相同的文件”。需要可重复的项目 diff 时保留上次源、复用 ID，或显式定义灯和轨道。

### 图片路径与素材

`examples/quickstart/scene.json` 中的 `assetFiles` 相对**描述文件所在目录**解析，不是当前 shell 目录。CLI 将 PNG/JPG/JPEG/WebP/SVG 转为内嵌 `assets`，物件用 `assetId` 引用。

原生 `compileScene()` 不读取磁盘；可以直接提供 `assets` 的 data URI，或在 Node 侧先调用 `scripts/lib/project-files.ts` 的 `readBrief()`。把含 `assetFiles` 的原始 JSON 直接交给浏览器无法读取本地路径；应导入编译后的完整工程。

实际内容图请使用有权使用的高质量素材。示例地图只用于验证制作链路，不代表最终写实美术质量。原生编译器不解码图片像素，文件存在和 JSON 合法也不能证明图片视觉正确。

## 5. 增量修改：先懂合并规则

完整规则见 [SCENE-REFERENCE](SCENE-REFERENCE.md)。最重要的是：**按实体 ID upsert，单个实体内部浅合并；数组不是逐元素智能合并。**

```sh
npm run project -- compose examples/quickstart/patch.json revised.project.json source.project.json
```

只改便签，描述中只写 `items: [{ id, kind, body }]`，不写坐标、镜头、资产和其他物件。未指定字段沿用源。物件 `kind` 仍必填；不要因为名字像“便签”就猜 ID。

修改某镜头时，描述中省略 `actions` 可保留旧动作；一旦提供 `actions`，整条数组替换。写 `actions: []` 会清空该镜头动作。要仅追加一条动作，直接在克隆工程的该镜头数组中 push，或先读取旧数组再完整提供。`items: []` 不会清空所有物件，它只表示没有 upsert。

修改位置是完整的 `[x,y,z]` 替换。删除实体不会因在描述中省略而发生；代码中需显式 `removeIds`，确认级联引用符合意图，再验证。重排已有镜头也应直接操作克隆工程的 `shots` 数组；upsert 不会自动将已有镜头按 patch 数组顺序重排。

源文件不覆盖，新结果保留同一 ID 和未点名的数据。对于部分旧版源，`validateProject` 会补字段，比较时区分补默认值与用户手动值。回写前核对原始字节或已保护字段，别把动画采样中间值写回布局。

## 6. 原生检查能做什么

```sh
npm run typecheck:native
npm test
npm run project -- inspect revised.project.json inspect.json
npm run project -- audit revised.project.json production-audit.json
npm run project -- sample revised.project.json 0 frame-start.json
npm run project -- sample revised.project.json 4.5 frame-middle.json
```

`inspect` 列出每个镜头的全局区间；检查同目标重叠、跨镜头延长、动作超出故事。`sample` 可比较 0 秒、首次出现前后、每镜头切换、出场中间和最后一帧。也可直接运行 `evaluate(p, t)`，先求 A 时刻，再 B，再 A，断言严格重复且工程未变。

输出 `Frame` 是相机／变换／透明度／灯光等引擎状态。柔纸最终网格、材质采样、纹理解码、阴影像素和景深结果不在这份数值报告里。结构验证也没有完整碰撞或构图裁切求解。

前端／渲染源码发生修改时，另按仓库测试规则构建并验证真实 GPU。仓库已有 Playwright 回归属于产品测试工具，**不是 Agent 制作作品必须走的浏览器工作流**，也不替代原生接口。

## 7. 渲染与交付边界

| 工作 | 当前路径 |
|---|---|
| 从描述生成／修改完整工程 | Node CLI 或 TypeScript 原生 API |
| 数据、引用、时序、任意时刻状态 | Node CLI / 纯引擎 |
| 三维受光、材质、景深与最终像素 | 工作台 WebGL2 渲染器 |
| PNG / 固定时间戳 MP4/WebM / 现场录制 | 人类在工作台输出；当前没有纯 Node 导出命令 |

不要编造 `project render`、CLI 视频导出、FFmpeg 三维渲染或已完成的电影验收。若任务要求全自动无浏览器视频输出，应把原生渲染／编码后端作为单独开发任务说明；不能用操作浏览器代替这里约定的原生制作。

最小交接包：`source.project.json`、`result.project.json`、使用的场景描述／脚本、`inspect.json`、关键时刻的 `frame-*.json`、修改说明。图片和声音已经内嵌时，仍建议另外保留原始素材供后续精修。

在说明里写明所用版本、改了哪些 ID、保护了哪些手动值、数据／时序警告如何处理、哪些画面／声音尚未检查。用户打开结果 JSON 就能继续编辑、播放和输出，Agent 不需要接管其浏览器。
