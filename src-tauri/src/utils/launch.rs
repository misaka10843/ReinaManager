use crate::utils::game_monitor::monitor_game;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use tauri::{command, AppHandle, Runtime};

#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchResult {
    success: bool,
    message: String,
    process_id: Option<u32>, // 添加进程ID字段
}

/// 启动游戏
///
/// # Arguments
///
/// * `app_handle` - Tauri应用句柄
/// * `game_path` - 游戏可执行文件的路径
/// * `game_id` - 游戏ID (bgm_id 或 vndb_id)
/// * `args` - 可选的游戏启动参数
///
/// # Returns
///
/// 启动结果，包含成功标志、消息和进程ID
#[command]
pub async fn launch_game<R: Runtime>(
    app_handle: AppHandle<R>,
    game_path: String,
    game_id: u32,
    args: Option<Vec<String>>,
) -> Result<LaunchResult, String> {
    // 获取游戏可执行文件的目录
    let game_dir = match Path::new(&game_path).parent() {
        Some(dir) => dir,
        None => return Err("无法获取游戏目录路径".to_string()),
    };

    // 获取游戏可执行文件名
    let exe_name = match Path::new(&game_path).file_name() {
        Some(name) => name,
        None => return Err("无法获取游戏可执行文件名".to_string()),
    };

    // 创建命令，设置工作目录为游戏所在目录
    let mut command = Command::new(&game_path);
    command.current_dir(game_dir);

    if let Some(arguments) = args {
        command.args(arguments);
    }

    match command.spawn() {
        Ok(child) => {
            let process_id = child.id();

            // 启动游戏监控
            monitor_game(app_handle, game_id, process_id, game_path.clone()).await;

            Ok(LaunchResult {
                success: true,
                message: format!(
                    "成功启动游戏: {}，工作目录: {:?}",
                    exe_name.to_string_lossy(),
                    game_dir
                ),
                process_id: Some(process_id),
            })
        }
        Err(e) => Err(format!("启动游戏失败: {}，目录: {:?}", e, game_dir)),
    }
}

#[command]
pub async fn open_directory(dir_path: String) -> Result<(), String> {
    use std::fs;

    // 首先检查路径是否存在
    if !Path::new(&dir_path).exists() {
        // 如果路径不存在，尝试创建它
        if let Err(e) = fs::create_dir_all(&dir_path) {
            return Err(format!("路径不存在且无法创建: {} - {}", dir_path, e));
        }
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
}
