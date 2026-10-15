# Studio V5 维护入口

正式入口是 `index.html → src/main.ts`。`prototypes/` 中 V2 保持原样，仅用于回退和兼容性回归。

| 模块 | 责任 |
|---|---|
| `authoring.ts` | 无 DOM 的 Agent 原生入口、数据／时序报告及可序列化帧状态 |
| `scripts/project.ts` / `scripts/lib/project-files.ts` | Node CLI、文件素材内嵌、BOM 兼容、只新建输出 |
| `model.ts` | 版本 3 工程协议、世界/局部坐标、复制引用重映射、导入验证 |
| `catalog.ts` / `cinema.ts` | 不依赖图片/DOM 的模块规格、电影预设、专属入场、场景升级与笔迹预设 |
| `compose.ts` | 外部 Agent 的 xpin-scene/1 描述与稳定 ID 增量编译 |
| `store.ts` | 完整状态的撤销重做、事务、IndexedDB 自动保存、文件工具 |
| `modules.ts` | 模块目录、类别、默认规格、20 秒演示工程 |
| `migrate.ts` | 非破坏性迁移 V2 JSON，包括嵌入 SVG 素材 |
| `motion.ts` / `fade.ts` / `dof.ts` | 贝塞尔求值、画外路径、材质淡化及透明度一致的阴影／景深 |
| `camera-motion.ts` / `camera-editor.ts` | 五次／贝塞尔机位曲线、停留占比、光圈和屈光度拉焦、原生与 UI 共用 |
| `story.ts` | `evaluate(project,t)`：纯函数求相机、出场、笔迹/绳生长、LightCue |
| `materials.ts` | 内容贴图、PBR 材质、合法本地资产加载与缓存 |
| `geometry.ts` | 纸面翘曲、实体固定件、三股绳、细纤维、墨迹几何 |
| `surface.ts` / `rope-clearance.ts` / `production-audit.ts` | 无 DOM 纸面高度、实体绳避让与非破坏制作安全检查 |
| `shadow-filter.ts` | 确定性 32 点深度 PCF；柔化按世界尺度换算，与近景范围／分辨率解耦 |
| `animation-editor.ts` | 物件和镜头面板共用全故事轨道控件 |
| `renderer.ts` | 唯一 WebGL2 场景、阴影、真实深度景深、拾取、无 UI 输出 |
| `studio.ts` / `inspector.ts` / `ui.ts` | 鼠标操作、背包、中文属性面板、故事卡、控件模板 |
| `encode.ts` | 固定时间戳 WebCodecs + Mediabunny 输出 MP4 / WebM |
| `gobo.ts` | 本地生成投影片，由 SpotLight.map 投射至实际三维表面 |
| `record.ts` | 现场画面捕获、播放头音轨同步、MediaRecorder 与无损 WebM 索引封装 |

## 约束

编辑态不被播放中间值污染。图钉保存宿主 ID 和局部坐标；绳保存图钉 ID；标注保存宿主局部路径。组使用 groupId 并对成员同步施加中心变换，暂不支持嵌套父级组。

`evaluate` 无墙钟、随机或渲染资源依赖。所有 Cue 从工程基线与绝对时间重新计算。Renderer 缓存按内容/端点签名更新，删除时释放 GPU 资源。纸张内容替换不会替换 ID。

Agent 制作使用 `src/authoring.ts`，不导入带图片资源的 `modules.ts`、UI、浏览器存储或渲染器。`inspectProject` / `sampleProject` 先克隆验证，输出普通 JSON，明确 `renderValidated:false`。文件入口和完整示例见 [AGENT-NATIVE](AGENT-NATIVE.md)。原生路径尚无 PNG／MP4 渲染后端。

输出调用同一个 `renderAt`，切换输出尺寸及画幅后隐藏 UI 辅助，最后恢复编辑器。视频逐帧 `CanvasSource.add(n/fps,1/fps)`，不使用实时屏幕录制。当前使用内存 BufferTarget；长时间 4K 视频的内存上限需要进一步压力测试。

上段指逐帧交付。V4 另有现场录制：按最大帧率提交 CanvasCaptureMediaStreamTrack，音轨目的节点保持时钟，暂停时为静音；停止后用 Mediabunny 复制编码包封装索引。该路径为可变帧率，不能代替准确时间轴输出。录制画质覆盖不写入源工程。

纸张为单个闭合网格，正面、背面和纸边分组；柔纸从原始顶点按绝对进度做等弧长弯曲。墨迹是贴面薄带，不使用圆管、不投影，随宿主与纸张弯曲。V3 字段与 ID 保持兼容，新设置缺省值在入口/验证时合并。

后处理使用 HDR 半浮点 + MSAA，数量按 GPU 上限；景深读取真深度。精制输出以 2× 宽高渲染、缩小后编码。renderScale 改变预览实际分辨率。

## 本地开发

```sh
npm ci
npm run dev
npm run build
npm test
npm run test:browser
npm run standalone
```

浏览器测试默认 Windows Edge D3D11，可用 `XPIN_BROWSER`、`XPIN_URL` 和 `XPIN_EVIDENCE_DIR` 配置。均为 Playwright 纯代码测试，不依赖 Computer Use。`test-results/` 不进入版本控制。

`npm run standalone` 将构建 JS、CSS 和贴图打入一个可用 file:// 打开的 HTML。源码开发仍通过 Vite，单文件是分发产物。

## V5 观察与安全边界

`followCamera=false` 默认使用 `view.pose`，播放与选择镜头不改变它。仅摄影机勾选／0 切到 `evaluate` 的摄影机；保存自由视角到 `editorView`，不覆盖 `Project.camera`。`mode` 内部兼容完整布置／时间求值，不再是顶栏产品模块。PNG 遵循当前视角；逐帧视频始终使用故事摄影机。

主光使用按视野收紧、光空间 texel 对齐的阴影范围；影棚 4096、精制 8192（受硬件上限约束），真实投／接影保留。32 点确定性 PCF 处理深度图，世界柔化半径约 softness×0.012，最多 32 texel；这不是面积光接触硬化或路径追踪。聚光仍为独立深度图。

实体绳以 97 个中心线样本抬到可见稳定纸面的安全高度，保留原始 pin 端点和源弯曲数据。变形柔纸、固定件互碰、绳间交叉仍需像素检查；不能把路由辅助称为完整物理模拟。安全检查报告明确 `continuousCollisionVerified:false`，不改源。

V5 机位使用全时段缓动取代提前到达后的硬速度变化，yaw/roll 走最短角。光圈按对数、焦点按屈光度空间衔接；逐镜 focusPull 可独立定时。景深仍为深度 Bokeh，不耦合光圈曝光，也不是物理镜头透射求解。材质增加共享线性微表面图、纸面 sheen、印相层清漆／粗糙度分区、金属方向反射与塑料细节；共享图不在单件释放时销毁。
