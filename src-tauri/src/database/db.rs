use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr, RuntimeErr};
use std::fs;
use std::time::Duration;
use url::Url;

use reina_path::{get_db_path, is_portable_mode};

// ==================== 数据库连接管理 ====================

/// Establish a SeaORM database connection.
pub async fn establish_connection() -> Result<DatabaseConnection, DbErr> {
    // 1. 获取数据库路径（自动判断便携模式）
    let db_path = get_db_path().map_err(|e| DbErr::Conn(RuntimeErr::Internal(e)))?;

    fn mode() -> &'static str {
        if is_portable_mode() {
            "便携"
        } else {
            "标准"
        }
    }

    // 2. 如果数据库不存在，创建目录
    if !db_path.exists() {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                DbErr::Conn(RuntimeErr::Internal(format!("无法创建数据库目录: {}", e)))
            })?;
        }
        log::info!("首次启动，创建{}模式数据库: {}", mode(), db_path.display());
    } else {
        log::debug!("使用{}模式数据库: {}", mode(), db_path.display());
    }

    // 3. 使用 `url` crate 安全地构建连接字符串
    let db_url = Url::from_file_path(&db_path).map_err(|_| {
        DbErr::Conn(RuntimeErr::Internal(format!(
            "Invalid database path: {}",
            db_path.display()
        )))
    })?;

    let connection_string = format!("sqlite:{}?mode=rwc", db_url.path());

    // 4. 设置连接选项
    let mut options = ConnectOptions::new(connection_string);
    options
        .max_connections(1)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(8));

    // 5. 在开发模式下启用日志
    #[cfg(debug_assertions)]
    {
        options.sqlx_logging(false);
        log::debug!("数据库连接字符串: {}", options.get_url());
    }
    #[cfg(not(debug_assertions))]
    {
        options.sqlx_logging(false);
    }

    // 6. 连接数据库
    Database::connect(options).await
}

/// 关闭数据库连接
pub async fn close_connection(conn: DatabaseConnection) -> Result<(), DbErr> {
    conn.close().await?;
    Ok(())
}
