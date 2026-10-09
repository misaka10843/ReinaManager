# 主题颜色改造审计

## 范围与结论

本次检索 `src` 下的 TS、TSX 和 CSS 文件，共找到 51 处颜色常量匹配，分布在 11 个文件（涉及 43 行）。在持久化主色、预设色盘与自定义颜色基础上，本批次将主色接入导航选中与悬停、图标按钮悬停、首页焦点游戏标签、统计图表、导入遮罩和品牌强调位置；细节页中性色及全局滚动条改用主题语义 token。

仍有图片覆层、状态语义和调色盘定义等颜色常量保留在组件中。图片覆层保证封面文字可读，游玩状态和图表峰值色表达数据语义，调色盘定义是用户可选的主色来源；不应替换成统一主色。中性色已迁移至模式相关的主题语义 token。还需对浅色、深色和主要页面进行视觉检查。

## 颜色分类

| 类别 | 主要位置 | 示例 / 说明 | 后续处理 |
| --- | --- | --- | --- |
| 主题基础色与组件覆盖 | `src/providers/reinaTheme.ts` | 浅色/深色背景、文字、分割线、阴影、悬停和选中态 | 已将列表导航、图标按钮悬停和选中态绑定用户主色；中性色由主题模式生成 |
| 语义图表色 | `src/pages/Stats/PlaytimeDistribution.tsx` | 普通时段与高峰时段 | 普通时段已跟随主色；高峰色保留为语义色，后续可检查色盲可辨性 |
| 固定品牌蓝 | `src/pages/Detail/stats/GameStatsOverview.tsx`、`src/pages/Detail/stats/GameTimeChart.tsx`、`src/pages/Detail/stats/GameSessionTimeline.tsx`、`src/components/Windows.tsx` | 图标、图表线条、时间轴标记 | 已迁移到 `primary` token |
| 图片与高对比覆层 | `src/pages/Home/FocusGamePanel.tsx`、`src/components/Cards/CardItem.tsx`、`src/pages/Home/RunningGameTimer.tsx` | 图片上白字、渐变和半透明背景 | 保留独立的高对比覆层，焦点游戏状态标签改为主色 |
| 通用交互强调 | `src/components/AddModal/AddModal.tsx` | 拖拽导入遮罩和强调图标 | 已改用主题 primary token |
| 全局滚动条样式 | `src/App.css` | 滚动条轨道和滑块 | 通过 CSS 变量承接主题 token |

## Token 覆盖建议

- 用户可选主色作为单一输入，由主题层派生浅色、深色模式的 primary、hover、selected、focus ring 与 alpha 背景；避免逐个颜色控件维护亮度变体。
- 保留模式相关的中性色、图表成功/警告色、图片文字与渐变覆层。它们的语义不同，不应全部由用户主色替换。
- `reinaTheme.ts` 通过 MUI CSS variables 向 UnoCSS arbitrary color 与全局 CSS 提供统一的主题 token，图表直接读取 MUI primary。
- 新增颜色优先使用 MUI palette 或 `--mui-palette-*` CSS variables；只有状态含义或图片对比需要时才保留固定颜色。

## 分阶段估时

1. 主色持久化、主题生成、设置页预设色盘与自定义颜色：已完成。
2. 主色迁移至导航选中/悬停、图标按钮悬停、首页焦点标签、统计图表、导入遮罩和品牌强调位置：已完成。
3. 中性色迁移至主题 token：已完成高置信度位置；状态色和图片 overlay 保留其语义，仍需跨主题视觉检查。

原有审计清单记录了颜色来源和分类。剩余颜色主要是用户调色盘、数据状态色及高对比图片 overlay；完整视觉检查尚未执行。
