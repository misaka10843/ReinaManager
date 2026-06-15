#[cfg(target_os = "windows")]
use crate::utils::command_ext::CommandGuiExt;

use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::command;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct PortableModeResult {
    pub is_portable: bool,
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
        return Err(format!("路径不存在: {}", dir_path));
    }

    #[cfg(target_os = "windows")]
    {
        // Windows Explorer 在某些情况下对反斜杠的处理更稳定
        // 虽然 Windows 系统本身支持正斜杠，但 Explorer 更喜欢原生的反斜杠格式
        let normalized_path = dir_path.replace('/', "\\");

        let result = Command::new("explorer")
            .arg(&normalized_path)
            .gui_safe()
            .spawn();

        match result {
            Ok(_) => Ok(()),
            Err(e) => {
                // 如果 explorer 失败，尝试使用 cmd /c start
                let fallback_result = Command::new("cmd")
                    .args(["/c", "start", "", &normalized_path])
                    .gui_safe()
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

/// 判断当前是否为便携模式
#[command]
pub fn is_portable_mode() -> PortableModeResult {
    PortableModeResult {
        is_portable: reina_path::is_portable_mode(),
    }
}

// ==================== 数据迁移相关文件操作 ====================

/// 移动单个文件（剪切操作）
///
/// 优先使用 fs::rename，失败则使用 copy + remove
/// 如果目标文件已存在，会先尝试删除后重试
///
/// **跨盘策略**：对于跨盘符场景，先完整复制文件，成功后再删除源文件
pub fn move_file(from: &Path, to: &Path) -> Result<(), String> {
    // 确保目标目录存在
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目标目录失败: {}", e))?;
    }

    // 尝试使用 rename（性能最好，适用于同盘符）
    match fs::rename(from, to) {
        Ok(_) => {
            log::debug!("已移动文件(rename): {} -> {}", from.display(), to.display());
            Ok(())
        }
        Err(_) => {
            // rename 失败（可能跨盘符或目标文件已存在）
            // 策略：先复制，成功后再删除源文件

            // 如果目标文件已存在，先尝试删除
            if to.exists() {
                log::warn!("目标文件已存在，尝试删除: {}", to.display());
                fs::remove_file(to)
                    .map_err(|e| format!("无法删除已存在的目标文件 {}: {}", to.display(), e))?;
            }

            // 复制文件
            fs::copy(from, to).map_err(|e| format!("复制文件失败: {}", e))?;

            // 复制成功，删除源文件
            fs::remove_file(from).map_err(|e| format!("删除源文件失败: {}", e))?;

            log::debug!(
                "已移动文件(copy+remove): {} -> {}",
                from.display(),
                to.display()
            );
            Ok(())
        }
    }
}

/// 递归移动目录（剪切操作）
///
/// 优先使用 fs::rename (性能最好)，失败则使用 copy + remove
///
/// **跨盘策略**：
/// 1. 先尝试 rename（同盘符时最快）
/// 2. rename 失败则使用分步骤策略：
///    - 第一阶段：复制所有文件到目标位置（记录错误但继续尝试）
///    - 第二阶段：如果复制全部成功，才删除源目录
///    - 如果有任何错误，保留源文件，返回错误信息
///    - **不会清理目标目录**，避免删除已成功复制的文件
///
/// # Arguments
/// * `from` - 源目录
/// * `to` - 目标目录
///
/// # Returns
/// * `Result<usize, String>` - 成功移动的文件数量或错误消息
#[allow(dead_code)]
pub fn move_dir_recursive(from: &Path, to: &Path) -> Result<usize, String> {
    // 尝试使用 rename（同盘符时性能最好）
    match fs::rename(from, to) {
        Ok(_) => {
            // rename 成功，统计文件数量
            let count = count_files_in_dir(to).unwrap_or(0);
            log::debug!(
                "已移动目录(rename): {} -> {} ({} 个文件)",
                from.display(),
                to.display(),
                count
            );
            Ok(count)
        }
        Err(_) => {
            // rename 失败，可能是跨盘符
            log::debug!(
                "rename 失败，使用分步骤复制策略: {} -> {}",
                from.display(),
                to.display()
            );

            // 第一阶段：复制所有文件到目标位置（收集错误但继续）
            let mut copy_errors = Vec::new();
            let copied_count = match copy_dir_with_error_collection(from, to, &mut copy_errors) {
                Ok(count) => count,
                Err(e) => {
                    // 复制过程中出现致命错误
                    return Err(format!(
                        "目录复制失败: {}\n注意: 源目录保持不变，目标目录可能包含部分文件",
                        e
                    ));
                }
            };

            // 检查是否有错误
            if !copy_errors.is_empty() {
                // 有文件复制失败，不删除源目录，也不清理目标目录
                let error_summary = copy_errors.join("\n");
                return Err(format!(
                    "目录复制部分失败（已复制 {} 个文件）：\n{}\n\n注意: 源目录保持不变，目标目录包含部分文件，请解决问题后重试",
                    copied_count, error_summary
                ));
            }

            // 第二阶段：所有文件复制成功，删除源目录
            fs::remove_dir_all(from).map_err(|e| {
                format!(
                    "所有文件已复制到目标位置，但删除源目录失败: {}\n源目录: {}\n目标目录: {}\n请手动删除源目录",
                    e,
                    from.display(),
                    to.display()
                )
            })?;

            log::debug!(
                "已移动目录(copy+remove): {} -> {} ({} 个文件)",
                from.display(),
                to.display(),
                copied_count
            );

            Ok(copied_count)
        }
    }
}

/// 递归复制目录（带错误收集）
///
/// 此函数会尝试复制所有文件，遇到错误时不会立即停止，
/// 而是记录错误并继续处理其他文件。
///
/// # Returns
/// * `Result<usize, String>` - 成功复制的文件数量或致命错误
#[allow(dead_code)]
fn copy_dir_with_error_collection(
    from: &Path,
    to: &Path,
    errors: &mut Vec<String>,
) -> Result<usize, String> {
    let mut copied_count = 0;

    // 确保目标目录存在
    if let Err(e) = fs::create_dir_all(to) {
        return Err(format!("创建目标目录失败: {}", e));
    }

    // 遍历源目录
    let entries = fs::read_dir(from).map_err(|e| format!("读取源目录失败: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                errors.push(format!("读取目录项失败: {}", e));
                continue;
            }
        };

        let entry_path = entry.path();
        let file_name = entry.file_name();
        let target_path = to.join(&file_name);

        if entry_path.is_dir() {
            // 递归复制子目录
            match copy_dir_with_error_collection(&entry_path, &target_path, errors) {
                Ok(count) => copied_count += count,
                Err(e) => {
                    errors.push(format!(
                        "复制子目录 {} 失败: {}",
                        file_name.to_string_lossy(),
                        e
                    ));
                }
            }
        } else {
            // 复制文件
            match fs::copy(&entry_path, &target_path) {
                Ok(_) => {
                    copied_count += 1;
                    log::debug!(
                        "已复制文件: {} -> {}",
                        entry_path.display(),
                        target_path.display()
                    );
                }
                Err(e) => {
                    errors.push(format!(
                        "复制文件 {} 失败: {}",
                        file_name.to_string_lossy(),
                        e
                    ));
                }
            }
        }
    }

    Ok(copied_count)
}

/// 统计目录中的文件数量（递归）
#[allow(dead_code)]
fn count_files_in_dir(dir: &Path) -> Result<usize, String> {
    let mut count = 0;

    if !dir.exists() {
        return Ok(0);
    }

    for entry in fs::read_dir(dir).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let entry_path = entry.path();

        if entry_path.is_dir() {
            count += count_files_in_dir(&entry_path)?;
        } else {
            count += 1;
        }
    }

    Ok(count)
}

#[command]
pub async fn copy_file(src: String, dst: String) -> Result<(), String> {
    let src_path = Path::new(&src);
    let dst_path = Path::new(&dst);

    if !src_path.exists() {
        return Err(format!("源文件不存在: {}", src));
    }

    if let Some(parent) = dst_path.parent()
        && !parent.exists()
    {
        fs::create_dir_all(parent).map_err(|e| format!("无法创建目标目录的父目录: {}", e))?;
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
