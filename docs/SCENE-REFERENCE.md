# 场景与工程协议速查

面向原生 Agent 与开发者；当前真实类型以 [model.ts](../src/model.ts)、[compose.ts](../src/compose.ts)、[cinema.ts](../src/cinema.ts) 为准。快速制作见 [AGENT-NATIVE](AGENT-NATIVE.md)。

## 1. 两种 JSON

| 类型 | 标识 | 用途 |
|---|---|---|
| SceneBrief | `format: "xpin-scene/1"` | 较短的描述／增量指令，需经编译器填默认值 |
| Project | `version: 3` | 完整可编辑工程，含全部集合、设置、机位及内嵌素材 |

不要把完整工程只改一个 `format` 就当描述；也不要把描述只加 `version` 就当工程。CLI `compose` 读取描述；`validate/inspect/sample/audit` 读取完整工程。

V5 完整工程可选 `editorView: Pose` 保存自由观察视角；它不是初始作品机位，不参与 `evaluate` 或故事视频输出。`camera` 仍是故事过渡起点。

## 2. 坐标、角度与时间

- `[x,y,z]` 为三维坐标；XY 在板面，+Z 朝观众，板面约 Z=0，纸张常从 0.03–0.08 起步。尺寸是场景单位，不是像素／厘米。
- 物件位置是世界坐标，旋转绕 Z。描述支持 `rotationDeg` 度数；Project 的 `rotation` 以及 Pose 的 `yaw/pitch/roll` 均为弧度。
- `Pin.local` 和有宿主的 `Mark.points` 是局部坐标，会经宿主旋转、缩放及平移换到世界。自由钉／无宿主标注使用世界坐标。
- 摄影机 `target` 是世界目标，`distance` 是距离，`focal` 是毫米焦距；`Light.angle` 和 Cue 的 `fromAngle/toAngle` 用度数，不能混成弧度。
- `Shot.duration`、Action/Cue 的 `start/duration` 用秒。轨道 `start` 相对所属镜头；`evaluate/sample` 输入相对整个故事。
- 故事时长是镜头时长之和，轨道不会自动延长故事。跨镜延长、重叠和超时由 inspect 警告，作者决定如何修正。

## 3. SceneBrief 顶层

| 字段 | 规则 |
|---|---|
| `format` | 必填 `xpin-scene/1` |
| `name` | 工程名 |
| `settings` | 部分场景设置，与原设置浅合并 |
| `look` | 0–8 的电影布光，先应用 look，再应用显式 settings |
| `camera` | 完整初始 Pose；未提供且为新工程时，沿用首镜头机位 |
| `items/pins/ropes/marks/lights/shots` | 按 ID 添加或更新，不因省略而删除 |
| `assets` | `{assetId: "data:image/..."}`；与已有素材表合并 |
| `assetFiles` | 仅 Node 文件加载层支持；相对描述目录的图片路径表，不是 compileScene 的文件系统能力 |
| `fitBoard` | 根据布局调实体板宽高，不改变物件和已写入机位 |

ID 只用 1–100 个英文字母、数字、`-`、`_`。实体、镜头、Action、Cue 的 ID 必须全局唯一；描述正文可用中文。名称不等于 ID。

## 4. 物件 Item

描述中必填 `id/kind`，其余按母版／源值补齐。当前 kind：

`photo polaroid film file news folder profile map note label date pin clip tape staple stamp`

| 字段 | 含义 |
|---|---|
| `title/body` | 标题、正文；换行使用 JSON `\n` |
| `position/rotationDeg/rotation/scale` | 世界姿态；width/height 是本体尺寸，scale 乘在整体上 |
| `width/height/color` | 正数尺寸、六位十六进制颜色 |
| `assetId` | 指向 assets 表；不能填磁盘路径或 blob URL |
| `locked/hidden/groupId` | 锁定、隐藏、编辑组；groupId 不是动画父节点 |
| `font/fontScale` | 单件字体和字号覆盖；缺省跟随场景 |
| `roughness/paperCurl/fiberStrength` | 粗糙度／柔纸翘曲／纸纤维强度；固定件不一定具有纸面参数 |
| `entrance` | UI 加入专属入场时的候选动作；单独设它不会生成轨道 |

物件没有 `hostId`、任意 X/Y 欧拉角、子节点动画或刚体碰撞字段。夹子、胶带是独立 Item，不能靠添加未知 `hostId` 得到约束。Item kind `pin` 也不是 Rope 引用的 Pin 实体。

## 5. 钉、绳、标注

**Pin：** `id, hostId?, local:[x,y,z], color`；可选 roughness。宿主必须是有效 Item；无宿主时 local 是世界坐标。描述中的 Pin 需要完整必填属性，不会自动按旧 Pin 补齐。绳从图钉头部附近连接，渲染端在钉位置上再加 Z=0.145。

**Rope：** 描述必填 `id/from/to`；端点引用 pins 的 ID。可设 `color/radius/slack/bend/style/control`。默认半径 0.022、松弛 0.12、弯曲 0、棉绳 cotton；另有 nylon/hemp。`control` 是可选的世界控制点，不是屏幕点。

**Mark：** `id/hostId` 配合 `shape: circle|underline|arrow|wave` 生成预设，或提供完整 `points`。`brush: ink|pencil|marker|brush`，可调 `radius/color`。预设 shape 需要有效纸张宿主；自定义 points 中每一点都是三元组。最终墨迹贴面、不投实体管状阴影。

## 6. 灯光与场景设置

描述中 Light 必填 `id`，缺省基于 `makeLight()`，可设：`name,position,target,hostId,local,color,intensity,angle,penumbra,distance,decay,shadow,enabled`。有宿主则 target 由宿主局部落点求值。

投影片：`gobo: none|window|blinds|foliage|lattice`，`goboRotation` 为度，`goboScale` 为缩放。窗光往往需要比普通聚光更大的 intensity；以实例、实际受光和曝光为准。`presetManaged` 是预设管理标志，自定义灯通常不要设它。

布光索引：0 暖冷、1 Noir、2 柔光档案、3 侧逆光、4 调查追光、5 午后窗格、6 百叶、7 树影、8 冷月窗。应用 look 会改变全局布光并维护一盏预设管理灯；未管理的手动灯保留。需要引用确定的灯 ID 时，直接写 lights 更清楚。

| 场景设置 | 当前支持 |
|---|---|
| `board/aspect` | cork/felt/wood/grid；16:9、9:16、3:4、1:1 |
| `boardWidth/boardHeight/frame/frameWidth/frameColor` | 实体板与四边框 |
| `exposure/ambient/keyIntensity/keyAzimuth/keyElevation/keyColor/softness` | 主光、环境光、曝光、阴影柔化 |
| `quality/renderScale/grain` | draft/studio/ultra；预览倍率 0.5–2；颗粒 |
| `dof/focusOffset` | 全局景深强度、焦点偏移；草稿不启用景深 |
| `font/fontScale` | 全局本机字体名称、字号比例 |
| `boardTextureScale/grid/orbitReverse` | 板材纹理密度、网格、鼠标环视反向 |

字体文件不内嵌，不保证接收机器存在相同字库；当前没有 HDR 环境路径、物理光圈每镜关键帧、布料或碰撞求解字段。

## 7. Shot、Action、Cue

描述中 Shot 必填 `id`，其余基于 `makeShot()` 或源镜头。`targetIds` 为实体 ID；自动构图主要使用 Item 包围框，只有钉／绳时不要假设自动近景一定正确，可提供手动 Pose。

`motion: focus|push|pan|rope|overview`，`ease: smooth|linear`，沿绳运动需要 `ropeId`。`camera` 是完整 Pose：`target,distance,yaw,pitch,roll,focal`。提供 camera 会将镜头标记为手动；后续移动目标不会自动重构该手动机位。

**Action 必填：** `id,targetId,start,duration,type,strength`。描述编译会为省略的轨道 ID 生成 UUID，但维护工程应显式写稳定 ID。

类型：`settle/slide/type/grow/draw/stamp/peel/clamp/pin/thread`。针对当前对象选择可用动作，可用 `animationOptions(p,id)` 查询；不是所有动作都适合所有实体。

V4.1 可选：`phase: in|out`、`ease: cinematic|smooth|gentle|accelerate|linear|custom`、`bezier:[x1,y1,x2,y2]`、`fade:0–1`、`origin:screen|local|stationary`、`direction:left|right|top|bottom`、`travel:1–4`。详见 [MOTION](MOTION.md)。Shot.ease 与 Action.ease 是两个不同的控制，不要混用枚举。

**Cue 必填：** `id,lightId,start,duration,from,to,fromIntensity,toIntensity,fromAngle,toAngle,ease`。`from/to` 是世界落点；可选 `targetId` 为有效 Item，结束时跟随其局部 `[0,0,0.03]`。`ease: smooth|linear|hold`。Cue 只控制灯光，不移动相机。

## 8. 更新语义与常见陷阱

| 操作 | 真实含义 |
|---|---|
| patch 中省略某集合或某实体 | 保留源，不删除 |
| 同 ID 的 Item／Rope／Light／Shot | 浅合并，未提供字段沿用源 |
| 同 ID 的 Pin | 用完整提供值替换，需带必填 local/color |
| 同 ID 的 Mark | 提供 shape 会重新生成路径；普通字段修改沿用已有路径 |
| 提供 position、camera 或其他嵌套对象 | 整个字段替换，不能假设深合并；camera 需完整 Pose |
| 提供某镜头的 actions/cues 数组 | 整个数组替换；`[]` 清空该镜头数组 |
| 顶层 items: [] | 没有物件 upsert，不是清空布局 |
| 修改现有 shots 的描述顺序 | 不会重排既有镜头，需要显式调整工程 shots 数组 |
| 只设置 Item.entrance | 只改候选类型，不会添加动画 |
| 改 settings.aspect | 纯编译不执行 UI 的自动重构图动作；需要显式 poseFor 重算希望改变的镜头，保留手动镜头 |
| 把 sample 的 position 写回源 | 会污染原布局；采样结果用于检查，不是源数据 |

集合删除、重排和追加复杂轨道时，直接克隆完整工程，使用原生模型函数或明确数组操作，再 `validateProject` 和写入新文件。保持源文件、稳定 ID、素材和未授权修改的手动工作。

## V5 摄影机曲线与镜内光学

`Pose` 可选 `fStop`（0.8–22，省略为 4）、`focusDistance`（≥0.1 场景单位，省略自动对焦观看目标并加场景 focusOffset）。镜头间按曲线衔接光圈与焦点，焦点在屈光度空间插值。它是实时深度 Bokeh 模型，光圈不改变曝光，不是完整薄透镜／镜头像差模拟。

`Shot.ease` 支持 `smooth/smoother/cinematic/glide/linear/custom`。smooth 和 smoother 均使用端点速度／加速度为零的五次曲线；新镜头默认 smoother。`bezier:[x1,y1,x2,y2]` 四项均 0–1，custom 时生效。`moveFraction` 为 0.1–1，默认 0.85；其后保留到达姿态，给观众阅读。

镜内拉焦可选 `focusPull:{from,to,start,duration,ease}`，from/to 是正的对焦距离，start 为镜内秒数，duration>0，ease 使用 cinematic/smooth/gentle/accelerate/linear。它覆盖该镜头普通对焦距离；下一镜从其结束距离衔接。需要动态目标位置时由 Agent 先在合适时刻取样，再明确填距离；当前没有随目标自动关键帧追焦或焦点路径曲线。

```json
{"id":"detail", "duration":6, "targetIds":["file-b"], "motion":"focus",
 "ease":"smoother", "moveFraction":0.7,
 "camera":{"target":[2,0.4,0.1],"distance":14,"yaw":-0.22,"pitch":-0.12,
   "roll":0,"focal":52,"fStop":2.8},
 "focusPull":{"from":13.4,"to":14,"start":2.8,"duration":1.6,"ease":"smooth"}}
```

## V5.1 磨损与实体文件夹

| Item 可选字段 | 范围／缺省 | 用途 |
|---|---|---|
| `wear` | 0–1，0.35 | 总旧化强度；0 去除撕边／随机旧化／污渍 |
| `edgeTear` | 0–1，0.65 | 真实几何撕边强度，与 wear 相乘 |
| `stainAmount` | 0–1，0.18 | 轻微污渍颜料，不是投影 |
| `wearSeed` | 0–2147483647 整数，省略按 ID 派生 | 保持磨损细节稳定；不能每帧改变 |
| `folderDepth` | 0.03–0.4，0.085 | 文件夹内页夹层厚度，场景单位 |
| `folderOpen` | 0–35，4 | 封面开合角度，**度** |

`paperCurl`（原有 0–3）继续缩放纸面基础和随机卷曲。纸张闭合网格真实厚度 0.006；照片类 0.008；文件夹封面／封底约 0.016。尺寸不是毫米，不要当真实物理单位填入。

原生导出增加 `paperSurface/paperPoint/paperThickness/paperSeed/wearParameters/folderSettings`。`paperSurface` 是稳定纸面／文件夹封面的上包络；`pinWorld` 将纸宿主上的钉位置至少抬到当地表面上方 0.016，不写回 pin.local。自由钉不改变。

```json
{"format":"xpin-scene/1","items":[
 {"id":"photo-a","kind":"photo","wear":0.35,"edgeTear":0.65,"stainAmount":0.18,"wearSeed":47},
 {"id":"folder-b","kind":"folder","folderDepth":0.1,"folderOpen":8,"wear":0.55}
]}
```

只修改这些字段的稳定 ID patch 会保留已有变换、机位、时间线和素材。需要完全平整时明确设置 wear=0、edgeTear=0、stainAmount=0、paperCurl=0。
