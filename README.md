# XPIN Evidence Board Studio

游戏式搭建三维调查沙盘，像导演一样编排证据、实体红绳、追光与电影镜头。

## 当前入口：Studio V3

正式产品位于 `src/`：Three.js / WebGL2、PBR 材质、动态投影、深度景深；统一场景与绝对时间线用于编辑、播放和输出。

[下载 V3 离线工作台](releases/XPIN-Evidence-Board-Studio-V3.html)（保存 HTML 后打开，无需安装依赖）。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。需要支持 WebGL2 的桌面 Chrome / Edge；没有模拟光影后备。

## 使用

从左侧拖入相片或文件，点击编辑内容和本地图片。V 移动、R 旋转、E 缩放；Shift 多选或框选，空格拖动平移、Alt 拖动环视、滚轮缩放。P 钉图钉，C 依次点击图钉拉绳，M 自由手绘。

布光面板控制主光和追光；灯位与落点可以拖动，也可以绑定某份资料。选择证据加入镜头，在故事卡中调整摄影机、出场和追光 Cue。播放头可任意回拖，工程布局保持可编辑。

工程 JSON 内嵌图片和音频；自动保存使用 IndexedDB。输出 PNG、MP4 或 WebM 都来自同一个三维场景，隐藏编辑辅助。视频使用固定时间戳逐帧编码，声音按作品时长裁切或补静音。

## 构建与验证

```sh
npm run build
npm run standalone
npm test
npm run test:browser
npm run test:media
```

`dist/XPIN-Evidence-Board-Studio.html` 是可直接用 file:// 打开的离线单文件。浏览器回归脚本默认 Windows Edge，可通过 `XPIN_BROWSER` 指定可执行文件。

## 接续开发

阅读 [AGENTS](AGENTS.md)、[PROGRESS](PROGRESS.md)、[ARCHITECTURE](docs/ARCHITECTURE.md)。完整产品目标见 [PRODUCT](docs/PRODUCT.md)，美术目标见 [LOOKDEV](docs/LOOKDEV.md)，验收见 [ACCEPTANCE](docs/ACCEPTANCE.md)。合法资产来源见 [ASSETS](docs/ASSETS.md)。

[V2 原型](prototypes/XPIN-Evidence-Board-True3D-V2.html) 保持原样供回退。V3 可导入 V2 JSON，并重建真实三维材质与关系。

V3 已实现制作闭环；最终实拍质感、长尾模块、专业轨道及长时间 4K 输出的完成程度与实测边界以 PROGRESS 为准。
