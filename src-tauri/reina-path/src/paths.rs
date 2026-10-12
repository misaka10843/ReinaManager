use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::runtime_environment;

/// 数据库相关路径常量
pub const DB_DATA_DIR: &str = "data";
pub const DB_FILE_NAME: &str = "reina_manager.db";

// 基础数据目录下的子目录名称
pub const BACKUP_SUBDIR: &str = "backups";
pub const RESOURCE_DIR: &str = "resources";

/// 判断是否处于便携模式（纯 Rust 版本）
///
/// 开发版始终返回 false；正式版检查可执行文件同级目录下是否存在 resources/data。
pub fn is_portable_mode() -> bool {
    if runtime_environment().is_development() {
        return false;
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let portable_data_dir = exe_dir.join(RESOURCE_DIR).join(DB_DATA_DIR);
            return portable_data_dir.is_dir();
        }
    }
    false
}

/// 获取基础数据根目录。
///
/// 该目录是应用非数据库资源的统一根目录：
/// - 便携模式: `<exe>/resources`
/// - 安装模式: `<system-data>/<identifier>`
///
/// 数据库属于该根目录下的专用子目录 `<base>/data`，不要把本函数当作数据库目录使用。
pub fn get_base_data_dir() -> Result<PathBuf, String> {
    if is_portable_mode() {
        get_base_data_dir_for_mode(true)
    } else {
        let system_dir = get_base_data_dir_for_mode(false)?;
        std::fs::create_dir_all(&system_dir)
            .map_err(|e| format!("无法创建系统数据目录 {}: {}", system_dir.display(), e))?;
        Ok(system_dir)
    }
}

/// 获取指定模式下的基础数据根目录。
///
/// 开发版忽略 portable 参数，始终使用独立的系统数据目录。
///
/// 返回值语义与 `get_base_data_dir` 一致：
/// - 便携模式: `<exe>/resources`
/// - 安装模式: `<system-data>/<identifier>`
pub fn get_base_data_dir_for_mode(portable: bool) -> Result<PathBuf, String> {
    let environment = runtime_environment();
    if portable && !environment.is_development() {
        let exe_path =
            std::env::current_exe().map_err(|e| format!("无法获取可执行文件路径: {}", e))?;
        let exe_dir = exe_path
            .parent()
            .ok_or_else(|| "无法获取可执行文件父目录".to_string())?;
        Ok(exe_dir.join(RESOURCE_DIR))
    } else {
        use directories::BaseDirs;

        let base_dirs = BaseDirs::new().ok_or_else(|| "无法获取系统目录信息".to_string())?;

        Ok(base_dirs.data_dir().join(environment.identifier()))
    }
}

/// 获取数据库专用目录 `<base>/data`。
pub fn get_db_data_dir() -> Result<PathBuf, String> {
    Ok(get_base_data_dir()?.join(DB_DATA_DIR))
}

/// 获取指定模式下的数据库专用目录 `<base>/data`。
pub fn get_db_data_dir_for_mode(portable: bool) -> Result<PathBuf, String> {
    Ok(get_base_data_dir_for_mode(portable)?.join(DB_DATA_DIR))
}

/// 获取数据库文件路径 `<base>/data/reina_manager.db`。
pub fn get_db_path() -> Result<PathBuf, String> {
    Ok(get_db_data_dir()?.join(DB_FILE_NAME))
}

/// 获取默认的数据库备份路径
pub fn get_default_db_backup_path() -> Result<PathBuf, String> {
    Ok(get_db_data_dir()?.join(BACKUP_SUBDIR))
}

/// 获取默认的存档备份路径
pub fn get_default_savedata_backup_path() -> Result<PathBuf, String> {
    Ok(get_base_data_dir()?.join(BACKUP_SUBDIR))
}

/// 为同一秒内创建的备份分配不会覆盖现有文件的编号。
///
/// `artifacts` 列出共享该编号的所有产物；任意一个产物已存在都会跳过该编号。
pub fn next_backup_id(
    backup_dir: &Path,
    timestamp: &str,
    artifacts: &[(&str, &str)],
) -> Result<String, String> {
    for suffix in 0..1000 {
        let backup_id = if suffix == 0 {
            timestamp.to_string()
        } else {
            format!("{timestamp}_{suffix:03}")
        };
        let mut occupied = false;
        for (prefix, extension) in artifacts {
            let candidate = backup_dir.join(format!("{prefix}{backup_id}{extension}"));
            match fs::symlink_metadata(&candidate) {
                Ok(_) => {
                    occupied = true;
                    break;
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(format!(
                        "检查备份文件名是否冲突失败 {}: {error}",
                        candidate.display()
                    ));
                }
            }
        }
        if !occupied {
            return Ok(backup_id);
        }
    }
    Err("同一时间生成的备份文件过多，请稍后重试".to_string())
}

pub fn next_backup_filename(
    backup_dir: &Path,
    prefix: &str,
    timestamp: &str,
    extension: &str,
) -> Result<String, String> {
    let backup_id = next_backup_id(backup_dir, timestamp, &[(prefix, extension)])?;
    Ok(format!("{prefix}{backup_id}{extension}"))
}

/// 在目标文件同目录生成唯一临时路径，确保后续提交不依赖跨卷移动。
pub fn temporary_sibling_path(target: &Path, marker: &str) -> Result<PathBuf, String> {
    let parent = target
        .parent()
        .ok_or_else(|| format!("目标文件缺少父目录: {}", target.display()))?;
    let name = target
        .file_name()
        .ok_or_else(|| format!("目标文件缺少有效名称: {}", target.display()))?
        .to_string_lossy();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("获取临时文件时间失败: {error}"))?
        .as_nanos();
    for index in 0..1000_u32 {
        let candidate = parent.join(format!(
            ".{name}.{marker}-{}-{timestamp}-{index}",
            std::process::id()
        ));
        match fs::symlink_metadata(&candidate) {
            Ok(_) => continue,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(candidate),
            Err(error) => {
                return Err(format!(
                    "检查临时文件路径失败 {}: {error}",
                    candidate.display()
                ));
            }
        }
    }
    Err("无法生成唯一的临时文件路径".to_string())
}
