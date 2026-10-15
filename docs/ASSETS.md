# 资产与技术来源

本项目不上传本地图片、音频或工程。发行单文件中已内嵌以下演示资产。

V4 的窗格/百叶/树影为本地代码生成的 SpotLight 投影片，参考 [Three.js SpotLight.map](https://threejs.org/docs/pages/SpotLight.html)。多采样后处理使用 [WebGLRenderTarget](https://threejs.org/docs/pages/WebGLRenderTarget.html)；本机字体 API 参考 [Chrome Local Font Access](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts)。录制停止后索引封装使用 [Mediabunny copy conversion](https://mediabunny.dev/guide/converting-media-files)。使用已锁定的库版本，不因在线文档变化自动升级。

## 软木 PBR

- [ambientCG Cork003](https://ambientcg.com/view?id=Cork003)，Color、NormalGL、Roughness，1K JPG。
- [CC0 1.0 许可](https://docs.ambientcg.com/license/)，允许使用和再分发。
- 发行资产重编码为 JPEG quality 90 / 4:4:4，未把明暗或动态阴影烘焙进贴图。

## 历史影像

- `bridge.jpg`：Library of Congress, `gtfy.07870`，[馆藏条目](https://www.loc.gov/pictures/item/2020737411/)。
- `city.jpg`：Library of Congress, `gtfy.07869`，[馆藏条目](https://www.loc.gov/pictures/item/2020737410/)。
- `harbor.jpg`：历史命名保留；实际内容为街头记者照片，Bain Collection `ggbain.00022`，[持久标识](https://hdl.loc.gov/loc.pnp/ggbain.00022)。
- 馆藏权利提示为 No known restrictions on publication；[Bain Collection 权利说明](https://www.loc.gov/rr/print/res/274_bain.html)。影像用于虚构示例，不表示其中人物涉及任何案件。

## 渲染与输出参考

- [Three.js SpotLight](https://threejs.org/docs/pages/SpotLight.html)、[阴影](https://threejs.org/manual/pages/shadows.html)、[TubeGeometry](https://threejs.org/docs/pages/TubeGeometry.html)、[BokehPass](https://threejs.org/docs/pages/BokehPass.html)。
- [Mediabunny 写入媒体](https://mediabunny.dev/guide/writing-media-files)：CanvasSource 固定时间戳逐帧写入，AudioBufferSource 按故事时长裁切或补静音。
- 依赖许可保留在源代码包的 `node_modules` 安装结果；Three.js、Mediabunny 均使用 MIT 许可。依赖版本由 `package-lock.json` 固定。

纸张、地图、文档排版、毛毡/木材预览、绳索和图钉几何由项目代码生成，随机种子固定。用户提供的参考图作为艺术方向，未打包进产品。

## 原生入门示例

`examples/quickstart/evidence.svg` 为本仓库新增的自制矢量示意地图，不含外部照片或网络资源，仅用于验证原生制作闭环，允许随本工程示例使用和修改；不代表最终写实素材。
