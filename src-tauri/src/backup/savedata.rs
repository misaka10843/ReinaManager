use chrono::Utc;
use serde::{Deserialize, Serialize};
use sevenz_rust::{SevenZArchiveEntry, SevenZWriter};
use std::fs;
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupInfo {
    pub folder_name: String,
    pub backup_time: i64,
    pub file_size: u64,
    pub backup_path: String,
}
/// 创建游戏存档备份
///
/// # Arguments
/// * `app` - Tauri应用句柄
/// * `game_id` - 游戏ID
/// * `source_path` - 源存档文件夹路径
/// * `backup_root_dir` - 前端提供的备份根目录
///
/// # Returns
/// * `Result<BackupInfo, String>` - 备份信息或错误消息
#[tauri::command]
pub async fn create_savedata_backup(
    _app: AppHandle,
    game_id: i64,
    source_path: String,
    backup_root_dir: String,
) -> Result<BackupInfo, String> {
    let source_path = Path::new(&source_path);
    let backup_root = Path::new(&backup_root_dir);

    // 验证源路径是否存在
    if !source_path.exists() {
        return Err("源存档文件夹不存在".to_string());
    }

    if !source_path.is_dir() {
        return Err("源路径必须是一个文件夹".to_string());
    }

    // 创建游戏专属备份目录
    let game_backup_dir = backup_root.join(format!("game_{}", game_id));

    fs::create_dir_all(&game_backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;

    // 生成备份文件名（带时间戳）
    let now = Utc::now();
    let timestamp = now.timestamp();
    let backup_filename = format!("savedata_{}_{}.7z", game_id, now.format("%Y%m%d_%H%M%S"));
    let backup_file_path = game_backup_dir.join(&backup_filename);

    // 创建7z压缩包
    let backup_size = create_7z_archive(source_path, &backup_file_path)
        .map_err(|e| format!("创建压缩包失败: {}", e))?;

    Ok(BackupInfo {
        folder_name: backup_filename,
        backup_time: timestamp,
        file_size: backup_size,
        backup_path: backup_file_path.to_string_lossy().to_string(),
    })
}

/// 删除备份文件
///
/// # Arguments
/// * `backup_file_path` - 备份文件完整路径
///
/// # Returns
/// * `Result<(), String>` - 成功或错误消息
#[tauri::command]
pub async fn delete_savedata_backup(backup_file_path: String) -> Result<(), String> {
    let normalized_path = backup_file_path.replace('/', "\\");
    let backup_path = Path::new(&normalized_path);

    if !backup_path.exists() {
        return Err("备份文件不存在".to_string());
    }

    fs::remove_file(backup_path).map_err(|e| format!("删除备份文件失败: {}", e))?;

    Ok(())
}

/// 创建7z压缩包
///
/// # Arguments
/// * `source_dir` - 源目录路径
/// * `archive_path` - 目标压缩包路径
///
/// # Returns
/// * `Result<u64, Box<dyn std::error::Error>>` - 压缩包文件大小或错误
fn create_7z_archive(
    source_dir: &Path,
    archive_path: &Path,
) -> Result<u64, Box<dyn std::error::Error>> {
    let archive_file = fs::File::create(archive_path)?;
    let mut sz = SevenZWriter::new(archive_file)?;

    // 递归添加目录中的所有文件
    add_directory_to_archive(&mut sz, source_dir, "")?;

    sz.finish()?;

    // 获取压缩包文件大小
    let metadata = fs::metadata(archive_path)?;
    Ok(metadata.len())
}

/// 递归添加目录到压缩包
///
/// # Arguments
/// * `sz` - 7z写入器
/// * `dir_path` - 目录路径
/// * `archive_prefix` - 压缩包内的路径前缀
fn add_directory_to_archive(
    sz: &mut SevenZWriter<fs::File>,
    dir_path: &Path,
    archive_prefix: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let entries = fs::read_dir(dir_path)?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();

        let archive_path = if archive_prefix.is_empty() {
            file_name_str.to_string()
        } else {
            format!("{}/{}", archive_prefix, file_name_str)
        };

        if path.is_dir() {
            // 递归处理子目录
            add_directory_to_archive(sz, &path, &archive_path)?;
        } else {
            // 添加文件到压缩包
            let file_content = fs::read(&path)?;
            let mut entry = SevenZArchiveEntry::new();
            entry.name = archive_path;
            let cursor = std::io::Cursor::new(file_content);
            sz.push_archive_entry(entry, Some(cursor))?;
        }
    }

    Ok(())
}
