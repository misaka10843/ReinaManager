use super::magpie;
use crate::database::dto::UpdateSettingsData;
use crate::database::repository::games_repository::GamesRepository;
use crate::database::repository::settings_repository::{DbSettingsExt, SettingsRepository};
use crate::entity::tasks;
use crate::game::monitor::{
    TimeTrackingMode, find_game_process, is_game_foreground, monitor_game, stop_game_session,
    wait_for_game_foreground,
};
use crate::game::steam::{
    STEAM_LAUNCH_TASK_TYPE, SteamLaunchTaskPayload, cancel_steam_wait, create_steam_launch_task,
    emit_steam_launch_status, finish_steam_wait, refresh_steam_app_status, register_steam_wait,
    resolve_steam_app, update_steam_launch_task,
};
use crate::utils::command_ext::CommandGuiExt;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter, Runtime, State, command};
use {
    log::{debug, info, warn},
    tokio::time,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchResult {
    success: bool,
    message: String,
    process_id: Option<u32>, // 添加进程ID字段
}

#[derive(Clone, Copy)]
enum ToolPathKind {
    Le,
    Magpie,
}

fn is_steam_download_task_stage(stage: &str) -> bool {
    matches!(
        stage,
        "updating" | "validating" | "preallocating" | "staging" | "committing" | "paused"
    )
}

impl ToolPathKind {
    fn label(self) -> &'static str {
        match self {
            Self::Le => "LE转区软件",
            Self::Magpie => "Magpie软件",
        }
    }

    fn clear_update(self) -> UpdateSettingsData {
        match self {
            Self::Le => UpdateSettingsData {
                le_path: Some(None),
                ..Default::default()
            },
            Self::Magpie => UpdateSettingsData {
                magpie_path: Some(None),
                ..Default::default()
            },
        }
    }
}

/// 停止游戏结果
#[derive(Debug, Serialize, Deserialize)]
pub struct StopResult {
    success: bool,
    message: String,
    terminated_count: u32,
}

// ================= Windows 提权启动（ShellExecuteExW with "runas"）支持 =================
// 仅在 Windows 下编译，其他平台不包含该实现
mod win_elevated_launch {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;

    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::GetProcessId;
    use windows::Win32::UI::Shell::{
        SEE_MASK_FLAG_NO_UI, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW, ShellExecuteExW,
    };
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    use windows::core::PCWSTR;

    fn to_wide_null(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(Some(0)).collect()
    }

    fn needs_quotes(s: &str) -> bool {
        s.chars().any(|c| c.is_whitespace()) || s.contains('"')
    }

    fn quote_arg(arg: &str) -> String {
        if !needs_quotes(arg) {
            return arg.to_string();
        }
        // 简单转义内部引号
        let escaped = arg.replace('"', "\\\"");
        format!("\"{}\"", escaped)
    }

    /// 使用 ShellExecuteExW("runas") 启动进程，并返回进程 PID
    pub fn shell_execute_runas(
        path: &str,
        args: Option<&[String]>,
        work_dir: &Path,
    ) -> Result<u32, String> {
        let params_str = if let Some(a) = args {
            a.iter().map(|s| quote_arg(s)).collect::<Vec<_>>().join(" ")
        } else {
            String::new()
        };

        let w_verb = to_wide_null("runas");
        let w_path = to_wide_null(path);
        let w_params = to_wide_null(&params_str);
        let w_dir = to_wide_null(&work_dir.to_string_lossy());

        let mut sei = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_FLAG_NO_UI,
            hwnd: Default::default(),
            lpVerb: PCWSTR(w_verb.as_ptr()),
            lpFile: PCWSTR(w_path.as_ptr()),
            lpParameters: PCWSTR(w_params.as_ptr()),
            lpDirectory: PCWSTR(w_dir.as_ptr()),
            nShow: SW_SHOWNORMAL.0,
            ..Default::default()
        };

        unsafe { ShellExecuteExW(&mut sei) }
            .map_err(|e| format!("ShellExecuteExW(runAs) failed: {}", e))?;

        // 获取 PID 并关闭句柄以避免句柄泄漏
        let pid = unsafe { GetProcessId(sei.hProcess) };
        unsafe {
            let _ = CloseHandle(sei.hProcess);
        } // 忽略关闭错误

        if pid == 0 {
            return Err("Failed to obtain elevated process id".to_string());
        }
        Ok(pid)
    }
}

async fn clear_tool_path_setting(
    db: &DatabaseConnection,
    tool_kind: ToolPathKind,
) -> Result<(), String> {
    SettingsRepository::update_settings(db, tool_kind.clear_update())
        .await
        .map_err(|e| format!("清空{}路径失败: {}", tool_kind.label(), e))
}

async fn resolve_tool_path(
    db: &DatabaseConnection,
    path: Option<&str>,
    tool_kind: ToolPathKind,
) -> Result<String, String> {
    let Some(path) = path.filter(|value| !value.trim().is_empty()) else {
        return Err(format!("{}路径未设置，请先配置路径", tool_kind.label()));
    };

    let tool_path = Path::new(path);
    let invalid_reason = if !tool_path.exists() {
        Some("不存在")
    } else if !tool_path.is_file() {
        Some("不是文件")
    } else {
        None
    };

    if let Some(reason) = invalid_reason {
        clear_tool_path_setting(db, tool_kind).await?;
        return Err(format!(
            "{}路径{}，已清空配置，请重新设置: {}",
            tool_kind.label(),
            reason,
            path
        ));
    }

    Ok(path.to_string())
}

/// 启动游戏
///
/// # Arguments
///
/// * `app_handle` - Tauri应用句柄
/// * `game_id` - 游戏ID (数据库记录ID)
/// * `args` - 可选的游戏启动参数
///
/// # Returns
///
/// 启动结果，包含成功标志、消息和进程ID
#[command]
pub async fn launch_game<R: Runtime>(
    app_handle: AppHandle<R>,
    db: State<'_, DatabaseConnection>,
    game_id: u32,
    args: Option<Vec<String>>,
    time_tracking_mode: TimeTrackingMode,
) -> Result<LaunchResult, String> {
    let game = GamesRepository::find_by_id(db.inner(), game_id as i32)
        .await
        .map_err(|e| format!("查询游戏失败: {}", e))?
        .ok_or_else(|| format!("游戏不存在: {}", game_id))?;

    if game.launch_type == "steam" {
        let steam_app_id = game
            .steam_app_id
            .and_then(|value| u32::try_from(value).ok())
            .ok_or_else(|| "Steam AppID 未设置或无效".to_string())?;
        let (steam_game, steam_executable) = resolve_steam_app(db.inner(), steam_app_id).await?;
        let game_dir = steam_game.install_path.clone();
        if !game_dir.is_dir() {
            return Err(format!("Steam 游戏安装目录不存在: {}", game_dir.display()));
        }

        let magpie_path = if game.magpie.unwrap_or(0) == 1 {
            let settings = db.inner().get_settings().await?;
            Some(
                resolve_tool_path(
                    db.inner(),
                    settings.magpie_path_value(),
                    ToolPathKind::Magpie,
                )
                .await?,
            )
        } else {
            None
        };
        let mode_name = match time_tracking_mode {
            TimeTrackingMode::Playtime => "playtime",
            TimeTrackingMode::Elapsed => "elapsed",
        };
        let task_title = steam_game.name.clone();

        let mut command = Command::new(&steam_executable);
        command.arg("-applaunch").arg(steam_app_id.to_string());
        if let Some(arguments) = &args {
            command.args(arguments);
        }
        if let Err(error) = command.gui_safe().spawn() {
            let error_message = error.to_string();
            let _ =
                emit_steam_launch_status(&app_handle, game_id, "failed", "failed", 0, None, None);
            return Err(format!("启动 Steam 应用失败: {error_message}"));
        }

        let signal = register_steam_wait(game_id);
        let app = app_handle.clone();
        let connection = db.inner().clone();
        let process_path = game.steam_process_path.clone();
        let detection_dir_path = steam_game.install_path.clone();
        let detection_dir = detection_dir_path.to_string_lossy().to_string();
        let manifest_path = steam_game.manifest_path.clone();
        tokio::spawn(async move {
            let mut last_stage = String::new();
            let mut task: Option<tasks::Model> = None;
            loop {
                if signal.load(std::sync::atomic::Ordering::Acquire) {
                    if let Some(task) = task.as_ref() {
                        let _ = update_steam_launch_task(
                            &app,
                            &connection,
                            task.id,
                            game_id,
                            "cancelled",
                            "cancelled",
                            0,
                            None,
                            None,
                        )
                        .await;
                    } else {
                        let _ = emit_steam_launch_status(
                            &app,
                            game_id,
                            "cancelled",
                            "cancelled",
                            0,
                            None,
                            None,
                        );
                    }
                    finish_steam_wait(game_id);
                    return;
                }

                match refresh_steam_app_status(&manifest_path) {
                    Ok(current_status) => {
                        let stage = if current_status.stage == "ready" {
                            "waiting_for_process"
                        } else {
                            current_status.stage.as_str()
                        };
                        if last_stage != stage || current_status.progress_total.is_some() {
                            let task_status = if stage == "paused" {
                                "paused"
                            } else {
                                "running"
                            };
                            let (progress_current, progress_total) =
                                if stage == "waiting_for_process" {
                                    (0, None)
                                } else {
                                    (
                                        current_status.progress_current,
                                        current_status.progress_total,
                                    )
                                };
                            if is_steam_download_task_stage(stage) {
                                if task.is_none() {
                                    match create_steam_launch_task(
                                        &connection,
                                        &task_title,
                                        game_id,
                                        steam_app_id,
                                        mode_name,
                                    )
                                    .await
                                    {
                                        Ok(created) => task = Some(created),
                                        Err(error) => {
                                            warn!(
                                                "创建 Steam 更新任务失败 game_id={} app_id={}: {}",
                                                game_id, steam_app_id, error
                                            );
                                        }
                                    }
                                }
                                if let Some(task) = task.as_ref() {
                                    let _ = update_steam_launch_task(
                                        &app,
                                        &connection,
                                        task.id,
                                        game_id,
                                        task_status,
                                        stage,
                                        progress_current,
                                        progress_total,
                                        None,
                                    )
                                    .await;
                                } else {
                                    let _ = emit_steam_launch_status(
                                        &app,
                                        game_id,
                                        task_status,
                                        stage,
                                        progress_current,
                                        progress_total,
                                        None,
                                    );
                                }
                            } else {
                                if let Some(task) = task.take() {
                                    let _ = update_steam_launch_task(
                                        &app,
                                        &connection,
                                        task.id,
                                        game_id,
                                        "completed",
                                        "completed",
                                        1,
                                        Some(1),
                                        None,
                                    )
                                    .await;
                                }
                                let _ = emit_steam_launch_status(
                                    &app,
                                    game_id,
                                    task_status,
                                    stage,
                                    progress_current,
                                    progress_total,
                                    None,
                                );
                            }
                            last_stage = stage.to_string();
                        }

                        if stage == "waiting_for_process"
                            && let Some((pid, executable_path)) =
                                find_game_process(&detection_dir, process_path.as_deref())
                        {
                            info!(
                                "Steam 游戏进程已确认 game_id={} app_id={} pid={} executable={}",
                                game_id,
                                steam_app_id,
                                pid,
                                executable_path.display()
                            );
                            if let Some(task) = task.take() {
                                let _ = update_steam_launch_task(
                                    &app,
                                    &connection,
                                    task.id,
                                    game_id,
                                    "completed",
                                    "completed",
                                    1,
                                    Some(1),
                                    None,
                                )
                                .await;
                            }
                            if process_path.is_none()
                                && let Ok(relative) =
                                    executable_path.strip_prefix(&detection_dir_path)
                            {
                                let relative = relative.to_string_lossy().replace('\\', "/");
                                let _ = app.emit(
                                    "steam-process-detected",
                                    serde_json::json!({
                                        "gameId": game_id,
                                        "processPath": relative,
                                    }),
                                );
                            }
                            finish_steam_wait(game_id);
                            monitor_game(
                                app.clone(),
                                connection.clone(),
                                time_tracking_mode,
                                game_id,
                                pid,
                                detection_dir.clone(),
                            )
                            .await;
                            if let Some(magpie_path) = magpie_path {
                                tokio::spawn(async move {
                                    if let Err(error) =
                                        start_magpie_for_game(game_id, &magpie_path).await
                                    {
                                        warn!(
                                            "启动 Magpie 全屏缩放失败 game_id={}: {}",
                                            game_id, error
                                        );
                                    }
                                });
                            }
                            return;
                        }
                    }
                    Err(error) => {
                        if let Some(task) = task.as_ref() {
                            let _ = update_steam_launch_task(
                                &app,
                                &connection,
                                task.id,
                                game_id,
                                "failed",
                                "failed",
                                0,
                                None,
                                Some(("steam_state_unavailable", &error)),
                            )
                            .await;
                        } else {
                            let _ = emit_steam_launch_status(
                                &app, game_id, "failed", "failed", 0, None, None,
                            );
                        }
                        finish_steam_wait(game_id);
                        return;
                    }
                }
                tokio::time::sleep(time::Duration::from_secs(2)).await;
            }
        });

        return Ok(LaunchResult {
            success: true,
            message: format!("已交由 Steam 启动: {}", steam_game.name),
            process_id: None,
        });
    }
    let game_dir = PathBuf::from(
        game.localpath
            .as_deref()
            .ok_or_else(|| "游戏目录未设置".to_string())?,
    );
    let executable_path = game_dir.join(
        game.executable
            .as_deref()
            .ok_or_else(|| "游戏启动文件未设置".to_string())?,
    );
    let game_path = executable_path.to_string_lossy().to_string();

    let use_le = game.le_launch.unwrap_or(0) == 1;
    let use_magpie = game.magpie.unwrap_or(0) == 1;

    let settings = if use_le || use_magpie {
        Some(db.inner().get_settings().await?)
    } else {
        None
    };
    let le_path = if use_le {
        Some(
            resolve_tool_path(
                db.inner(),
                settings.as_ref().and_then(|s| s.le_path_value()),
                ToolPathKind::Le,
            )
            .await?,
        )
    } else {
        None
    };

    let magpie_path = if use_magpie {
        Some(
            resolve_tool_path(
                db.inner(),
                settings.as_ref().and_then(|s| s.magpie_path_value()),
                ToolPathKind::Magpie,
            )
            .await?,
        )
    } else {
        None
    };

    // 获取游戏可执行文件名
    let exe_name = match executable_path.file_name() {
        Some(name) => name,
        None => return Err("无法获取游戏可执行文件名".to_string()),
    };

    // 根据启动选项决定启动方式
    let mut command = if use_le {
        let le_path = le_path
            .as_deref()
            .ok_or_else(|| "LE转区软件路径未设置，请先配置路径".to_string())?;
        let mut cmd = Command::new(le_path);
        cmd.current_dir(&game_dir);
        cmd.arg(&game_path);
        cmd
    } else {
        // 普通启动
        let mut cmd = Command::new(&game_path);
        cmd.current_dir(&game_dir);
        cmd
    };

    // 克隆一份参数用于普通启动与可能的提权回退
    let args_clone = args.clone();
    if let Some(arguments) = &args_clone {
        command.args(arguments);
    }

    debug!(
        "准备启动游戏 game_id={} mode={} magpie={} arg_count={} cwd={}",
        game_id,
        if use_le { "le" } else { "normal" },
        use_magpie,
        args_clone.as_ref().map_or(0, Vec::len),
        game_dir.display()
    );

    match command.gui_safe().spawn() {
        Ok(child) => {
            let detection_dir_str = game_dir.to_string_lossy().to_string();
            let process_id = child.id();
            info!(
                "游戏启动成功 game_id={} pid={} mode={} magpie={}",
                game_id,
                process_id,
                if use_le { "le" } else { "normal" },
                use_magpie
            );

            // 启动游戏监控
            monitor_game(
                app_handle.clone(),
                db.inner().clone(),
                time_tracking_mode,
                game_id,
                process_id,
                detection_dir_str.clone(),
            )
            .await;

            // 如果需要Magpie放大，在后台启动
            if let Some(magpie_path) = magpie_path.clone() {
                tokio::spawn(async move {
                    if let Err(e) = start_magpie_for_game(game_id, &magpie_path).await {
                        warn!("启动 Magpie 全屏缩放失败 game_id={}: {}", game_id, e);
                    }
                });
            }

            Ok(LaunchResult {
                success: true,
                message: format!(
                    "成功启动游戏: {}，工作目录: {:?}{}",
                    exe_name.to_string_lossy(),
                    game_dir,
                    if use_le { " (LE转区)" } else { "" }
                ),
                process_id: Some(process_id),
            })
        }
        Err(e) => {
            // 如果为 Windows 的 740 错误（需要提升权限），尝试使用 ShellExecuteExW("runas") 再启动
            let needs_elevation = e.raw_os_error() == Some(740);
            if needs_elevation {
                warn!(
                    "普通启动需要提权，准备回退到管理员启动 game_id={}: {}",
                    game_id, e
                );
                // 对于LE启动，需要用LE路径作为执行文件，游戏路径作为参数
                let (exec_path, exec_args) = if use_le {
                    let mut args = vec![game_path.clone()];
                    if let Some(additional_args) = &args_clone {
                        args.extend(additional_args.clone());
                    }

                    (
                        le_path
                            .clone()
                            .ok_or_else(|| "LE转区软件路径未设置，请先配置路径".to_string())?,
                        Some(args),
                    )
                } else {
                    (game_path.clone(), args_clone)
                };
                match win_elevated_launch::shell_execute_runas(
                    &exec_path,
                    exec_args.as_deref(),
                    &game_dir,
                ) {
                    Ok(pid) => {
                        let detection_dir_str = game_dir.to_string_lossy().to_string();
                        info!(
                            "游戏提权启动成功 game_id={} pid={} mode={} magpie={}",
                            game_id,
                            pid,
                            if use_le { "le" } else { "normal" },
                            use_magpie
                        );
                        // 提权启动成功，继续进入监控
                        monitor_game(
                            app_handle.clone(),
                            db.inner().clone(),
                            time_tracking_mode,
                            game_id,
                            pid,
                            detection_dir_str,
                        )
                        .await;

                        // 如果需要Magpie放大，在后台启动
                        if let Some(magpie_path) = magpie_path.clone() {
                            tokio::spawn(async move {
                                if let Err(e) = start_magpie_for_game(game_id, &magpie_path).await {
                                    warn!("启动 Magpie 全屏缩放失败 game_id={}: {}", game_id, e);
                                }
                            });
                        }

                        Ok(LaunchResult {
                            success: true,
                            message: format!(
                                "已使用管理员权限启动游戏: {}{}，工作目录: {:?}",
                                exe_name.to_string_lossy(),
                                if use_le { " (LE转区)" } else { "" },
                                game_dir
                            ),
                            process_id: Some(pid),
                        })
                    }
                    Err(err2) => Err(format!("普通启动失败且提权启动失败: {} | {}", e, err2)),
                }
            } else {
                Err(format!("启动游戏失败: {}，目录: {:?}", e, game_dir))
            }
        }
    }
}

/// 停止游戏
///
/// # Arguments
///
/// * `game_id` - 游戏ID (bgm_id 或 vndb_id)
///
/// # Returns
///
/// 停止结果，包含成功标志、消息和终止的进程数量
#[command]
pub async fn stop_game(game_id: u32) -> Result<StopResult, String> {
    if cancel_steam_wait(game_id) {
        return Ok(StopResult {
            success: true,
            message: format!("已停止等待 Steam 游戏 {}，Steam 下载不会被终止", game_id),
            terminated_count: 0,
        });
    }
    match stop_game_session(game_id).await {
        Ok(terminated_count) => Ok(StopResult {
            success: true,
            message: format!(
                "已成功停止游戏 {}, 终止了 {} 个进程",
                game_id, terminated_count
            ),
            terminated_count,
        }),
        Err(e) => Err(format!("停止游戏失败: {}", e)),
    }
}

/// Reconcile Steam launch observers after an application restart. Steam owns the
/// download and launch operation, so ReinaManager only restores observation.
pub fn resume_steam_launch_tasks<R: Runtime>(app_handle: &AppHandle<R>, db: &DatabaseConnection) {
    let app = app_handle.clone();
    let connection = db.clone();
    tauri::async_runtime::spawn(async move {
        let active_tasks = match tasks::Entity::find()
            .filter(tasks::Column::TaskType.eq(STEAM_LAUNCH_TASK_TYPE))
            .filter(tasks::Column::Status.is_in(["running", "paused"]))
            .all(&connection)
            .await
        {
            Ok(tasks) => tasks,
            Err(error) => {
                warn!("读取待恢复 Steam 任务失败: {error}");
                return;
            }
        };

        for task in active_tasks {
            let payload =
                match serde_json::from_value::<SteamLaunchTaskPayload>(task.payload_json.clone()) {
                    Ok(payload) if payload.version == 1 => payload,
                    Ok(_) => {
                        let _ = update_steam_launch_task(
                            &app,
                            &connection,
                            task.id,
                            0,
                            "failed",
                            "failed",
                            0,
                            None,
                            Some(("unsupported_payload", "Steam 任务版本不受支持")),
                        )
                        .await;
                        continue;
                    }
                    Err(error) => {
                        warn!("解析 Steam 任务 {} 失败: {error}", task.id);
                        continue;
                    }
                };
            let game = match GamesRepository::find_by_id(&connection, payload.game_id as i32).await
            {
                Ok(Some(game)) => game,
                _ => {
                    let _ = update_steam_launch_task(
                        &app,
                        &connection,
                        task.id,
                        payload.game_id,
                        "failed",
                        "failed",
                        0,
                        None,
                        Some(("game_missing", "Steam 任务对应的游戏不存在")),
                    )
                    .await;
                    continue;
                }
            };
            let (steam_game, _) = match resolve_steam_app(&connection, payload.steam_app_id).await {
                Ok(value) => value,
                Err(error) => {
                    let _ = update_steam_launch_task(
                        &app,
                        &connection,
                        task.id,
                        payload.game_id,
                        "failed",
                        "failed",
                        0,
                        None,
                        Some(("steam_state_unavailable", &error)),
                    )
                    .await;
                    continue;
                }
            };
            let time_tracking_mode = if payload.time_tracking_mode == "elapsed" {
                TimeTrackingMode::Elapsed
            } else {
                TimeTrackingMode::Playtime
            };
            let signal = register_steam_wait(payload.game_id);
            let app = app.clone();
            let connection = connection.clone();
            let detection_dir_path = steam_game.install_path.clone();
            let detection_dir = detection_dir_path.to_string_lossy().to_string();
            let manifest_path = steam_game.manifest_path.clone();
            let process_path = game.steam_process_path;
            tauri::async_runtime::spawn(async move {
                loop {
                    if signal.load(std::sync::atomic::Ordering::Acquire) {
                        let _ = update_steam_launch_task(
                            &app,
                            &connection,
                            task.id,
                            payload.game_id,
                            "cancelled",
                            "cancelled",
                            0,
                            None,
                            None,
                        )
                        .await;
                        finish_steam_wait(payload.game_id);
                        return;
                    }
                    match refresh_steam_app_status(&manifest_path) {
                        Ok(current_status) => {
                            let stage = if current_status.stage == "ready" {
                                "waiting_for_process"
                            } else {
                                current_status.stage.as_str()
                            };
                            let status = if stage == "paused" {
                                "paused"
                            } else {
                                "running"
                            };
                            let (progress_current, progress_total) =
                                if stage == "waiting_for_process" {
                                    (0, None)
                                } else {
                                    (
                                        current_status.progress_current,
                                        current_status.progress_total,
                                    )
                                };
                            let _ = update_steam_launch_task(
                                &app,
                                &connection,
                                task.id,
                                payload.game_id,
                                status,
                                stage,
                                progress_current,
                                progress_total,
                                None,
                            )
                            .await;
                            if stage == "waiting_for_process"
                                && let Some((pid, executable_path)) =
                                    find_game_process(&detection_dir, process_path.as_deref())
                            {
                                let _ = update_steam_launch_task(
                                    &app,
                                    &connection,
                                    task.id,
                                    payload.game_id,
                                    "completed",
                                    "running",
                                    1,
                                    Some(1),
                                    None,
                                )
                                .await;
                                if process_path.is_none()
                                    && let Ok(relative) =
                                        executable_path.strip_prefix(&detection_dir_path)
                                {
                                    let relative = relative.to_string_lossy().replace('\\', "/");
                                    let _ = app.emit(
                                        "steam-process-detected",
                                        serde_json::json!({
                                            "gameId": payload.game_id,
                                            "processPath": relative,
                                        }),
                                    );
                                }
                                finish_steam_wait(payload.game_id);
                                monitor_game(
                                    app,
                                    connection,
                                    time_tracking_mode,
                                    payload.game_id,
                                    pid,
                                    detection_dir,
                                )
                                .await;
                                return;
                            }
                        }
                        Err(error) => {
                            let _ = update_steam_launch_task(
                                &app,
                                &connection,
                                task.id,
                                payload.game_id,
                                "failed",
                                "failed",
                                0,
                                None,
                                Some(("steam_state_unavailable", &error)),
                            )
                            .await;
                            finish_steam_wait(payload.game_id);
                            return;
                        }
                    }
                    tokio::time::sleep(time::Duration::from_secs(2)).await;
                }
            });
        }
    });
}

/// 为游戏启动Magpie放大
async fn start_magpie_for_game(game_id: u32, magpie_path: &str) -> Result<(), String> {
    let was_running = magpie::ensure_running(magpie_path)?;
    debug!(
        "Magpie 状态 game_id={} was_running={}",
        game_id, was_running
    );

    magpie::wait_until_ready(time::Duration::from_secs(5)).await?;

    if !wait_for_game_foreground(game_id).await {
        info!("游戏 {} 未进入前台，取消 Magpie 全屏缩放", game_id);
        return Ok(());
    }

    debug!("游戏 {} 已进入前台", game_id);
    debug!("游戏 {} 将在固定 2 秒后触发 Magpie 全屏缩放", game_id);
    time::sleep(time::Duration::from_secs(2)).await;

    let game_is_foreground = is_game_foreground(game_id);
    debug!(
        "Magpie 延迟结束 game_id={} game_foreground={}",
        game_id, game_is_foreground
    );
    if !game_is_foreground {
        info!("游戏 {} 在 Magpie 延迟期间离开前台，取消全屏缩放", game_id);
        return Ok(());
    }

    magpie::trigger_fullscreen_scaling()?;

    info!("已触发 Magpie 全屏缩放 game_id={}", game_id);
    Ok(())
}
