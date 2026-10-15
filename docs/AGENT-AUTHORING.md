# Agent 制作入口

Agent 的默认制作路径现统一为 **Node CLI + TypeScript 原生 API**，不操作浏览器界面。

- [原生制作指南](AGENT-NATIVE.md)：安装、命令、代码示例、源工程保护、采样与交接。
- [协议速查](SCENE-REFERENCE.md)：全部实体、坐标、时序与合并语义。
- [人类使用指南](USER-GUIDE.md)：接收工程后播放检查、编辑与输出。
- [动画控制](MOTION.md)：V4.1 出入场、透明度和曲线。

```sh
npm run project -- compose examples/quickstart/scene.json test-results/quickstart/project.json
npm run project -- inspect test-results/quickstart/project.json test-results/quickstart/inspect.json
npm run project -- sample test-results/quickstart/project.json 1.1 test-results/quickstart/frame.json
```

源码入口为 `src/authoring.ts`。`examples/native-authoring.ts` 提供从编译到增量修改和源保护的完整可执行例子。`window.__XPIN` 保留给工作台调试和产品回归，不是 Agent 原生制作接口。

结构／时序报告不能代替最终画面。当前没有纯 Node 的 PNG／视频导出 CLI，最终由人类在工作台检查并输出；不把浏览器操作包装成原生能力。
