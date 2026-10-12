//! 为新游戏的 LE 与 Magpie 默认状态增加用户设置。

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                "ALTER TABLE \"user\" ADD COLUMN \"default_le_launch\" BOOLEAN NOT NULL DEFAULT 0; \
                 ALTER TABLE \"user\" ADD COLUMN \"default_magpie\" BOOLEAN NOT NULL DEFAULT 0;",
            )
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                "ALTER TABLE \"user\" DROP COLUMN \"default_magpie\"; \
                 ALTER TABLE \"user\" DROP COLUMN \"default_le_launch\";",
            )
            .await?;
        Ok(())
    }
}
