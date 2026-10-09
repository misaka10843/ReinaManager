# 主题颜色改造审计

## 范围与结论

本次检索 `src` 下的 TS、TSX 和 CSS 文件，共找到 51 处颜色常量匹配，分布在 11 个文件（涉及 43 行）。本批次已实现持久化主色、预设色盘与自定义颜色，并将主题主色接入 MUI 明暗主题、导入遮罩、统计图表及部分强调色。

仍有若干与图片覆层、状态语义和中性色相关的常量保留在组件中。全量迁移还需整理 CSS/图表 token，并对浅色、深色和主要页面进行视觉检查。

## 颜色分类

| 类别 | 主要位置 | 示例 / 说明 | 后续处理 |
| --- | --- | --- | --- |
| 主题基础色与组件覆盖 | `src/providers/reinaTheme.ts` | 浅色/深色背景、文字、分割线、阴影、悬停和选中态 | 主色已由用户配置生成；中性色继续由主题模式生成 |
| 语义图表色 | `src/pages/Stats/PlaytimeDistribution.tsx` | 普通时段与高峰时段 | 普通时段已跟随主色；高峰色保留为语义色，后续可检查色盲可辨性 |
| 固定品牌蓝 | `src/pages/Detail/stats/GameStatsOverview.tsx`、`src/pages/Detail/stats/GameTimeChart.tsx`、`src/pages/Detail/stats/GameSessionTimeline.tsx`、`src/components/Windows.tsx` | 图标、图表线条、时间轴标记 | 已迁移到 `primary` token |
| 图片与高对比覆层 | `src/pages/Home/FocusGamePanel.tsx`、`src/components/Cards/CardItem.tsx`、`src/pages/Home/RunningGameTimer.tsx` | 图片上白字、渐变和半透明背景 | 作为独立的 overlay token；不能直接跟随主色改变 |
| 通用交互强调 | `src/components/AddModal/AddModal.tsx` | 拖拽导入遮罩和强调图标 | 已改用主题 primary token |
| 全局滚动条样式 | `src/App.css` | 滚动条轨道和滑块 | 通过 CSS 变量承接主题 token |

## Token 覆盖建议

- 用户可选主色作为单一输入，由主题层派生浅色、深色模式的 primary、hover、selected、focus ring 与 alpha 背景；避免逐个颜色控件维护亮度变体。
- 保留模式相关的中性色、图表成功/警告色、图片文字与渐变覆层。它们的语义不同，不应全部由用户主色替换。
- `reinaTheme.ts` 已集中提供 MUI 主题，但 Tailwind/UnoCSS arbitrary color、图表选项和全局 CSS 尚未统一读取主题 token。
- 将 token 导出为 CSS custom properties，并在组件库主题、图表和全局样式中共用；逐步消除组件内的固定 hex/rgb 值。

## 分阶段估时

1. 主色持久化、主题生成、设置页预设色盘与自定义颜色：已完成。
2. 主色迁移至统计图表、导入遮罩和品牌强调位置：已完成部分高置信度颜色。
3. 图片 overlay、状态色、其他硬编码色及跨主题视觉检查：仍需后续迭代。

保留原有审计清单作为遗留颜色索引；主色配置已开始实施，尚未完成全部硬编码颜色迁移与完整视觉检查。
