use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{command, AppHandle, Manager};

// ==================== 路径相关常量 ====================

/// 数据库相关路径常量
pub const DB_DATA_DIR: &str = "data";
pub const DB_FILE_NAME: &str = "reina_manager.db";
pub const DB_BACKUP_SUBDIR: &str = "backups";
pub const RESOURCE_DIR: &str = "resources";

// ==================== 路径基础函数 ====================

/// 判断是否处于便携模式
///
/// 判断逻辑：
/// 1. 检查 resources/data 目录是否存在
/// 2. 检查 resources/data/reina_manager.db 文件是否存在
/// 3. 两者都存在则为便携模式，否则为标准模式
///
pub fn is_portable_mode(app: &AppHandle) -> bool {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let portable_data_dir = resource_dir.join(RESOURCE_DIR).join(DB_DATA_DIR);
        let portable_db_file = portable_data_dir.join(DB_FILE_NAME);

        portable_data_dir.exists() && portable_db_file.exists()
    } else {
        false
    }
}

pub fn get_base_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if is_portable_mode(app) {
        // 便携模式：使用程序安装目录的 resources 子目录
        Ok(app
            .path()
            .resource_dir()
            .map_err(|e| format!("无法获取应用目录: {}", e))?
            .join(RESOURCE_DIR))
    } else {
        // 非便携模式：使用系统应用数据目录
        app.path()
            .app_data_dir()
            .map_err(|e| format!("无法获取应用数据目录: {}", e))
    }
}

/// 获取数据库文件路径
pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_base_data_dir(app)?.join(DB_DATA_DIR).join(DB_FILE_NAME))
}

/// # Arguments
/// * `app` - 应用句柄
/// * `portable` - true 表示便携模式，false 表示标准模式
pub fn get_base_data_dir_for_mode(app: &AppHandle, portable: bool) -> Result<PathBuf, String> {
    if portable {
        Ok(app
            .path()
            .resource_dir()
            .map_err(|e| format!("无法获取应用目录: {}", e))?
            .join(RESOURCE_DIR))
    } else {
        app.path()
            .app_data_dir()
            .map_err(|e| format!("无法获取应用数据目录: {}", e))
    }
}

// ==================== 路径管理器 ====================

/// 路径缓存，用于在应用运行期间复用已计算的路径
#[derive(Debug, Default)]
struct PathCache {
    db_backup_path: Option<PathBuf>,
    savedata_backup_path: Option<PathBuf>,
}

/// 全局路径管理器
pub struct PathManager {
    cache: Mutex<PathCache>,
}

impl PathManager {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(PathCache::default()),
        }
    }

    /// 获取数据库备份路径
    pub async fn get_db_backup_path(
        &self,
        app: &AppHandle,
        db: &DatabaseConnection,
    ) -> Result<PathBuf, String> {
        // 检查缓存
        {
            let cache = self.cache.lock().expect("路径管理器缓存锁已被污染");
            if let Some(path) = &cache.db_backup_path {
                return Ok(path.clone());
            }
        }

        // 从数据库读取配置
        let custom_path = self.get_db_backup_path_from_db(db).await?;

        let path = if let Some(custom) = custom_path {
            // 使用数据库中的自定义路径
            PathBuf::from(custom)
        } else {
            // 使用默认路径（根据便携模式判断）
            self.get_default_db_backup_path(app)?
        };

        // 缓存路径
        {
            let mut cache = self.cache.lock().expect("路径管理器缓存锁已被污染");
            cache.db_backup_path = Some(path.clone());
        }

        Ok(path)
    }

    /// 获取存档备份路径
    pub async fn get_savedata_backup_path(
        &self,
        app: &AppHandle,
        db: &DatabaseConnection,
    ) -> Result<PathBuf, String> {
        // 检查缓存
        {
            let cache = self.cache.lock().expect("路径管理器缓存锁已被污染");
            if let Some(path) = &cache.savedata_backup_path {
                return Ok(path.clone());
            }
        }

        // 从数据库读取配置
        let custom_path = self.get_save_root_path_from_db(db).await?;

        let path = if let Some(custom) = custom_path {
            // 使用数据库中的自定义路径 + /backups
            PathBuf::from(custom).join("backups")
        } else {
            // 使用默认路径（根据便携模式判断）
            self.get_default_savedata_backup_path(app)?
        };

        // 缓存路径
        {
            let mut cache = self.cache.lock().expect("路径管理器缓存锁已被污染");
            cache.savedata_backup_path = Some(path.clone());
        }

        Ok(path)
    }

    /// 清空路径缓存（用于用户修改配置后）
    pub fn clear_cache(&self) {
        let mut cache = self.cache.lock().expect("路径管理器缓存锁已被污染");
        *cache = PathCache::default();
    }

    // ==================== 私有辅助方法 ====================

    /// 从数据库读取数据库备份路径配置
    async fn get_db_backup_path_from_db(
        &self,
        db: &DatabaseConnection,
    ) -> Result<Option<String>, String> {
        use crate::entity::prelude::*;
        use sea_orm::EntityTrait;

        let user = User::find()
            .one(db)
            .await
            .map_err(|e| format!("查询用户配置失败: {}", e))?;

        Ok(user
            .and_then(|u| u.db_backup_path)
            .filter(|s| !s.trim().is_empty()))
    }

    /// 从数据库读取存档根路径配置
    async fn get_save_root_path_from_db(
        &self,
        db: &DatabaseConnection,
    ) -> Result<Option<String>, String> {
        use crate::entity::prelude::*;
        use sea_orm::EntityTrait;

        let user = User::find()
            .one(db)
            .await
            .map_err(|e| format!("查询用户配置失败: {}", e))?;

        Ok(user
            .and_then(|u| u.save_root_path)
            .filter(|s| !s.trim().is_empty()))
    }

    /// 获取默认的数据库备份路径
    fn get_default_db_backup_path(&self, app: &AppHandle) -> Result<PathBuf, String> {
        Ok(get_base_data_dir(app)?
            .join(DB_DATA_DIR)
            .join(DB_BACKUP_SUBDIR))
    }

    /// 获取默认的存档备份路径
    fn get_default_savedata_backup_path(&self, app: &AppHandle) -> Result<PathBuf, String> {
        Ok(get_base_data_dir(app)?.join("backups"))
    }
}

// ==================== 文件操作相关 ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct MoveResult {
    pub success: bool,
    pub message: String,
}

/// 打开目录
///
/// # Arguments
///
/// * `dir_path` - 要打开的目录路径
///
/// # Returns
///
/// 操作结果
#[command]
pub async fn open_directory(dir_path: String) -> Result<(), String> {
    // 首先检查路径是否存在
    if !Path::new(&dir_path).exists() {
        return Err(format!("路径不存在且无法创建: {}", dir_path));
    }

    #[cfg(target_os = "windows")]
    {
        // 使用正斜杠转换为反斜杠，Windows Explorer 更喜欢反斜杠
        let normalized_path = dir_path.replace('/', "\\");

        let result = Command::new("explorer").arg(&normalized_path).spawn();

        match result {
            Ok(_) => Ok(()),
            Err(e) => {
                // 如果 explorer 失败，尝试使用 cmd /c start
                let fallback_result = Command::new("cmd")
                    .args(["/c", "start", "", &normalized_path])
                    .spawn();

                match fallback_result {
                    Ok(_) => Ok(()),
                    Err(e2) => Err(format!(
                        "无法打开目录 '{}': explorer 失败 ({}), cmd 备用方案也失败 ({})",
                        normalized_path, e, e2
                    )),
                }
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        let result = Command::new("xdg-open").arg(&dir_path).spawn();

        match result {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("无法打开目录 '{}': {}", dir_path, e)),
        }
    }
}

/// 移动备份文件夹到新位置
///
/// # Arguments
///
/// * `old_path` - 旧的备份文件夹路径
/// * `new_path` - 新的备份文件夹路径
///
/// # Returns
///
/// 移动操作的结果
#[command]
pub async fn move_backup_folder(old_path: String, new_path: String) -> Result<MoveResult, String> {
    let old_backup_path = Path::new(&old_path);
    let new_backup_path = Path::new(&new_path);

    // 检查旧路径是否存在
    if !old_backup_path.exists() {
        return Ok(MoveResult {
            success: true,
            message: "旧备份文件夹不存在，无需移动".to_string(),
        });
    }

    // 检查新路径的父目录是否存在，如果不存在则创建
    if let Some(parent) = new_backup_path.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return Ok(MoveResult {
                    success: false,
                    message: format!("无法创建目标目录: {}", e),
                });
            }
        }
    }

    // 检查新路径是否已经存在
    if new_backup_path.exists() {
        return Ok(MoveResult {
            success: false,
            message: "目标位置已存在备份文件夹，请手动处理".to_string(),
        });
    }

    // 尝试移动文件夹
    match fs::rename(old_backup_path, new_backup_path) {
        Ok(_) => Ok(MoveResult {
            success: true,
            message: "备份文件夹移动成功".to_string(),
        }),
        Err(_e) => {
            // 如果简单重命名失败（可能是跨分区），尝试复制然后删除
            match copy_dir_all(old_backup_path, new_backup_path) {
                Ok(_) => {
                    // 复制成功后删除原文件夹
                    match fs::remove_dir_all(old_backup_path) {
                        Ok(_) => Ok(MoveResult {
                            success: true,
                            message: "备份文件夹移动成功（通过复制）".to_string(),
                        }),
                        Err(e) => Ok(MoveResult {
                            success: false,
                            message: format!("文件夹已复制到新位置，但删除旧文件夹失败: {}", e),
                        }),
                    }
                }
                Err(e) => Ok(MoveResult {
                    success: false,
                    message: format!("移动文件夹失败: {}", e),
                }),
            }
        }
    }
}

/// 递归复制目录
///
/// # Arguments
///
/// * `src` - 源目录路径
/// * `dst` - 目标目录路径
///
/// # Returns
///
/// 复制操作的结果
fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), Box<dyn std::error::Error>> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

#[command]
pub async fn copy_file(src: String, dst: String) -> Result<(), String> {
    let src_path = Path::new(&src);
    let dst_path = Path::new(&dst);

    if !src_path.exists() {
        return Err(format!("源文件不存在: {}", src));
    }

    if let Some(parent) = dst_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建目标目录的父目录: {}", e))?;
        }
    }
    fs::copy(src_path, dst_path).map_err(|e| format!("无法复制文件: {}", e))?;
    Ok(())
}

/// 删除文件
#[command]
pub async fn delete_file(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Ok(()); // 文件不存在，视为成功
    }

    fs::remove_file(path).map_err(|e| format!("无法删除文件: {}", e))?;
    Ok(())
}

/// 删除指定游戏的所有自定义封面文件
#[command]
pub async fn delete_game_covers(game_id: u32, covers_dir: String) -> Result<(), String> {
    let dir_path = Path::new(&covers_dir);

    if !dir_path.exists() {
        return Ok(()); // 目录不存在，视为成功
    }

    // 读取目录中的所有文件
    let entries = fs::read_dir(dir_path).map_err(|e| format!("无法读取封面目录: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();

        // 匹配该游戏的封面文件模式：cover_{game_id}_*
        if file_name_str.starts_with(&format!("cover_{}_", game_id)) {
            let file_path = entry.path();
            if let Err(e) = fs::remove_file(&file_path) {
                eprintln!("删除文件失败 {:?}: {}", file_path, e);
                // 继续删除其他文件，不中断流程
            }
        }
    }

    Ok(())
}
