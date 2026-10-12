# 引擎约束｜状态、坐标、关系、时间线

实现可模块化的本地 HTML 编辑器。推荐 Vite + TypeScript + Konva（画布编辑）+ GSAP（时间线/摄像机），必要时可以用等价方案。渲染表现与工程数据分离。

## 系统边界
- SceneStore：持久场景数据的单一真相，支持对象/组合/素材/连接/标注/镜头/项目设置、撤销重做与序列化。
- ModuleRegistry：模块名称、分类、默认参数、属性 schema、内容槽位、锚点/热点、渲染和动画定义；加入模块无需修改遍布各处的 switch-case。
- BoardViewport：世界坐标、局部坐标、屏幕映射，缩放平移、命中测试、选择变换、图层与组矩阵。
- Relations：图钉保存 hostId + 宿主局部坐标；绳线保存 fromPinId/toPinId；每帧由当前物件变换求端点世界坐标。
- StoryEngine：按统一绝对毫秒时间 t 评估当前相机 pose、模块可见性与变换、连线绘制比例、标注绘制比例。
- OutputStage：与编辑窗口分离的画面输出，按照目标比例/尺寸渲染，不包含 UI、选择框或编辑器布局。

## 建议数据类型
~~~ts
type Transform = { x:number; y:number; rotation:number; scaleX:number; scaleY:number; z:number };
type SceneObject = { id:string; type:string; transform:Transform; parentId?:string; properties:Record<string,unknown>; assetIds?:string[] };
type Pin = { id:string; hostId?:string; localX:number; localY:number; style:string };
type Connection = { id:string; fromPinId:string; toPinId:string; kind:string; controls?:{x:number;y:number}[]; tension?:number; style:Record<string,unknown> };
type StoryAction = { id:string; targetId?:string; type:string; startMs:number; durationMs:number; params:Record<string,unknown> };
type CameraPose = { x:number; y:number; zoom:number; rotation:number };
type Shot = { id:string; label:string; durationMs:number; targetIds?:string[]; camera?:{from?:CameraPose;to:CameraPose;easing?:string}; actions:StoryAction[] };
~~~
具体字段可优化，但 ID、宿主局部坐标、跨组矩阵和素材独立保存是硬性要求。别把红绳端点写成一次性的 screen XY。

## 变换与绑定
对象有唯一 ID；复制物件/复制组应创建新 ID 并修正内部引用。图钉在宿主坐标系中的局部点，经父级/子级的矩阵转换为世界点；绳索实时连接两端世界点。改动宿主/旋转/缩放/组/撤销后均须继续准确贴合。手绘注释可以使用同样的宿主局部路径，或独立沙盘路径。

## 统一时间源与镜头
编辑态是完整原始场景；播放态从同一份不可变基线 scene + t 计算 renderAt(t)，不向编辑态写入动画中间值。play/pause/seek/回拖/逐帧录制应有一致的帧状态。固定随机种子，清理残留 tween/事件监听；镜头状态由绝对时间确定，跨镜连续，不应从编辑器当前平移视角隐式继承。

目标自动构图以对象/组世界 bounding box、画幅比例及安全边距计算。手动相机微调允许覆写。沿绳追踪使用 connection 曲线进行路径插值并照顾信息可读性。

## 素材与工程持久化
允许 PNG/JPG/WebP/SVG 等本地素材替换。资源有稳定 assetId，工程保存包含所有素材字节（或便携 ZIP 中真实 assets）、内容、变换、关系、时间线、镜头、画幅、版本号。JSON 只存浏览器临时 blob URL 不能算完整工程。导入后全可编辑；本地自动存储可以辅助，但不能替代可迁移的工程包。

导出至少要可实际打开的 PNG；后续增加 WebM/逐帧序列与带声音输出。不能把 Blob 已生成等同于视频可解码。浏览器不能直接支持目标 MP4 时，报告支持范围并提供可用替代。

## 质量边界
1080p 桌面 Chrome/Edge 为主要验收环境；性能优化优先缓存/裁剪，不牺牲物件绑定。需测试世界/屏幕精度、旋转组、图钉多连接、复制/撤销/重开、随机时间 seek、播放暂停、输出画幅及实际文件。外部依赖固定版本并尽量可离线运行。

## Three3D 真实渲染与 Lookdev 增补（2026-10-12）

以 `prototypes/XPIN-Evidence-Board-True3D-V2.html` 为迁移基线，选用一个正式、可实际运行的 3D 渲染入口（如 Three.js）；原 `src/main.ts` 只是占位，不可把迁移写成已完成。

- 场景数据与渲染资源分离：SceneObject 保留稳定 ID、父级/宿主局部锚点与 Z，Camera 使用真实 3D pose；同一场景支持编辑与输出。
- Light 是可选/可复制/可保存的实体：`id | type | position3D | target:{objectId?,localPoint3D?,worldPoint3D?} | intensity | color | cone | penumbra | distance | shadow | enabled`。LightCue 是故事的一种时间事件，参数可插值，随任意 `t` 重算，不依赖点击顺序或上一次渲染的中间态。
- 物件与绳索具有三维几何和材质受光属性，可投/接影；光源目标移动、模块宿主运动、相机运动不应破坏世界与局部关联。背板和纸张必须接收真实阴影。软件后备能力另行显式标识。
- 红绳仍由 `fromPinId/toPinId` 确定锚点，几何/表面纹理/投影可缓存，但几何更新与绳端坐标应保持正确。多个引用同一图钉的连接必须独立工作。
- 工程序列化包括：渲染预设版本、每盏灯参数、聚光目标绑定、LightCue、绳材料与路径参数、环境光、相机焦点和渲染质量。旧版 V2 JSON 使用非破坏性迁移/兼容策略。
- 输出采用播放模式的**同一** 3D 渲染结果，而非单独二维画布快照。GPU 运行/ShadowMap/景深后处理/下载文件分别实测。

视觉与交互验收见 [LOOKDEV.md](LOOKDEV.md) 与 [ACCEPTANCE.md](ACCEPTANCE.md)。