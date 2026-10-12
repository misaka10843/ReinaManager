# 前端架构

## 入口与分层

应用入口为 [`main.tsx`](../../src/main.tsx) 和 [`App.tsx`](../../src/App.tsx)，启动依赖见 [架构总览](README.md)。路由与导航共用 [`providers/router.tsx`](../../src/providers/router.tsx) 中的配置。

| 位置 | 职责 |
| --- | --- |
| `pages/`、`components/` | 页面及 UI 交互；页面私有逻辑就近放置，跨页面复用时再上移 |
| `hooks/common/` | 通用 React 能力 |
| `hooks/queries/` | 查询、写入及其缓存更新和失效策略 |
| `hooks/features/` | 组合查询、客户端状态和 service 的业务门面 |
| `services/invoke/` | 通过 `BaseService` 封装 Tauri command，归一化 IPC 错误 |
| `services/`、`metadata/` | 文件、运行时、账号等工作流；外部元数据请求、适配和合并 |
| `store/`、`providers/` | 客户端状态与持久化；全局上下文和基础设施 |

本地数据通常沿 `页面 → 业务门面 → Query hook → invoke service → Tauri command` 读写，写入后由 Query 层更新缓存。跨数据源或跨状态的工作流在业务门面和 service 中编排。组件不直接发起 IPC，也不自行维护 Query 缓存。

## 状态与缓存

后端事实由 Query 管理，界面偏好由 `useStore` 管理，运行中游戏由 `useGamePlayStore` 管理，表单草稿等短期交互留在组件中。不要把数据库实体复制到 Zustand 形成第二事实源。

本地 Query 作为长期缓存，由写入路径主动维护；远程数据使用独立时效策略，具体配置见 [`queryClient.ts`](../../src/providers/queryClient.ts)。新增持久化偏好时检查 [`appStore.ts`](../../src/store/appStore.ts) 的持久化选择及 [`appStoreMigrations.ts`](../../src/store/appStoreMigrations.ts)。

游戏列表、详情与收藏共用聚合缓存和 `GameIndex`，规则见 [`game-library.md`](game-library.md)。详情删除期间的展示快照由 [`GameDeletionProvider`](../../src/providers/GameDeletionProvider.tsx) 按路由隔离，失败或离开后释放；删除成功仍立即更新 Query，快照不能写回缓存。

全库统计复用共享 Query，按展示游戏 ID 关联。读取失败保留错误态，不能转换为空结果；聚合与派生逻辑见 [`pages/Stats/`](../../src/pages/Stats)。

## 桌面能力边界

持久化路径使用 [`PathInput`](../../src/components/PathInput.tsx) 展示原始表达式与解析预览；扫描、拖拽和一次性文件选择使用实际路径。预览不改写配置，保存校验和执行时解析由 Rust 负责，见 [`backend.md`](backend.md)。

程序设置缩放统一经过 [`services/uiZoom.ts`](../../src/services/uiZoom.ts)，由 `UiZoom` 同步原生缩放与持久化比例。自动备份由 [`autoBackupScheduler.ts`](../../src/services/autoBackupScheduler.ts) 在应用启动时调度，不依赖设置页是否挂载。

外部元数据、账号及云同步边界见 [`metadata.md`](metadata.md)。
