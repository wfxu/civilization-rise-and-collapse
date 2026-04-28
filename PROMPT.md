# Generation Prompt / 生成提示词

The full Chinese prompt fed into [Claude Design](https://claude.ai/design) to produce this project end-to-end.

整个项目由 Claude Design 一次性生成，使用的中文提示词如下：

---

```
请使用 React + TypeScript + Canvas 从 0 到 1 实现一个"文明崛起与崩溃模拟系统"。

这是一个用于博物馆大屏展示的复杂系统模拟器，不允许使用任何图片、贴图、视频、外部地图或素材文件，所有视觉元素必须用代码生成。

核心目标：
模拟多个文明在一个程序生成的大陆世界中，从聚落出现、城市扩张、贸易网络形成、战争爆发、疾病传播、资源消耗到文明崩溃的动态过程。

必须实现：

1. 世界生成
- 使用程序化方式生成二维大陆地图。
- 地图包含海洋、陆地、山脉、森林、沙漠、河流、草原等地形。
- 每个地块需要有 fertility、resources、movementCost、climateRisk 等属性。

2. 文明系统
- 初始化至少 4 个文明。
- 每个文明拥有城市、人口、食物、财富、技术、军事实力、稳定度和崩溃风险。
- 文明需要随时间扩张、发展或衰退。

3. 城市系统
- 城市会根据食物、资源、贸易、安全程度增长。
- 城市人口过高会增加疾病风险。
- 城市可以因为战争、饥荒或疾病衰退。

4. 贸易系统
- 城市之间可以形成贸易路线。
- 贸易路线提升财富和技术传播。
- 贸易也会提高疾病传播概率。
- 战争可以中断贸易路线。

5. 战争系统
- 文明之间因为资源竞争、边境接触、稳定下降等因素可能爆发战争。
- 战争需要影响人口、财富、稳定度、城市归属和边界变化。
- 地图上需要显示战争前线和冲突动画。

6. 疾病系统
- 疾病可以从高人口城市爆发。
- 疾病沿贸易路线和邻近城市传播。
- 疾病影响人口、稳定度和崩溃风险。
- 地图上需要有疾病扩散的可视化效果。

7. 崩溃系统
- 文明需要有 collapseRisk。
- 崩溃风险由食物不足、战争疲劳、疾病压力、气候压力和稳定度共同决定。
- 当风险过高时，文明可能分裂、衰退或消失。

8. 可视化要求
- 中央是动态世界地图。
- 显示地形、城市、文明边界、贸易路线、战争区域、疾病扩散。
- 使用纯代码生成具有冲击力的大屏视觉效果。
- 风格可以是像素风、科幻地图风或战略指挥中心风。

9. 交互控制
- 支持播放、暂停、调整速度。
- 支持切换图层：地形、文明边界、贸易、战争、疾病、资源、崩溃风险。
- 支持选择某个文明查看详细数据。
- 支持触发灾害事件，例如大旱、瘟疫、入侵、资源枯竭。

10. 数据面板
- 显示当前年份、世界人口、文明数量、战争数量、疾病传播程度、全球稳定指数。
- 显示文明排行榜，包括人口、财富、技术、军力、稳定度和崩溃风险。
- 显示事件日志，例如"红河文明爆发瘟疫""北境帝国贸易路线中断""沙海联盟进入崩溃阶段"。

工程要求：
- 使用 React + TypeScript + Canvas。
- 代码结构清晰，至少拆分为 simulation、rendering、components、data、utils 几个模块。
- 不要把所有逻辑写在一个组件里。
- 项目必须可以运行。
```

---

## Design decisions Claude made

- **Visual direction:** Strategic Command Center (CIC / war-room) — deep indigo background, phosphor amber + cyan + magenta alerts, scanlines, grid coordinates, contour lines.
- **Typography:** JetBrains Mono (data) + Inter (panels).
- **Civ palette:** 6 oklch hues at constant chroma.
- **No bundler:** Babel standalone in the browser, modules attached to `window` and loaded in dependency order. Trade-off: dev convenience vs. bundle size — chosen because the requirement was "must run" with zero build setup.
