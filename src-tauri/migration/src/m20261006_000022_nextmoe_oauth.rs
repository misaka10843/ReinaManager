//! 初始化 NextMoe 授权存储并解绑旧 Kun 编号，已有元数据快照保持不变。

use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::{ConnectionTrait, TransactionTrait};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let transaction = db.begin().await?;
        transaction
            .execute_unprepared(r#"ALTER TABLE "user" ADD COLUMN "nextmoe_auth" TEXT"#)
            .await?;
        // 旧迁移隔离无效 JSON 后可能只剩 ID；解绑前删除无快照来源，避免违反双空约束。
        let deleted = transaction
            .execute_unprepared("DELETE FROM game_sources WHERE source = 'kun' AND data IS NULL")
            .await?;
        let result = transaction
            .execute_unprepared(
                "UPDATE game_sources SET external_id = NULL WHERE source = 'kun' AND external_id IS NOT NULL",
            )
            .await?;
        transaction.commit().await?;
        log::info!(
            "[MIGRATION] 已重置 {} 条旧 Kun 绑定，清理 {} 条无快照来源，已有元数据保持不变",
            result.rows_affected(),
            deleted.rows_affected()
        );
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Err(DbErr::Custom(
            "Kun 解绑不可逆，请恢复迁移前数据库备份".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm_migration::sea_orm::{Database, DatabaseConnection, DbBackend, Statement};

    async fn old_database() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.execute_unprepared(
            r#"PRAGMA foreign_keys = ON;
            CREATE TABLE user (id INTEGER PRIMARY KEY, bgm_auth TEXT);
            INSERT INTO user VALUES(1, 'existing');
            CREATE TABLE games (
                id INTEGER PRIMARY KEY, id_type TEXT, localpath TEXT, clear INTEGER, date TEXT
            );
            CREATE TABLE game_sources (
                game_id INTEGER NOT NULL, source TEXT NOT NULL, external_id TEXT, data TEXT,
                score REAL GENERATED ALWAYS AS (json_extract(data, '$.score')) VIRTUAL,
                PRIMARY KEY(game_id, source),
                FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
                CHECK(external_id IS NOT NULL OR data IS NOT NULL),
                CHECK(data IS NULL OR json_valid(data))
            );
            INSERT INTO games VALUES(1, 'kun', 'kept-path', 3, '2016-07-29');
            INSERT INTO games VALUES(2, 'mixed', NULL, 1, '2002-08-29');
            INSERT INTO games VALUES(3, 'mixed', 'id-only-path', 2, '2003-01-01');
            INSERT INTO game_sources(game_id, source, external_id, data) VALUES
                (1, 'kun', '923', '{"name":"旧快照","summary":"保留内容","score":7.5}'),
                (2, 'kun', '924', '{"name":"另一份快照"}'),
                (2, 'vndb', 'v17', '{"name":"VNDB 快照"}'),
                (3, 'kun', '925', NULL),
                (3, 'vndb', 'v18', NULL);"#,
        )
        .await
        .unwrap();
        db
    }

    struct TestMigrator;

    #[async_trait::async_trait]
    impl MigratorTrait for TestMigrator {
        fn migrations() -> Vec<Box<dyn MigrationTrait>> {
            vec![Box::new(Migration)]
        }
    }

    #[tokio::test]
    async fn adding_nextmoe_auth_without_kun_bindings_preserves_existing_user_data() {
        let db = old_database().await;
        db.execute_unprepared("DELETE FROM game_sources WHERE source = 'kun'")
            .await
            .unwrap();
        TestMigrator::up(&db, None).await.unwrap();
        let row = db
            .query_one_raw(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT bgm_auth, nextmoe_auth FROM user WHERE id = 1".to_string(),
            ))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(row.try_get::<String>("", "bgm_auth").unwrap(), "existing");
        assert_eq!(
            row.try_get::<Option<String>>("", "nextmoe_auth").unwrap(),
            None
        );
    }

    #[tokio::test]
    async fn reset_preserves_snapshots_other_sources_and_game_fields() {
        let db = old_database().await;
        TestMigrator::up(&db, None).await.unwrap();
        let rows = db
            .query_all_raw(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT external_id, data, score FROM game_sources WHERE source = 'kun' ORDER BY game_id".to_string(),
            ))
            .await
            .unwrap();
        assert_eq!(rows.len(), 2);
        for row in &rows {
            assert_eq!(
                row.try_get::<Option<String>>("", "external_id").unwrap(),
                None
            );
        }
        assert_eq!(
            rows[0].try_get::<String>("", "data").unwrap(),
            r#"{"name":"旧快照","summary":"保留内容","score":7.5}"#
        );
        assert_eq!(rows[0].try_get::<f64>("", "score").unwrap(), 7.5);
        assert_eq!(
            rows[1].try_get::<String>("", "data").unwrap(),
            r#"{"name":"另一份快照"}"#
        );
        let game = db
            .query_one_raw(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT * FROM games WHERE id = 1".to_string(),
            ))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(game.try_get::<String>("", "id_type").unwrap(), "kun");
        assert_eq!(
            game.try_get::<String>("", "localpath").unwrap(),
            "kept-path"
        );
        assert_eq!(game.try_get::<i32>("", "clear").unwrap(), 3);
        assert_eq!(game.try_get::<String>("", "date").unwrap(), "2016-07-29");
        let other = db
            .query_one_raw(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT external_id, data FROM game_sources WHERE game_id = 2 AND source = 'vndb'"
                    .to_string(),
            ))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(other.try_get::<String>("", "external_id").unwrap(), "v17");
        assert_eq!(
            other.try_get::<String>("", "data").unwrap(),
            r#"{"name":"VNDB 快照"}"#
        );
        // 只清理旧 Kun 的无快照来源，游戏和其它源的 ID-only 记录仍保留。
        let identity_only = db
            .query_all_raw(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT source, external_id, data FROM game_sources WHERE game_id = 3".to_string(),
            ))
            .await
            .unwrap();
        assert_eq!(identity_only.len(), 1);
        assert_eq!(
            identity_only[0].try_get::<String>("", "source").unwrap(),
            "vndb"
        );
        assert_eq!(
            identity_only[0]
                .try_get::<String>("", "external_id")
                .unwrap(),
            "v18"
        );
        assert_eq!(
            identity_only[0]
                .try_get::<Option<String>>("", "data")
                .unwrap(),
            None
        );
        let preserved_game = db
            .query_one_raw(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT localpath, clear, date FROM games WHERE id = 3".to_string(),
            ))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            preserved_game.try_get::<String>("", "localpath").unwrap(),
            "id-only-path"
        );
        assert_eq!(preserved_game.try_get::<i32>("", "clear").unwrap(), 2);
        assert_eq!(
            preserved_game.try_get::<String>("", "date").unwrap(),
            "2003-01-01"
        );
    }

    #[tokio::test]
    async fn restored_old_database_resets_once_and_later_new_ids_survive_startup() {
        // 两个独立内存库代表原库和恢复的旧备份，不读取真实用户数据。
        for _ in 0..2 {
            let db = old_database().await;
            TestMigrator::up(&db, None).await.unwrap();
            db.execute_unprepared(
                "UPDATE game_sources SET external_id = '100' WHERE game_id = 1 AND source = 'kun'",
            )
            .await
            .unwrap();
            TestMigrator::up(&db, None).await.unwrap();
            let row = db
                .query_one_raw(Statement::from_string(
                    DbBackend::Sqlite,
                    "SELECT external_id FROM game_sources WHERE game_id = 1 AND source = 'kun'"
                        .to_string(),
                ))
                .await
                .unwrap()
                .unwrap();
            assert_eq!(row.try_get::<String>("", "external_id").unwrap(), "100");
            assert_eq!(
                TestMigrator::get_applied_migrations(&db)
                    .await
                    .unwrap()
                    .len(),
                1
            );
        }
    }

    #[tokio::test]
    async fn failed_reset_rolls_back_and_can_be_retried() {
        let db = old_database().await;
        db.execute_unprepared("CREATE TRIGGER reject_reset BEFORE UPDATE ON game_sources WHEN OLD.game_id = 2 AND OLD.source = 'kun' BEGIN SELECT RAISE(ABORT, 'test failure'); END;").await.unwrap();
        assert!(TestMigrator::up(&db, None).await.is_err());
        let rows = db
            .query_all_raw(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT external_id FROM game_sources WHERE source = 'kun' ORDER BY game_id"
                    .to_string(),
            ))
            .await
            .unwrap();
        assert_eq!(rows[0].try_get::<String>("", "external_id").unwrap(), "923");
        assert_eq!(rows[1].try_get::<String>("", "external_id").unwrap(), "924");
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[2].try_get::<String>("", "external_id").unwrap(), "925");
        assert!(!SchemaManager::new(&db)
            .has_column("user", "nextmoe_auth")
            .await
            .unwrap());
        assert!(TestMigrator::get_applied_migrations(&db)
            .await
            .unwrap()
            .is_empty());
        db.execute_unprepared("DROP TRIGGER reject_reset")
            .await
            .unwrap();
        TestMigrator::up(&db, None).await.unwrap();
    }
}
