use crate::entity::prelude::*;
use crate::entity::{collections, game_collection_link};
use sea_orm::*;
use serde::{Deserialize, Serialize};

/// 合集数据仓库
pub struct CollectionsRepository;

/// 分组与分类的树形结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupWithCategories {
    pub id: i32,
    pub name: String,
    pub icon: Option<String>,
    pub sort_order: i32,
    pub categories: Vec<CategoryWithCount>,
}

/// 带游戏数量的分类
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryWithCount {
    pub id: i32,
    pub name: String,
    pub icon: Option<String>,
    pub sort_order: i32,
    pub game_count: u64,
}

impl CollectionsRepository {
    // ==================== 合集 CRUD 操作 ====================

    /// 创建合集
    pub async fn create(
        db: &DatabaseConnection,
        name: String,
        parent_id: Option<i32>,
        sort_order: i32,
        icon: Option<String>,
    ) -> Result<collections::Model, DbErr> {
        let now = chrono::Utc::now().timestamp() as i32;

        let collection = collections::ActiveModel {
            id: NotSet,
            name: Set(name),
            parent_id: Set(parent_id),
            sort_order: Set(sort_order),
            icon: Set(icon),
            created_at: Set(Some(now)),
            updated_at: Set(Some(now)),
        };

        collection.insert(db).await
    }

    /// 根据 ID 查询合集
    pub async fn find_by_id(
        db: &DatabaseConnection,
        id: i32,
    ) -> Result<Option<collections::Model>, DbErr> {
        Collections::find_by_id(id).one(db).await
    }

    /// 获取所有合集
    pub async fn find_all(db: &DatabaseConnection) -> Result<Vec<collections::Model>, DbErr> {
        Collections::find()
            .order_by_asc(collections::Column::SortOrder)
            .all(db)
            .await
    }

    /// 获取根合集（parent_id 为 NULL）
    pub async fn find_root_collections(
        db: &DatabaseConnection,
    ) -> Result<Vec<collections::Model>, DbErr> {
        Collections::find()
            .filter(collections::Column::ParentId.is_null())
            .order_by_asc(collections::Column::SortOrder)
            .all(db)
            .await
    }

    /// 获取子合集
    pub async fn find_children(
        db: &DatabaseConnection,
        parent_id: i32,
    ) -> Result<Vec<collections::Model>, DbErr> {
        Collections::find()
            .filter(collections::Column::ParentId.eq(parent_id))
            .order_by_asc(collections::Column::SortOrder)
            .all(db)
            .await
    }

    /// 更新合集
    pub async fn update(
        db: &DatabaseConnection,
        id: i32,
        name: Option<String>,
        parent_id: Option<Option<i32>>,
        sort_order: Option<i32>,
        icon: Option<Option<String>>,
    ) -> Result<collections::Model, DbErr> {
        let existing = Collections::find_by_id(id)
            .one(db)
            .await?
            .ok_or(DbErr::RecordNotFound("Collection not found".to_string()))?;

        let mut active: collections::ActiveModel = existing.into();

        if let Some(n) = name {
            active.name = Set(n);
        }
        if let Some(p) = parent_id {
            active.parent_id = Set(p);
        }
        if let Some(s) = sort_order {
            active.sort_order = Set(s);
        }
        if let Some(i) = icon {
            active.icon = Set(i);
        }

        active.updated_at = Set(Some(chrono::Utc::now().timestamp() as i32));

        active.update(db).await
    }

    /// 删除合集（会级联删除子合集和游戏关联）
    pub async fn delete(db: &DatabaseConnection, id: i32) -> Result<DeleteResult, DbErr> {
        Collections::delete_by_id(id).exec(db).await
    }

    /// 检查合集是否存在
    pub async fn exists(db: &DatabaseConnection, id: i32) -> Result<bool, DbErr> {
        Ok(Collections::find_by_id(id).count(db).await? > 0)
    }

    // ==================== 游戏-合集关联操作 ====================

    /// 将游戏添加到合集
    pub async fn add_game_to_collection(
        db: &DatabaseConnection,
        game_id: i32,
        collection_id: i32,
        sort_order: i32,
    ) -> Result<game_collection_link::Model, DbErr> {
        let now = chrono::Utc::now().timestamp() as i32;

        let link = game_collection_link::ActiveModel {
            id: NotSet,
            game_id: Set(game_id),
            collection_id: Set(collection_id),
            sort_order: Set(sort_order),
            created_at: Set(Some(now)),
        };

        link.insert(db).await
    }

    /// 从合集中移除游戏
    pub async fn remove_game_from_collection(
        db: &DatabaseConnection,
        game_id: i32,
        collection_id: i32,
    ) -> Result<DeleteResult, DbErr> {
        GameCollectionLink::delete_many()
            .filter(
                game_collection_link::Column::GameId
                    .eq(game_id)
                    .and(game_collection_link::Column::CollectionId.eq(collection_id)),
            )
            .exec(db)
            .await
    }

    /// 获取合集中的所有游戏 ID
    pub async fn get_games_in_collection(
        db: &DatabaseConnection,
        collection_id: i32,
    ) -> Result<Vec<i32>, DbErr> {
        let links = GameCollectionLink::find()
            .filter(game_collection_link::Column::CollectionId.eq(collection_id))
            .order_by_asc(game_collection_link::Column::SortOrder)
            .all(db)
            .await?;

        Ok(links.into_iter().map(|link| link.game_id).collect())
    }

    /// 获取合集中的游戏数量
    pub async fn count_games_in_collection(
        db: &DatabaseConnection,
        collection_id: i32,
    ) -> Result<u64, DbErr> {
        GameCollectionLink::find()
            .filter(game_collection_link::Column::CollectionId.eq(collection_id))
            .count(db)
            .await
    }

    /// 批量添加游戏到合集（优化版，使用批量插入）
    pub async fn add_games_to_collection(
        db: &DatabaseConnection,
        game_ids: Vec<i32>,
        collection_id: i32,
    ) -> Result<(), DbErr> {
        if game_ids.is_empty() {
            return Ok(());
        }

        let now = chrono::Utc::now().timestamp() as i32;

        // 获取当前合集中的最大排序值
        let max_sort_order = GameCollectionLink::find()
            .filter(game_collection_link::Column::CollectionId.eq(collection_id))
            .order_by_desc(game_collection_link::Column::SortOrder)
            .one(db)
            .await?
            .map(|link| link.sort_order)
            .unwrap_or(-1);

        let links: Vec<game_collection_link::ActiveModel> = game_ids
            .iter()
            .enumerate()
            .map(|(index, game_id)| game_collection_link::ActiveModel {
                id: NotSet,
                game_id: Set(*game_id),
                collection_id: Set(collection_id),
                sort_order: Set(max_sort_order + 1 + index as i32),
                created_at: Set(Some(now)),
            })
            .collect();

        GameCollectionLink::insert_many(links).exec(db).await?;

        Ok(())
    }

    /// 批量从合集中移除游戏
    pub async fn remove_games_from_collection(
        db: &DatabaseConnection,
        game_ids: Vec<i32>,
        collection_id: i32,
    ) -> Result<DeleteResult, DbErr> {
        if game_ids.is_empty() {
            return Ok(DeleteResult { rows_affected: 0 });
        }

        GameCollectionLink::delete_many()
            .filter(
                game_collection_link::Column::CollectionId
                    .eq(collection_id)
                    .and(game_collection_link::Column::GameId.is_in(game_ids)),
            )
            .exec(db)
            .await
    }

    /// 检查游戏是否在合集中
    pub async fn is_game_in_collection(
        db: &DatabaseConnection,
        game_id: i32,
        collection_id: i32,
    ) -> Result<bool, DbErr> {
        let count = GameCollectionLink::find()
            .filter(
                game_collection_link::Column::GameId
                    .eq(game_id)
                    .and(game_collection_link::Column::CollectionId.eq(collection_id)),
            )
            .count(db)
            .await?;

        Ok(count > 0)
    }

    // ==================== 前端友好的组合 API ====================

    /// 获取分组中的游戏总数（统计该分组下所有分类的游戏数）
    pub async fn count_games_in_group(
        db: &DatabaseConnection,
        group_id: i32,
    ) -> Result<u64, DbErr> {
        // 获取该分组下的所有分类
        let categories = Self::find_children(db, group_id).await?;
        let category_ids: Vec<i32> = categories.iter().map(|c| c.id).collect();

        if category_ids.is_empty() {
            return Ok(0);
        }

        // 统计这些分类中的游戏总数（去重）
        let count = GameCollectionLink::find()
            .filter(game_collection_link::Column::CollectionId.is_in(category_ids))
            .select_only()
            .column_as(game_collection_link::Column::GameId, "game_id")
            .distinct()
            .count(db)
            .await?;

        Ok(count)
    }

    /// 获取完整的分组-分类树（一次性返回所有数据）
    pub async fn get_collection_tree(
        db: &DatabaseConnection,
    ) -> Result<Vec<GroupWithCategories>, DbErr> {
        let groups = Self::find_root_collections(db).await?;
        let mut result = Vec::new();

        for group in groups {
            let categories = Self::find_children(db, group.id).await?;
            let mut categories_with_count = Vec::new();

            for category in categories {
                let count = Self::count_games_in_collection(db, category.id).await?;
                categories_with_count.push(CategoryWithCount {
                    id: category.id,
                    name: category.name,
                    icon: category.icon,
                    sort_order: category.sort_order,
                    game_count: count,
                });
            }

            result.push(GroupWithCategories {
                id: group.id,
                name: group.name,
                icon: group.icon,
                sort_order: group.sort_order,
                categories: categories_with_count,
            });
        }

        Ok(result)
    }

    /// 获取指定分组的分类列表（带游戏数量）
    pub async fn get_categories_with_count(
        db: &DatabaseConnection,
        group_id: i32,
    ) -> Result<Vec<CategoryWithCount>, DbErr> {
        let categories = Self::find_children(db, group_id).await?;
        let mut result = Vec::new();

        for category in categories {
            let count = Self::count_games_in_collection(db, category.id).await?;
            result.push(CategoryWithCount {
                id: category.id,
                name: category.name,
                icon: category.icon,
                sort_order: category.sort_order,
                game_count: count,
            });
        }

        Ok(result)
    }
}
