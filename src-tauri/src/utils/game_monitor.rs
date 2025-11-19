use log::{debug, error, info, warn};
use serde_json::json;
use std::{
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
// 导入 sysinfo 相关类型和 trait
use sysinfo::{ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::time::{interval, MissedTickBehavior};

// 监控配置常量
/// 连续失败次数阈值，超过此值认为进程已结束
const MAX_CONSECUTIVE_FAILURES: u32 = 3;
/// 时间更新事件发送间隔（秒）
const TIME_UPDATE_INTERVAL_SECS: u64 = 1;
/// 监控循环检查间隔（秒）
const MONITOR_CHECK_INTERVAL_SECS: u64 = 1;

#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::CloseHandle,
    System::Threading::{
        GetExitCodeProcess,
        OpenProcess,
        // 使用 PROCESS_QUERY_LIMITED_INFORMATION 替代之前的权限组合，
        // 这是获取进程退出代码所需的最小权限，有助于提高在权限受限场景下的稳健性 (源自 deep research 报告建议)。
        PROCESS_QUERY_LIMITED_INFORMATION,
        // PROCESS_VM_READ 权限不再需要，已移除。
    },
};

/// 获取当前的 Unix 时间戳 (秒)。
///
/// # Returns
/// 返回当前时间的 Unix 时间戳（秒）。
///
/// # Panics
/// 如果系统时间早于 UNIX_EPOCH（1970-01-01 00:00:00 UTC），会 panic。
fn get_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("系统时间错误: 时间回溯")
        .as_secs()
}

/// 获取当前所有候选的游戏进程 PID 列表。
///
/// 从游戏目录下扫描所有进程，自动过滤掉管理器自身。
///
/// # Arguments
/// * `executable_path` - 游戏可执行文件路径
/// * `sys` - System 实例的可变引用
///
/// # Returns
/// 返回所有候选 PID 的列表，如果没有找到则返回空列表
fn get_all_candidate_pids(executable_path: &str, sys: &mut System) -> Vec<u32> {
    let manager_pid = std::process::id();

    // 扫描游戏目录下的所有进程，并过滤掉管理器自身
    let candidate_pids: Vec<u32> = get_process_id_by_path(executable_path, sys)
        .into_iter()
        .filter(|&pid| pid != manager_pid)
        .collect();

    if candidate_pids.is_empty() {
        debug!(
            "未通过路径 '{}' 找到匹配的进程（已排除管理器）",
            executable_path
        );
    } else {
        debug!(
            "找到 {} 个候选进程: {:?}",
            candidate_pids.len(),
            candidate_pids
        );
    }

    candidate_pids
}

/// 从候选 PID 列表中选择最佳的进程。
///
/// 优先级：前台聚焦进程 > 有可见窗口的进程 > 列表第一个进程
///
/// # Arguments
/// * `candidate_pids` - 候选 PID 列表
///
/// # Returns
/// 返回最佳 PID，如果列表为空则返回 None
#[cfg(target_os = "windows")]
fn select_best_from_candidates(candidate_pids: &[u32]) -> Option<u32> {
    if candidate_pids.is_empty() {
        return None;
    }

    use std::collections::HashSet;
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetForegroundWindow, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
    };

    // 将候选 PID 转为 HashSet 以便快速查找
    let candidate_set: HashSet<u32> = candidate_pids.iter().copied().collect();

    // 获取前台窗口的 PID
    unsafe {
        let foreground_window: HWND = GetForegroundWindow();
        if !foreground_window.0.is_null() {
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(foreground_window, Some(&mut pid));
            if candidate_set.contains(&pid)
                && IsWindowVisible(foreground_window).as_bool()
                && !IsIconic(foreground_window).as_bool()
            {
                info!("从候选列表中找到聚焦进程 PID: {}", pid);
                return Some(pid);
            }
        }
    }

    // 如果前台窗口不属于候选进程，则遍历所有窗口寻找有窗口的候选进程
    // 这里只调用一次 EnumWindows，在回调中检查所有候选 PID
    // 注意：虽然编译器会警告 mut 不必要，但我们确实通过 unsafe 指针在回调中修改它
    #[allow(unused_mut)]
    let mut pids_with_windows: Vec<u32> = Vec::new();

    unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            // lparam 包含两个指针：候选集合和结果向量
            let data = lparam.0 as *mut (HashSet<u32>, Vec<u32>);
            let (candidate_set, pids_with_windows) = &mut *data;

            let mut window_pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut window_pid));

            // 检查窗口是否属于候选 PID 且可见
            if candidate_set.contains(&window_pid) && IsWindowVisible(hwnd).as_bool() {
                // 避免重复添加
                if !pids_with_windows.contains(&window_pid) {
                    pids_with_windows.push(window_pid);
                }
            }
        }
        BOOL::from(true) // 继续枚举
    }

    let mut enum_data = (candidate_set, pids_with_windows);
    let lparam = LPARAM(&mut enum_data as *mut _ as isize);
    unsafe { EnumWindows(Some(enum_windows_callback), lparam) }.ok();

    // 返回第一个有窗口的进程
    if let Some(&pid) = enum_data.1.first() {
        info!("从候选列表中找到有窗口的进程 PID: {}", pid);
        return Some(pid);
    }

    // 如果都没有窗口，返回第一个候选 PID
    let first_pid = candidate_pids[0];
    info!("使用候选列表中的第一个进程 PID: {}", first_pid);
    Some(first_pid)
}

#[cfg(not(target_os = "windows"))]
fn select_best_from_candidates(candidate_pids: &[u32]) -> Option<u32> {
    candidate_pids.first().copied()
}

/// 完成游戏监控会话并发送结束事件。
///
/// # Arguments
/// * `app_handle` - Tauri 应用句柄
/// * `game_id` - 游戏 ID
/// * `process_id` - 最终的进程 PID
/// * `start_time` - 会话开始时间戳
/// * `accumulated_seconds` - 累计的活动时间（秒）
///
/// # Returns
/// 返回 `Ok(())` 如果成功发送事件，否则返回错误信息
fn finalize_session<R: Runtime>(
    app_handle: &AppHandle<R>,
    game_id: u32,
    process_id: u32,
    start_time: u64,
    accumulated_seconds: u64,
) -> Result<(), String> {
    let end_time = get_timestamp();
    let total_minutes = accumulated_seconds / 60;
    let remainder_seconds = accumulated_seconds % 60;

    // 将秒数四舍五入到最接近的分钟数
    let final_minutes = if remainder_seconds >= 30 {
        total_minutes + 1
    } else {
        total_minutes
    };

    info!(
        "游戏会话结束: ID={}, 最终 PID={}, 总活动时间={}秒 (计为 {} 分钟)",
        game_id, process_id, accumulated_seconds, final_minutes
    );

    // 发送会话结束事件到前端
    app_handle
        .emit(
            "game-session-ended",
            json!({
                "gameId": game_id,
                "startTime": start_time,
                "endTime": end_time,
                "totalMinutes": final_minutes,
                "totalSeconds": accumulated_seconds,
                "processId": process_id
            }),
        )
        .map_err(|e| format!("无法发送 game-session-ended 事件: {}", e))
}

/// 启动指定游戏进程的监控。
///
/// # Arguments
/// * `app_handle` - Tauri 应用句柄，用于发送事件到前端。
/// * `game_id` - 游戏的唯一标识符。
/// * `process_id` - 要开始监控的游戏进程的初始 PID。
/// * `executable_path` - 游戏主可执行文件的完整路径，用于在进程重启或切换后重新查找。
pub async fn monitor_game<R: Runtime>(
    app_handle: AppHandle<R>,
    game_id: u32,
    process_id: u32,
    executable_path: String,
) {
    // 使用 Tauri 的异步运行时启动监控任务，与事件循环深度集成
    let app_handle_clone = app_handle.clone();
    // 优化：在监控任务启动前创建 System 实例，避免在循环中重复创建。
    // 使用 System::new() 可避免首次加载所有系统信息，按需刷新。
    let mut sys = System::new();

    tauri::async_runtime::spawn(async move {
        // 将 System 实例的可变引用传递给实际的监控循环
        if let Err(e) = run_game_monitor(
            app_handle_clone,
            game_id,
            process_id,
            executable_path,
            &mut sys,
        )
        .await
        {
            error!("游戏监控任务 (game_id: {}) 出错: {}", game_id, e);
        }
    });
}

/// 实际执行游戏监控的核心循环。
///
/// 策略：平时追踪「最佳 PID」，失活时触发目录扫描获取所有候选 PID，
/// 前台判定时检查所有候选 PID（容错性强）。
///
/// # Arguments
/// * `app_handle` - Tauri 应用句柄。
/// * `game_id` - 游戏 ID。
/// * `initial_pid` - 初始监控的进程 PID。
/// * `executable_path` - 游戏主可执行文件路径。
/// * `sys` - 对 `sysinfo::System` 的可变引用，用于进程信息查询。
async fn run_game_monitor<R: Runtime>(
    app_handle: AppHandle<R>,
    game_id: u32,
    initial_pid: u32,
    executable_path: String,
    sys: &mut System,
) -> Result<(), String> {
    let mut accumulated_seconds = 0u64;
    let start_time = get_timestamp();

    // 初始扫描：获取所有候选 PID
    let mut candidate_pids = get_all_candidate_pids(&executable_path, sys);

    // 如果初始 PID 不在候选列表中，手动添加（容错）
    if !candidate_pids.contains(&initial_pid) && is_process_running(initial_pid) {
        candidate_pids.push(initial_pid);
    }

    // 从候选中选择最佳 PID 作为主监控对象
    let mut best_pid = select_best_from_candidates(&candidate_pids).unwrap_or(initial_pid);

    info!(
        "开始监控游戏: ID={}, 最佳 PID={}, 候选进程组={:?}, Path={}",
        game_id, best_pid, candidate_pids, executable_path
    );

    // 通知前端会话开始
    app_handle
        .emit(
            "game-session-started",
            json!({ "gameId": game_id, "processId": best_pid, "startTime": start_time }),
        )
        .map_err(|e| format!("无法发送 game-session-started 事件: {}", e))?;

    let mut consecutive_failures = 0u32;

    // 等待 3 秒让游戏进程充分启动（例如 Launcher -> Game 的切换）
    info!("等待 3 秒以便游戏进程充分启动...");
    tokio::time::sleep(Duration::from_secs(3)).await;

    // 等待后重新扫描，获取最新的进程状态
    candidate_pids = get_all_candidate_pids(&executable_path, sys);
    if let Some(new_best) = select_best_from_candidates(&candidate_pids) {
        if new_best != best_pid {
            info!(
                "等待期间发现更优进程，切换 PID: {} -> {}",
                best_pid, new_best
            );
            best_pid = new_best;
        }
    }

    // 创建精确的 1 秒间隔定时器
    let mut tick_interval = interval(Duration::from_secs(MONITOR_CHECK_INTERVAL_SECS));
    tick_interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    loop {
        tick_interval.tick().await;

        // 1. 检查最佳 PID 是否还活着
        let best_pid_running = is_process_running(best_pid);

        if !best_pid_running {
            consecutive_failures += 1;
            debug!(
                "最佳进程 {} 检查失败次数: {}/{}",
                best_pid, consecutive_failures, MAX_CONSECUTIVE_FAILURES
            );

            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES {
                warn!("最佳进程 {} 已失活，触发重新扫描", best_pid);

                // 触发目录扫描，获取最新的候选 PID 列表
                candidate_pids = get_all_candidate_pids(&executable_path, sys);

                // 从新的候选列表中选择最佳 PID
                if let Some(new_best_pid) = select_best_from_candidates(&candidate_pids) {
                    info!("成功切换到新的最佳进程 PID: {}", new_best_pid);
                    best_pid = new_best_pid;
                    consecutive_failures = 0;

                    // 通知前端 PID 发生变化
                    app_handle
                        .emit(
                            "game-process-switched",
                            json!({ "gameId": game_id, "newProcessId": new_best_pid }),
                        )
                        .ok();
                    continue;
                }

                // 没有找到可用的进程，结束监控
                info!("未找到可切换的活动进程，结束监控会话");
                break;
            }
        } else {
            // 最佳 PID 仍在运行，重置失败计数
            consecutive_failures = 0;

            // 2. 清理候选列表中已失活的 PID（轻量级维护）
            candidate_pids.retain(|&pid| is_process_running(pid));

            // 3. 前台判定：检查候选列表中是否有任何进程在前台
            //    这是关键优化点 - 即使最佳 PID 不在前台，其他候选 PID 在前台也算数
            if let Some(foreground_pid) = check_any_foreground(&candidate_pids) {
                accumulated_seconds += 1;

                // 如果前台进程不是当前的最佳 PID，考虑切换
                // （可选优化：前台进程更可能是用户真正在用的）
                if foreground_pid != best_pid {
                    debug!(
                        "前台进程 {} 不是最佳 PID {}，考虑调整",
                        foreground_pid, best_pid
                    );
                    best_pid = foreground_pid;
                }

                // 发送时间更新
                if accumulated_seconds > 0
                    && accumulated_seconds.is_multiple_of(TIME_UPDATE_INTERVAL_SECS)
                {
                    let minutes = accumulated_seconds / 60;
                    // debug!(
                    //     "发送时间更新事件: {} 分钟 ({} 秒)",
                    //     minutes, accumulated_seconds
                    // );
                    app_handle
                        .emit(
                            "game-time-update",
                            json!({
                                "gameId": game_id,
                                "totalMinutes": minutes,
                                "totalSeconds": accumulated_seconds,
                                "startTime": start_time,
                                "currentTime": get_timestamp(),
                                "processId": best_pid
                            }),
                        )
                        .map_err(|e| format!("无法发送 game-time-update 事件: {}", e))?;
                }
            }
        }
    }

    finalize_session(
        &app_handle,
        game_id,
        best_pid,
        start_time,
        accumulated_seconds,
    )
}

/// 检查指定 PID 的进程是否仍在运行 (Windows 平台)。
///
/// 使用 Windows API 的 `OpenProcess` 和 `GetExitCodeProcess` 来检查进程状态。
/// 使用最小权限 `PROCESS_QUERY_LIMITED_INFORMATION` 以提高兼容性。
///
/// # Arguments
/// * `pid` - 要检查的进程 PID。
///
/// # Returns
/// 如果进程仍在运行（退出码为 STILL_ACTIVE = 259），返回 `true`，否则返回 `false`。
#[cfg(target_os = "windows")]
fn is_process_running(pid: u32) -> bool {
    unsafe {
        // 使用 PROCESS_QUERY_LIMITED_INFORMATION 作为请求权限，
        // 这是调用 GetExitCodeProcess 所需的最小权限集，减少因权限不足导致失败的可能性。
        let handle_result = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);

        if let Ok(handle) = handle_result {
            // 理论上 OpenProcess 成功后句柄应有效，但仍检查 is_invalid 以防万一。
            if handle.is_invalid() {
                return false;
            }
            let mut exit_code: u32 = 0;
            // 尝试获取进程的退出码。
            let success = GetExitCodeProcess(handle, &mut exit_code).is_ok();
            // 无论如何都要确保关闭句柄。
            CloseHandle(handle).ok();
            // 如果成功获取了退出码，并且退出码是 STILL_ACTIVE (值为 259)，则表示进程仍在运行。
            success && exit_code == 259
        } else {
            // OpenProcess 调用失败，通常意味着进程不存在或无权访问。
            false
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn is_process_running(_pid: u32) -> bool {
    // 非 Windows 平台的占位实现
    // 注意：本项目主要面向 Windows 用户，此函数不会被使用
    warn!("is_process_running 在非 Windows 平台被调用");
    false
}

// is_window_foreground_for_pid 函数已移除
// 其功能已整合到 select_best_from_candidates 和 check_any_foreground 中

/// 检查候选 PID 列表中是否有任何进程拥有前台窗口。
///
/// 这是前台判定的核心函数，提供了比单 PID 检查更强的容错性。
///
/// # Arguments
/// * `candidate_pids` - 候选 PID 列表
///
/// # Returns
/// 如果有进程在前台，返回 `Some(pid)`，否则返回 `None`
#[cfg(target_os = "windows")]
fn check_any_foreground(candidate_pids: &[u32]) -> Option<u32> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    if candidate_pids.is_empty() {
        return None;
    }

    unsafe {
        let foreground_window: HWND = GetForegroundWindow();
        if foreground_window.0.is_null() {
            return None;
        }

        let mut foreground_pid: u32 = 0;
        GetWindowThreadProcessId(foreground_window, Some(&mut foreground_pid));

        // 检查前台 PID 是否在候选列表中
        if candidate_pids.contains(&foreground_pid) {
            // 找到了！候选列表中有进程在前台
            return Some(foreground_pid);
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
fn check_any_foreground(_candidate_pids: &[u32]) -> Option<u32> {
    None
}

// has_window_for_pid 函数已移除，其功能已整合到 select_best_from_candidates 中
// 这样可以避免多次调用 EnumWindows（O(N*M) -> O(M)），提升性能

/// 根据可执行文件所在目录获取该目录及子目录下所有正在运行的进程 PID 列表。
///
/// 此函数会刷新进程信息，然后扫描所有进程，找出可执行文件路径在目标目录或其子目录中的进程。
///
/// # Arguments
/// * `executable_path` - 可执行文件的完整路径。
/// * `sys` - 对 `sysinfo::System` 的可变引用。
///
/// # Returns
/// 返回该目录及子目录下所有正在运行进程的 PID 列表。如果无法获取目录信息，返回空列表。
fn get_processes_in_directory(executable_path: &str, sys: &mut System) -> Vec<u32> {
    // 只更新进程列表，不更新磁盘、网络等其他信息，提高性能
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let target_dir = match Path::new(executable_path).parent() {
        Some(dir) => dir,
        None => {
            warn!("无法获取可执行文件 '{}' 的父目录", executable_path);
            return Vec::new();
        }
    };

    // 只对目标目录进行一次规范化，避免在循环中重复 I/O
    let canonical_target = std::fs::canonicalize(target_dir).ok();

    // 预先准备字符串形式的路径用于回退比较
    let target_str = canonical_target
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| target_dir.to_string_lossy().to_string());

    let mut pids = Vec::new();
    for (pid, process) in sys.processes() {
        if let Some(process_exe_path) = process.exe() {
            if let Some(process_dir) = process_exe_path.parent() {
                // 优先使用字符串比较，避免对每个进程都执行 canonicalize
                let process_str = process_dir.to_string_lossy();

                let matches = if let Some(canonical) = &canonical_target {
                    // 先尝试字符串前缀匹配（快速路径）
                    if process_str.starts_with(&target_str) {
                        true
                    } else {
                        // 字符串匹配失败，尝试规范化路径比较（慢速路径，但很少触发）
                        // 这里仍然可能执行 I/O，但只对疑似目标的进程执行
                        std::fs::canonicalize(process_dir)
                            .ok()
                            .map(|canonical_process_dir| {
                                canonical_process_dir == *canonical
                                    || canonical_process_dir.starts_with(canonical)
                            })
                            .unwrap_or(false)
                    }
                } else {
                    // target_dir 规范化失败，完全使用字符串比较
                    process_str == target_str || process_str.starts_with(target_str.as_str())
                };

                if matches {
                    pids.push(pid.as_u32());
                }
            }
        }
    }
    pids
}

/// 根据可执行文件的完整路径查找所有正在运行的进程 PID 列表。
///
/// 此函数是 `get_processes_in_directory` 的包装，用于查找指定游戏目录下的所有进程。
///
/// # Arguments
/// * `executable_path` - 要查找的可执行文件的完整路径。
/// * `sys` - 对 `sysinfo::System` 的可变引用。
///
/// # Returns
/// 返回目录下所有正在运行的进程 PID 列表。
fn get_process_id_by_path(executable_path: &str, sys: &mut System) -> Vec<u32> {
    let pids = get_processes_in_directory(executable_path, sys);
    debug!("找到进程目录下的进程 PID 列表: {:?}", pids);
    pids
}
