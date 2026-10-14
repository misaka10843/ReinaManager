//! 为 user 表增加 NextMoe OAuth 授权信息列。

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(r#"ALTER TABLE "user" ADD COLUMN "nextmoe_auth" TEXT"#)
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(r#"ALTER TABLE "user" DROP COLUMN "nextmoe_auth""#)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm_migration::sea_orm::{ConnectionTrait, Database, DatabaseBackend, Statement};

    #[tokio::test]
    async fn existing_user_nextmoe_auth_remains_empty() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.execute_unprepared(
            "CREATE TABLE user (id INTEGER PRIMARY KEY); INSERT INTO user(id) VALUES (1);",
        )
        .await
        .unwrap();
        let manager = SchemaManager::new(&db);
        Migration.up(&manager).await.unwrap();

        let row = db
            .query_one_raw(Statement::from_string(
                DatabaseBackend::Sqlite,
                "SELECT nextmoe_auth FROM user WHERE id = 1".to_string(),
            ))
            .await
            .unwrap()
            .unwrap();
        assert!(row
            .try_get::<Option<String>>("", "nextmoe_auth")
            .unwrap()
            .is_none());
    }
}
