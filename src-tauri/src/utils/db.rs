use crate::database::connection::{ensure_backup_dir_exists, get_db_path};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupResult {
    pub success: bool,
    pub path: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub success: bool,
    pub message: String,
    pub backup_path: Option<String>,
}

/// 生成带时间戳的备份文件名
fn generate_backup_filename() -> String {
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    format!("reina_manager_{}.db", timestamp)
}

/// 解析备份目标目录
///
/// 如果提供了自定义路径且非空，则使用自定义路径（必要时创建目录）
/// 否则使用默认的备份目录
fn resolve_backup_dir(
    backup_path: Option<&String>,
    app_handle: &tauri::AppHandle,
) -> Result<PathBuf, String> {
    if let Some(path) = backup_path {
        if !path.is_empty() {
            let dir = Path::new(path);
            if !dir.exists() {
                fs::create_dir_all(dir).map_err(|e| format!("无法创建备份目录: {}", e))?;
            }
            return Ok(dir.to_path_buf());
        }
    }
    ensure_backup_dir_exists(app_handle)
}

/// 使用 VACUUM INTO 进行数据库热备份
///
/// 此方法使用 SQLite 的 VACUUM INTO 语句，可以在数据库正在使用时安全地创建备份。
/// VACUUM INTO 会创建一个优化后的数据库副本，同时保持原数据库的完整性。
///
/// # Arguments
///
/// * `backup_path` - 可选的备份目标路径。如果为空，则使用默认的 AppData/data/backups 目录
/// * `app_handle` - Tauri 应用句柄
///
/// # Returns
///
/// 备份结果，包含备份文件的路径
#[command]
pub async fn backup_database(
    backup_path: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<BackupResult, String> {
    // 获取数据库连接
    let db = app_handle
        .try_state::<sea_orm::DatabaseConnection>()
        .ok_or("数据库连接不可用")?;

    // 生成备份文件名并确定目标路径
    let backup_name = generate_backup_filename();
    let backup_dir = resolve_backup_dir(backup_path.as_ref(), &app_handle)?;
    let target_path = backup_dir.join(&backup_name);

    // 将路径转换为字符串
    let target_path_str = target_path
        .to_str()
        .ok_or("备份路径包含无效字符")?
        .to_string();

    // 使用 VACUUM INTO 进行热备份
    // 注意：路径需要使用单引号，且路径分隔符需要转义
    let escaped_path = target_path_str.replace('\\', "\\\\").replace('\'', "''");
    let vacuum_sql = format!("VACUUM INTO '{}'", escaped_path);

    // 执行 VACUUM INTO
    use sea_orm::ConnectionTrait;
    db.execute_unprepared(&vacuum_sql)
        .await
        .map_err(|e| format!("VACUUM INTO 备份失败: {}", e))?;

    log::info!("数据库热备份成功: {}", target_path_str);

    Ok(BackupResult {
        success: true,
        path: Some(target_path_str),
        message: "数据库备份成功".to_string(),
    })
}

/// 导入数据库文件（覆盖现有数据库）
///
/// 流程：
/// 1. 关闭当前数据库连接
/// 2. 使用 fs::copy 备份当前数据库（冷备份，性能更好）
/// 3. 用导入的数据库文件覆盖现有数据库
/// 4. 重新建立数据库连接并执行迁移
///
/// 注意：由于需要关闭并重新打开数据库连接，导入后需要重启应用
///
/// # Arguments
///
/// * `source_path` - 要导入的数据库文件路径
/// * `backup_path` - 可选的备份目标路径。如果为空，则使用默认的 AppData/data/backups 目录
/// * `app_handle` - Tauri 应用句柄
///
/// # Returns
///
/// 导入结果，包含备份路径（如果备份成功）
#[command]
pub async fn import_database(
    source_path: String,
    backup_path: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<ImportResult, String> {
    let src_path = Path::new(&source_path);

    // 检查源文件是否存在
    if !src_path.exists() {
        return Err(format!("源数据库文件不存在: {}", source_path));
    }

    // 检查文件扩展名
    if src_path.extension().and_then(|e| e.to_str()) != Some("db") {
        return Err("无效的数据库文件，请选择 .db 文件".to_string());
    }

    // 获取数据库路径
    let target_db_path = get_db_path(&app_handle)?;

    // 步骤1：关闭数据库连接（必须先关闭才能安全备份和覆盖）
    if let Some(conn_state) = app_handle.try_state::<sea_orm::DatabaseConnection>() {
        let conn = conn_state.inner().clone();
        crate::database::connection::close_connection(conn)
            .await
            .map_err(|e| format!("关闭数据库连接失败: {}", e))?;
        log::info!("数据库连接已关闭，准备备份和导入");
    }

    // 步骤2：使用 fs::copy 进行冷备份（连接已关闭，可以安全复制）
    let result_backup_path = if target_db_path.exists() {
        let backup_name = generate_backup_filename();
        let backup_dir = resolve_backup_dir(backup_path.as_ref(), &app_handle)?;
        let backup_file_path = backup_dir.join(&backup_name);

        match fs::copy(&target_db_path, &backup_file_path) {
            Ok(_) => {
                let path_str = backup_file_path.to_string_lossy().to_string();
                log::info!("导入前冷备份成功: {}", path_str);
                Some(path_str)
            }
            Err(e) => {
                log::warn!("导入前备份失败: {}，继续导入", e);
                None
            }
        }
    } else {
        None
    };

    // 步骤3：复制文件覆盖现有数据库
    fs::copy(src_path, &target_db_path).map_err(|e| format!("复制数据库文件失败: {}", e))?;
    log::info!("数据库文件已复制: {} -> {:?}", source_path, target_db_path);

    // 步骤4：重新建立数据库连接
    match crate::database::connection::establish_connection(&app_handle).await {
        Ok(new_conn) => {
            log::info!("数据库连接已重新建立");

            // 执行数据库迁移确保结构兼容
            use migration::MigratorTrait;
            match migration::Migrator::up(&new_conn, None).await {
                Ok(_) => log::info!("导入数据库迁移完成"),
                Err(e) => log::warn!("导入数据库迁移失败（可能版本不兼容）: {}", e),
            }

            // 由于 Tauri 状态管理的限制，无法动态替换连接
            // 需要通知前端重启应用
            app_handle.manage(new_conn);
        }
        Err(e) => {
            return Err(format!("重新建立数据库连接失败: {}。请重启应用。", e));
        }
    }

    Ok(ImportResult {
        success: true,
        message: "数据库导入成功，请重启应用以确保数据正确加载".to_string(),
        backup_path: result_backup_path,
    })
}
