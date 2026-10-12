# 差点调查沙盘｜XPIN Evidence Board Studio

用游戏式操作搭一面真正有厚度的三维调查板，再像导演一样控制证据出场、红绳连接、聚光追随与电影运镜。

## 当前可玩的版本：True3D V2

**[打开独立 HTML 原型](prototypes/XPIN-Evidence-Board-True3D-V2.html)**：下载后使用 Chrome / Edge 打开。当前交互版本包含二维搭建、三维透视、模块/图钉/连接、初步镜头与播放。它是后续迭代的**现有基线**。

注意：V2 的软件渲染模式具有三维透视和几何层级，但灯光/投影与景深仍有模拟成分；内置 WebGL2 路径还需目标设备实测。**不能把 V2 当作最终 PBR 画质或完整灯光系统。**

## Codex 接续

先读 [AGENTS.md](AGENTS.md)、[PROGRESS.md](PROGRESS.md)，按 [开发路线](docs/ROADMAP.md) 从第一个未完成里程碑推进。美术、光影、手动追光、实体红绳详见 [LOOKDEV.md](docs/LOOKDEV.md)，产品与基础数据协议见 [PRODUCT.md](docs/PRODUCT.md) / [ENGINE.md](docs/ENGINE.md)，具体交互验证见 [ACCEPTANCE.md](docs/ACCEPTANCE.md)。

仓库 `src/` 中仍是早期 Vite + TypeScript **空界面脚手架**（`npm run dev` 不会启动完整 V2）；正式模块化时应从 V2 真正工作能力接入，统一为一个产品入口，而不是独立重做两套。此阶段不以已有脚手架取代 V2。

目标：编辑时轻松像游戏，播放时有真实灯光、纸张材质、绳索实体和空间运镜。