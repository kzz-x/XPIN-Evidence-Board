# XPIN Evidence Board｜Codex 开发入口

## 目标与基线
以 [True3D V2](prototypes/XPIN-Evidence-Board-True3D-V2.html) 已可操作的三维调查沙盘为起点，逐阶段升级为高质量、可编辑、可播放的三维叙事工作台。

当前正式入口已为 Studio V3：`index.html → src/main.ts`。V2 保留为兼容/回退原件。新一轮先看 PROGRESS 的真实边界，再看 [ARCHITECTURE](docs/ARCHITECTURE.md)，不要再将 `src/` 当作空壳或重建第二套入口。

先读 [PROGRESS.md](PROGRESS.md)，根据本轮任务读 [ROADMAP.md](docs/ROADMAP.md) 和 [LOOKDEV.md](docs/LOOKDEV.md)；有关绑定/时间/保存时读 [ENGINE.md](docs/ENGINE.md)，验收时读 [ACCEPTANCE.md](docs/ACCEPTANCE.md)。不必每次加载全部资料。

## 做事原则
- **质量优先，复用现有闭环。** 先修真正灯光/阴影/材质与三维场景，再升级手动追光、实体绳索和导演演出；保护已经成立的搭建、连线与摄影机交互。
- **给用户游戏式控制。** 光源和摄影机像可操作物件：鼠标布置、拖动目标，右侧中文控件改参数，故事步骤记录动画；不要求用户写代码、调 Shader。
- **物理表达必须真实。** 聚光灯影响三维物件受光与投影；所有可见实体按材质及照明关系投/接影；红绳有真实横截面、纤维感、立体弯曲和投影。不能用径向渐变遮罩、平面红线或固定假影冒充完成。
- **编辑与动画同源。** 模块、图钉、绳、灯、相机使用稳定 ID 和世界/局部坐标；光照与镜头可独立编排，用同一时间源确定结果。Seek/暂停/回拖/重开后完全一致。
- **优先成熟实现和合法素材。** 选择合理渲染技术，自行权衡性能/画质，不在主 Skill 堆施工步骤。明确 GPU 与软件后备的真实支持级别，不能悄悄退化却标注电影级画质。
- **每次交付可运行、可验证。** 每个里程碑有可操作的结果和目标画面，检查构建、GPU 渲染、阴影与交互、性能/导出；写入 PROGRESS.md 真实完成程度及下一步。暂未测试必须说明。

具体制作机制由 Codex 决定；以 LOOKDEV 的视觉目标、ROADMAP 的交付闭环和 ACCEPTANCE 的真实效果判断。
