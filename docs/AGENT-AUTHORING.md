# Agent 场景搭建 · xpin-scene/1

外部 Agent 可将用户描述转成 JSON，编译成可编辑 XPIN 工程，不用模拟鼠标逐个搭建。这个接口没有内置大模型，生成工程后仍需播放及画面验收。

## 流程

1. 读 AGENTS、PROGRESS 和源工程，保护没有要求修改的布局、素材、机位及轨道。
2. 参考 `examples/Windowlight.scene.json` 写描述。坐标为 XY 板面，+Z 朝向观众；`rotationDeg` 用度数；ID 使用稳定、可读的名称。
3. 运行 `npm run compose -- description.scene.json result.project.json [source.project.json]`。可选源工程参数启用增量修改：相同 ID 只覆盖明确提供的字段，其余内容保留。验证通过后才写结果。
4. 在工作台导入、播放/回拖、检查关键帧及连续运镜。没有检查完整视频、真实口播或目标设备时明确说明。

## 字段

| 字段 | 含义 |
|---|---|
| `format` | 固定 `xpin-scene/1` |
| `name/settings/camera` | 工程名、板材/边框/画幅/字体/成像、手动机位；缺省沿用源工程 |
| `look` | 0–8：暖冷、Noir、柔光、逆光、调查、窗格、百叶、树影、月窗 |
| `items` | 必填 id/kind；可设 title/body、position、width/height、scale、rotationDeg、font/fontScale、roughness/paperCurl/fiberStrength |
| `pins` | id、hostId、local、color；local 是宿主局部坐标 |
| `ropes` | id/from/to，端点为图钉 ID；可设 color/radius/slack/bend/style/control |
| `marks` | id/hostId，shape 为 circle/underline/arrow/wave，或自定义 points；brush 为 ink/pencil/marker/brush；radius/color 可调 |
| `lights` | id、position/target、颜色、强度、锥角、柔化、投影；gobo 为 window/blinds/foliage/lattice，旋转/尺度可调 |
| `shots` | id/title/duration/targetIds/motion/camera/actions/cues，详见 model.ts |
| `assets/assetFiles` | assets 内嵌 data URI；CLI 的 assetFiles 路径相对描述文件，编译时内嵌图片；浏览器不读取磁盘路径 |
| `fitBoard` | 根据现有布局计算板材大小，不移动用户物件 |

轨道 start/duration 为镜头内的秒数。类型：peel 柔纸/胶带、pin 图钉、clamp 夹子、thread 回形针、slide/settle、stamp、type、grow 绳索、draw 墨迹。轨道 ID 稳定且唯一；避免重复添加同一入场。

代码接口 `window.__XPIN.compile(brief, source?)` 返回工程；project/evaluate/seek/png/audit 用于验证。固定源 + 描述 + 目标关键帧构成可复现的交接包。不要覆盖原源文件，也不要将示例默认值当成用户需求。

下一步需增加嵌套层级、碰撞/构图约束、轨道编辑、材质资产库与自然语言助手的审计界面。
