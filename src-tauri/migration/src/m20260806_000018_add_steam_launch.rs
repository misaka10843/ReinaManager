//! Add explicit Steam launch metadata without changing existing local launch records.

use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::{ConnectionTrait, TransactionTrait};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let transaction = manager.get_connection().begin().await?;
        transaction
            .execute_unprepared(
                r#"
                ALTER TABLE games ADD COLUMN launch_type TEXT NOT NULL DEFAULT 'local'
                    CHECK (launch_type IN ('local', 'steam'));
                ALTER TABLE games ADD COLUMN steam_app_id INTEGER
                    CHECK (steam_app_id IS NULL OR steam_app_id > 0);
                ALTER TABLE games ADD COLUMN steam_process_path TEXT;
                CREATE UNIQUE INDEX idx_games_steam_app_id_unique
                    ON games(steam_app_id) WHERE steam_app_id IS NOT NULL;
                "#,
            )
            .await?;
        transaction.commit().await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let transaction = manager.get_connection().begin().await?;
        transaction
            .execute_unprepared("DROP INDEX IF EXISTS idx_games_steam_app_id_unique")
            .await?;
        transaction
            .execute_unprepared("ALTER TABLE games DROP COLUMN steam_process_path")
            .await?;
        transaction
            .execute_unprepared("ALTER TABLE games DROP COLUMN steam_app_id")
            .await?;
        transaction
            .execute_unprepared("ALTER TABLE games DROP COLUMN launch_type")
            .await?;
        transaction.commit().await
    }
}
