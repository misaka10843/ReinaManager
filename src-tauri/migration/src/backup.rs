use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use reina_path::{next_backup_filename, temporary_sibling_path};
use sea_orm_migration::sea_orm::{ConnectionTrait, DbBackend, DbErr, Statement};

/// 从当前连接读取主数据库路径，备份与旧版补偿迁移必须操作同一个数据库。
pub(crate) async fn connected_database_path<C>(connection: &C) -> Result<PathBuf, DbErr>
where
    C: ConnectionTrait,
{
    let databases = connection
        .query_all_raw(Statement::from_string(
            DbBackend::Sqlite,
            "PRAGMA database_list",
        ))
        .await?;
    for database in databases {
        if database.try_get::<String>("", "name")? == "main" {
            let file = database.try_get::<String>("", "file")?;
            if !file.is_empty() {
                return Ok(PathBuf::from(file));
            }
        }
    }
    Err(DbErr::Custom("当前连接没有可备份的主数据库文件".into()))
}

/// 使用 SQLite 一致性快照备份数据库。
///
/// 自动读取数据库中 `user.db_backup_path` 字段：
/// - 若存在且非空，则备份到该路径下
/// - 否则备份到数据库所在目录的 `backups/` 子目录
/// - 自定义目录备份失败时记录警告并回退默认目录；默认目录备份失败则终止迁移
pub(crate) async fn backup_sqlite(db_path: &Path, version: &str) -> Result<PathBuf, DbErr> {
    let db_url = path_to_sqlite_url_with_mode(db_path, "rw")?;

    let pool = sqlx::SqlitePool::connect(&db_url)
        .await
        .map_err(|e| DbErr::Custom(format!("Failed to connect: {}", e)))?;

    let backup_result = backup_open_database(&pool, db_path, version).await;
    pool.close().await;
    backup_result
}

async fn backup_open_database(
    pool: &sqlx::SqlitePool,
    db_path: &Path,
    version: &str,
) -> Result<PathBuf, DbErr> {
    verify_integrity(pool, "源数据库").await?;

    // 更老的 schema 可能没有该字段；其他读取错误必须上报，不能误当成未配置。
    let has_backup_path: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('user') WHERE name = 'db_backup_path')",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| DbErr::Custom(format!("检查数据库备份目录配置失败: {e}")))?;
    let custom_path: Option<String> = if has_backup_path {
        sqlx::query_scalar("SELECT db_backup_path FROM user LIMIT 1")
            .fetch_optional(pool)
            .await
            .map_err(|e| DbErr::Custom(format!("读取数据库备份目录配置失败: {e}")))?
            .flatten()
    } else {
        None
    };

    let default_dir = db_path
        .parent()
        .ok_or_else(|| DbErr::Custom("数据库文件缺少父目录".into()))?
        .join("backups");
    let custom_dir = custom_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .and_then(|path| match reina_path::resolve_user_path(path) {
            Ok(path) => Some(path),
            Err(error) => {
                log::warn!(
                    "[MIGRATION] 自定义数据库备份目录解析失败，将回退默认目录。configured={}, error={error}",
                    path
                );
                None
            }
        });

    create_backup_with_fallback(pool, version, custom_dir.as_deref(), &default_dir).await
}

/// 将文件路径转换为 sqlite 连接 URL
pub fn path_to_sqlite_url(path: &Path) -> Result<String, DbErr> {
    path_to_sqlite_url_with_mode(path, "rwc")
}

pub(crate) fn path_to_sqlite_url_with_mode(path: &Path, mode: &str) -> Result<String, DbErr> {
    let db_url = url::Url::from_file_path(path)
        .map_err(|_| DbErr::Custom("Invalid database path".to_string()))?;
    Ok(format!("sqlite:{}?mode={}", db_url.path(), mode))
}

async fn verify_integrity(pool: &sqlx::SqlitePool, label: &str) -> Result<(), DbErr> {
    let results: Vec<String> = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_all(pool)
        .await
        .map_err(|e| DbErr::Custom(format!("Failed to check {} integrity: {}", label, e)))?;

    if results.len() == 1 && results[0].eq_ignore_ascii_case("ok") {
        Ok(())
    } else {
        Err(DbErr::Custom(format!(
            "{}完整性检查失败: {}",
            label,
            results.join("; ")
        )))
    }
}

async fn create_snapshot(pool: &sqlx::SqlitePool, path: &Path) -> Result<(), DbErr> {
    sqlx::query("VACUUM INTO ?")
        .bind(path.to_string_lossy().as_ref())
        .execute(pool)
        .await
        .map_err(|e| DbErr::Custom(format!("Failed to create SQLite snapshot: {}", e)))?;
    Ok(())
}

async fn create_verified_backup(
    pool: &sqlx::SqlitePool,
    version: &str,
    target_dir: &Path,
) -> Result<PathBuf, DbErr> {
    fs::create_dir_all(target_dir).map_err(|e| {
        DbErr::Custom(format!(
            "无法创建数据库备份目录 {}: {}",
            target_dir.display(),
            e
        ))
    })?;

    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let prefix = format!(
        "reina_manager_pre_migration_v{}_",
        version.trim_start_matches('v')
    );
    let backup_name =
        next_backup_filename(target_dir, &prefix, &timestamp, ".db").map_err(DbErr::Custom)?;
    let backup_path = target_dir.join(backup_name);
    let temporary_path =
        temporary_sibling_path(&backup_path, "reina-creating").map_err(DbErr::Custom)?;

    // 先验证临时快照，成功后才发布正式文件，失败产物不能被误认为有效备份。
    let result = async {
        create_snapshot(pool, &temporary_path).await?;
        let backup_url = path_to_sqlite_url_with_mode(&temporary_path, "ro")?;
        let backup_pool = sqlx::SqlitePool::connect(&backup_url)
            .await
            .map_err(|e| DbErr::Custom(format!("无法打开备份数据库: {e}")))?;
        let label = format!("备份数据库 {}", backup_path.display());
        let integrity_result = verify_integrity(&backup_pool, &label).await;
        backup_pool.close().await;
        integrity_result?;

        match fs::symlink_metadata(&backup_path) {
            Ok(_) => {
                return Err(DbErr::Custom(format!(
                    "备份文件已存在: {}",
                    backup_path.display()
                )))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(DbErr::Custom(format!("检查备份文件失败: {error}"))),
        }
        fs::rename(&temporary_path, &backup_path)
            .map_err(|e| DbErr::Custom(format!("发布数据库备份失败: {e}")))?;
        Ok(backup_path)
    }
    .await;
    if result.is_err() {
        if let Err(error) = fs::remove_file(&temporary_path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                log::warn!(
                    "[MIGRATION] 清理失败的临时备份失败 {}: {error}",
                    temporary_path.display()
                );
            }
        }
    }
    result
}

async fn create_backup_with_fallback(
    pool: &sqlx::SqlitePool,
    version: &str,
    custom_dir: Option<&Path>,
    default_dir: &Path,
) -> Result<PathBuf, DbErr> {
    let Some(custom_dir) = custom_dir else {
        return create_verified_backup(pool, version, default_dir).await;
    };

    match create_verified_backup(pool, version, custom_dir).await {
        Ok(backup_path) => Ok(backup_path),
        Err(custom_error) => {
            log::warn!(
                "[MIGRATION] 自定义数据库备份失败，将尝试默认目录。custom_dir={}, default_dir={}, error={}",
                custom_dir.display(),
                default_dir.display(),
                custom_error
            );

            create_verified_backup(pool, version, default_dir)
                .await
                .map_err(|default_error| {
                    DbErr::Custom(format!(
                        "自定义数据库备份失败，回退默认目录后仍失败；custom_dir={}；custom_error={}；default_dir={}；default_error={}",
                        custom_dir.display(),
                        custom_error,
                        default_dir.display(),
                        default_error
                    ))
                })
        }
    }
}

#[cfg(test)]
pub(crate) use tests::create_test_directory;

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    pub(crate) fn create_test_directory(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "reina_backup_{}_{}_{}",
            name,
            std::process::id(),
            unique
        ));
        fs::create_dir_all(&directory).unwrap();
        directory
    }

    async fn create_test_source(directory: &Path) -> sqlx::SqlitePool {
        let source_path = directory.join("source.db");
        let source_pool = sqlx::SqlitePool::connect(&path_to_sqlite_url(&source_path).unwrap())
            .await
            .unwrap();
        sqlx::query("CREATE TABLE values_table(value TEXT NOT NULL)")
            .execute(&source_pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO values_table(value) VALUES ('kept')")
            .execute(&source_pool)
            .await
            .unwrap();
        source_pool
    }

    async fn read_test_value(backup_path: &Path) -> String {
        let backup_pool =
            sqlx::SqlitePool::connect(&path_to_sqlite_url_with_mode(backup_path, "ro").unwrap())
                .await
                .unwrap();
        let value = sqlx::query_scalar("SELECT value FROM values_table")
            .fetch_one(&backup_pool)
            .await
            .unwrap();
        backup_pool.close().await;
        value
    }

    #[tokio::test]
    async fn vacuum_into_creates_readable_snapshot() {
        let directory = create_test_directory("snapshot_test");
        let backup_path = directory.join("backup.db");
        let source_pool = create_test_source(&directory).await;

        create_snapshot(&source_pool, &backup_path).await.unwrap();
        source_pool.close().await;

        let backup_pool =
            sqlx::SqlitePool::connect(&path_to_sqlite_url_with_mode(&backup_path, "ro").unwrap())
                .await
                .unwrap();
        verify_integrity(&backup_pool, "测试备份").await.unwrap();
        let value: String = sqlx::query_scalar("SELECT value FROM values_table")
            .fetch_one(&backup_pool)
            .await
            .unwrap();
        assert_eq!(value, "kept");
        backup_pool.close().await;

        fs::remove_dir_all(directory).unwrap();
    }

    #[tokio::test]
    async fn custom_backup_failure_falls_back_to_verified_default_directory() {
        let directory = create_test_directory("fallback_test");
        let invalid_custom_dir = directory.join("invalid-custom");
        let default_dir = directory.join("missing").join("backups");
        fs::write(&invalid_custom_dir, "not a directory").unwrap();

        let source_pool = create_test_source(&directory).await;
        let backup_path = create_backup_with_fallback(
            &source_pool,
            "fallback_test",
            Some(&invalid_custom_dir),
            &default_dir,
        )
        .await
        .unwrap();
        assert_eq!(backup_path.parent(), Some(default_dir.as_path()));

        let value = read_test_value(&backup_path).await;
        assert_eq!(value, "kept");
        source_pool.close().await;

        fs::remove_dir_all(directory).unwrap();
    }

    #[tokio::test]
    async fn fallback_failure_reports_both_directories() {
        let directory = create_test_directory("fallback_error_test");
        let invalid_custom_dir = directory.join("invalid-custom");
        let invalid_default_dir = directory.join("invalid-default");
        fs::write(&invalid_custom_dir, "not a directory").unwrap();
        fs::write(&invalid_default_dir, "not a directory").unwrap();

        let source_pool = create_test_source(&directory).await;
        let error = create_backup_with_fallback(
            &source_pool,
            "fallback_error_test",
            Some(&invalid_custom_dir),
            &invalid_default_dir,
        )
        .await
        .unwrap_err()
        .to_string();

        assert!(error.contains(invalid_custom_dir.to_string_lossy().as_ref()));
        assert!(error.contains(invalid_default_dir.to_string_lossy().as_ref()));
        assert!(error.contains("回退默认目录后仍失败"));
        source_pool.close().await;

        fs::remove_dir_all(directory).unwrap();
    }
}
