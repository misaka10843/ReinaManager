# 游戏库数据与缓存

本文档只描述游戏数据从 SQLite 到 UI 的读写路径，以及 Query 与 `GameIndex` 的一致性约束。

## 核心数据形态

| 形态 | 含义 | 主要用途 |
| --- | --- | --- |
| `FullGameData` | 后端返回的完整聚合，含 `sources` 和 `custom_data` | Query 主缓存、编辑、数据源更新 |
| `GameData` | `getDisplayGameData` 将多源和自定义覆盖展平后的数据 | 卡片、详情、搜索和分类 UI |
| `GameIndex` | 从 `FullGameData[]` 派生的 List、Map 和分类索引 | 按 ID 查找、源可用性、开发商虚拟分类 |

`GameIndex` 同时保存 `rawList/rawById`、`displayList/displayById`、ID、数据源可用性和开发商索引。业务代码应按需选择 raw 或 display，不要在组件中重复转换。

## Query key

`src/hooks/queries/useGames.ts` 维护：

- `gameKeys.all`：`FullGameData[]` 主缓存。
- `gameKeys.index()`：`GameIndex` 派生缓存。
- `gameKeys.idList(params)`：后端排序/筛选后的轻量 ID 列表。
- `gameKeys.bgmIds()` / `vndbIds()`：新增和导入时的重复检测辅助数据。

## 读取路径

```text
useAllGames → find_all_games → FullGameData[] → gameKeys.all
                                             ↓
                                         GameIndex
                                             ↓
useGameIdList → find_game_ids → number[] → displayById 组装
                                             ↓
                         状态 / 标签 / NSFW / 搜索过滤
                                             ↓
                                      虚拟化卡片列表
```

前端首次加载完整游戏聚合。切换基础类型筛选或排序时，`find_game_ids` 只传输 ID，前端再从 `displayById` 取展示数据，避免重复传输整个游戏库。

列表标准入口是 `useGameListFacade`。详情页默认读 `displayById`；只有编辑外部源或底层字段时才读 `rawById`。

自定义收藏分类通过 `preferencesScope: "collection"` 复用列表门面，使用独立的搜索与筛选排序偏好，且保持收藏夹不过滤 NSFW 的现有规则。手动排序保留分类成员 ID 的原始顺序，其他排序使用后端排序 ID 与分类成员的交集。搜索和筛选只派生显示列表，不修改分类成员或已保存的手动顺序。

自定义分类继续使用全量卡片网格；只有手动排序、无搜索和筛选、搜索派生已完成且未进入批量模式时才能拖拽，保存期间暂停下一次拖拽。虚拟网格拖拽尚未接入。

拖拽通过 `useReorderCategoryGames` 调用专用 `reorder_category_games`，后端在同一事务内检查分类存在、成员集合一致且 ID 不重复，只更新关联的 `sort_order`，不增删成员。前端不重复校验完整成员列表，也不保存独立顺序副本；Query 乐观更新当前分类的 ID 缓存，成功后无需失效查询，失败时回滚尚未被其他操作更新的缓存并仅刷新当前分类。管理游戏继续使用 `update_category_games` 替换成员，成功后失效收藏相关查询。

## 写入路径

```text
UI action
→ useAddGame / useUpdateGame / useDeleteGame / 批量 mutation
→ gameService
→ Rust transaction
→ 后端返回完整 FullGameData
→ gameCachePatch 增量维护 gameKeys.all + GameIndex
→ 按影响范围 invalidate ID、合集、统计或源 ID 缓存
```

`src/hooks/queries/gameCachePatch.ts` 是写缓存的统一入口：

- `appendGamesToCaches`：新增。
- `patchGameCaches` / `patchManyGameCaches`：更新。
- `removeGamesFromCaches`：删除。

这些函数同时维护 `gameKeys.all`、`gameKeys.index()` 和 WeakMap 派生缓存。它们会使用 React Query 最终保存的数组引用，避免 structural sharing 导致索引引用失配。

## 失效规则

- 新增、删除，或修改会影响归属/排序的字段：失效 `gameKeys.idLists()`。
- 修改 BGM/VNDB 来源绑定：失效对应源 ID 缓存。
- 删除游戏：同时失效合集和统计。
- 新增游戏：同时失效合集和重复检测缓存。
- 云端收藏导入复用批量新增路径；`localpath` 留空，并按各来源外部 ID 在准备和写入阶段双重去重。
- 不影响列表归属或排序的局部更新：只 patch 聚合和索引。

## 禁止的做法

- 不在业务代码中直接替换 `gameKeys.all`，这会绕过 `GameIndex`。
- 不在页面或组件中反复调用 `getDisplayGameData`。
- 不因单个游戏更新而全量 refetch `gameKeys.all`。
- 不用 `GameData` 执行需要原始 `sources` 的写入。

## 排查全量重建

单个更新如果触发接近游戏库总数的转换，依次检查：

1. 是否有代码绕过 `gameCachePatch.ts` 写 `gameKeys.all`。
2. 是否不必要地 invalidate/refetch 了 `gameKeys.all`。
3. `gameKeys.index()` 的 `rawList` 是否对应 Query 实际保存的数组引用。
4. 是否在渲染路径重复派生展示数据。
