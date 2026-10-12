# 项目文档

按任务打开下方专题；需要跨层上下文时先读架构总览。文档说明职责、数据流和维护约束，具体实现以代码为准。

## 任务导航

| 任务 | 阅读文档 |
| --- | --- |
| 了解整体架构、目录或跨层通信 | [`architecture/README.md`](architecture/README.md) |
| 修改 React 页面、组件、Hook、Query 或 Store | [`architecture/frontend.md`](architecture/frontend.md) |
| 修改 Tauri command、Rust 模块、数据库或原生能力 | [`architecture/backend.md`](architecture/backend.md) |
| 修改游戏列表、`GameIndex` 或 Query 缓存 | [`architecture/game-library.md`](architecture/game-library.md) |
| 修改元数据源、搜索、展示合并、认证或云端同步 | [`architecture/metadata.md`](architecture/metadata.md) |
| 新增或修改国际化字符串 | [i18n Skill](../.agents/skills/i18n/SKILL.md) |
| 操作 WebView2、截图或诊断前端 | [cdp Skill](../.agents/skills/cdp/SKILL.md) |
| 隔离验证前端交互、性能或回归 | [frontend-test Skill](../.agents/skills/frontend-test/SKILL.md) |

## 文档范围

- 通用开发规则放 [`AGENTS.md`](../AGENTS.md)，专题知识放 `docs`，操作流程放 Skill；同一内容只维护一处，其余用链接引用。
- 文档更新门槛统一见 [`AGENTS.md` 的「项目文档」](../AGENTS.md#0-项目文档)，本页导航用于按需阅读。
- 专题保留模块职责、跨层数据流、持久化与兼容性契约及关键约束；默认值、具体数值、字段和内部步骤以代码为准。
- 讨论、历史方案、单次改动记录、验收和待办不进入 `docs`；需要留存时由用户指定。
