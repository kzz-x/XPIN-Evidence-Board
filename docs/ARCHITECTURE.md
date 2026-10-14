# Studio V3 维护入口

正式入口是 `index.html → src/main.ts`。`prototypes/` 中 V2 保持原样，仅用于回退和兼容性回归。

| 模块 | 责任 |
|---|---|
| `model.ts` | 版本 3 工程协议、世界/局部坐标、复制引用重映射、导入验证 |
| `store.ts` | 完整状态的撤销重做、事务、IndexedDB 自动保存、文件工具 |
| `modules.ts` | 模块目录、类别、默认规格、20 秒演示工程 |
| `migrate.ts` | 非破坏性迁移 V2 JSON，包括嵌入 SVG 素材 |
| `story.ts` | `evaluate(project,t)`：纯函数求相机、出场、笔迹/绳生长、LightCue |
| `materials.ts` | 内容贴图、PBR 材质、合法本地资产加载与缓存 |
| `geometry.ts` | 纸面翘曲、实体固定件、三股绳、细纤维、墨迹几何 |
| `renderer.ts` | 唯一 WebGL2 场景、阴影、真实深度景深、拾取、无 UI 输出 |
| `studio.ts` / `inspector.ts` / `ui.ts` | 鼠标操作、背包、中文属性面板、故事卡、控件模板 |
| `encode.ts` | 固定时间戳 WebCodecs + Mediabunny 输出 MP4 / WebM |

## 约束

编辑态不被播放中间值污染。图钉保存宿主 ID 和局部坐标；绳保存图钉 ID；标注保存宿主局部路径。组使用 groupId 并对成员同步施加中心变换，暂不支持嵌套父级组。

`evaluate` 无墙钟、随机或渲染资源依赖。所有 Cue 从工程基线与绝对时间重新计算。Renderer 缓存按内容/端点签名更新，删除时释放 GPU 资源。纸张内容替换不会替换 ID。

输出调用同一个 `renderAt`，切换输出尺寸及画幅后隐藏 UI 辅助，最后恢复编辑器。视频逐帧 `CanvasSource.add(n/fps,1/fps)`，不使用实时屏幕录制。当前使用内存 BufferTarget；长时间 4K 视频的内存上限需要进一步压力测试。

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
