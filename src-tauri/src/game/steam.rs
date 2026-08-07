use crate::database::repository::games_repository::GamesRepository;
use crate::entity::tasks;
use parking_lot::RwLock;
use sea_orm::*;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{
    Arc, OnceLock,
    atomic::{AtomicBool, Ordering},
};
use tauri::{Emitter, State, command};
use walkdir::WalkDir;

const MAX_EXECUTABLE_DEPTH: usize = 5;
const MAX_EXECUTABLE_CANDIDATES: usize = 100;
pub(crate) const STEAM_LAUNCH_TASK_TYPE: &str = "steam_launch";

static STEAM_WAITERS: OnceLock<RwLock<HashMap<u32, Arc<AtomicBool>>>> = OnceLock::new();

fn steam_waiters() -> &'static RwLock<HashMap<u32, Arc<AtomicBool>>> {
    STEAM_WAITERS.get_or_init(|| RwLock::new(HashMap::new()))
}

pub(crate) fn register_steam_wait(game_id: u32) -> Arc<AtomicBool> {
    let signal = Arc::new(AtomicBool::new(false));
    steam_waiters().write().insert(game_id, signal.clone());
    signal
}

pub(crate) fn finish_steam_wait(game_id: u32) {
    steam_waiters().write().remove(&game_id);
}

pub(crate) fn cancel_steam_wait(game_id: u32) -> bool {
    let signal = steam_waiters().write().remove(&game_id);
    if let Some(signal) = signal {
        signal.store(true, Ordering::Release);
        true
    } else {
        false
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct SteamAppStatus {
    pub stage: String,
    pub state_flags: u64,
    pub progress_current: u64,
    pub progress_total: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SteamLibraryGame {
    pub app_id: u32,
    pub name: String,
    pub library_path: String,
    pub install_path: String,
    pub executables: Vec<String>,
    pub status: SteamAppStatus,
    pub existing_game_id: Option<i32>,
    pub warning: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SteamLibraryScanResult {
    pub steam_path: String,
    pub steam_executable: String,
    pub games: Vec<SteamLibraryGame>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug)]
pub(crate) struct SteamResolvedApp {
    pub app_id: u32,
    pub name: String,
    pub library_path: PathBuf,
    pub install_path: PathBuf,
    pub manifest_path: PathBuf,
    pub status: SteamAppStatus,
    pub warning: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct SteamLaunchTaskPayload {
    pub version: u32,
    pub game_id: u32,
    pub steam_app_id: u32,
    pub time_tracking_mode: String,
}

#[derive(Clone, Debug)]
enum VdfValue {
    Text(String),
    Object(HashMap<String, VdfValue>),
}

impl VdfValue {
    fn object(&self) -> Option<&HashMap<String, VdfValue>> {
        match self {
            Self::Object(value) => Some(value),
            Self::Text(_) => None,
        }
    }

    fn text(&self) -> Option<&str> {
        match self {
            Self::Text(value) => Some(value),
            Self::Object(_) => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum Token {
    Text(String),
    Open,
    Close,
}

fn tokenize_vdf(input: &str) -> Result<Vec<Token>, String> {
    let chars: Vec<char> = input.chars().collect();
    let mut tokens = Vec::new();
    let mut index = 0;

    while index < chars.len() {
        match chars[index] {
            value if value.is_whitespace() => index += 1,
            '/' if chars.get(index + 1) == Some(&'/') => {
                index += 2;
                while index < chars.len() && chars[index] != '\n' {
                    index += 1;
                }
            }
            '{' => {
                tokens.push(Token::Open);
                index += 1;
            }
            '}' => {
                tokens.push(Token::Close);
                index += 1;
            }
            '"' => {
                index += 1;
                let mut value = String::new();
                let mut closed = false;
                while index < chars.len() {
                    match chars[index] {
                        '"' => {
                            closed = true;
                            index += 1;
                            break;
                        }
                        '\\' => {
                            index += 1;
                            let escaped = *chars
                                .get(index)
                                .ok_or_else(|| "VDF 字符串转义不完整".to_string())?;
                            value.push(match escaped {
                                'n' => '\n',
                                'r' => '\r',
                                't' => '\t',
                                '"' => '"',
                                '\\' => '\\',
                                other => other,
                            });
                            index += 1;
                        }
                        character => {
                            value.push(character);
                            index += 1;
                        }
                    }
                }
                if !closed {
                    return Err("VDF 字符串缺少结束引号".to_string());
                }
                tokens.push(Token::Text(value));
            }
            _ => {
                let start = index;
                while index < chars.len()
                    && !chars[index].is_whitespace()
                    && !matches!(chars[index], '{' | '}')
                {
                    index += 1;
                }
                tokens.push(Token::Text(chars[start..index].iter().collect()));
            }
        }
    }

    Ok(tokens)
}

fn parse_vdf_object(tokens: &[Token], index: &mut usize, nested: bool) -> Result<VdfValue, String> {
    let mut values = HashMap::new();
    while *index < tokens.len() {
        if tokens[*index] == Token::Close {
            if !nested {
                return Err("VDF 出现多余的结束括号".to_string());
            }
            *index += 1;
            return Ok(VdfValue::Object(values));
        }

        let Token::Text(key) = &tokens[*index] else {
            return Err("VDF 键格式无效".to_string());
        };
        *index += 1;
        let value = match tokens.get(*index) {
            Some(Token::Text(value)) => {
                *index += 1;
                VdfValue::Text(value.clone())
            }
            Some(Token::Open) => {
                *index += 1;
                parse_vdf_object(tokens, index, true)?
            }
            _ => return Err(format!("VDF 键 {key} 缺少值")),
        };
        values.insert(key.clone(), value);
    }

    if nested {
        Err("VDF 对象缺少结束括号".to_string())
    } else {
        Ok(VdfValue::Object(values))
    }
}

fn parse_vdf(input: &str) -> Result<VdfValue, String> {
    let tokens = tokenize_vdf(input)?;
    let mut index = 0;
    parse_vdf_object(&tokens, &mut index, false)
}

fn read_vdf(path: &Path) -> Result<VdfValue, String> {
    let bytes = fs::read(path).map_err(|error| format!("读取 {} 失败: {error}", path.display()))?;
    let text = String::from_utf8(bytes)
        .map_err(|error| format!("{} 不是有效 UTF-8: {error}", path.display()))?;
    parse_vdf(&text).map_err(|error| format!("解析 {} 失败: {error}", path.display()))
}

fn value_at<'a>(object: &'a HashMap<String, VdfValue>, key: &str) -> Option<&'a VdfValue> {
    object
        .iter()
        .find(|(candidate, _)| candidate.eq_ignore_ascii_case(key))
        .map(|(_, value)| value)
}

fn text_at<'a>(object: &'a HashMap<String, VdfValue>, key: &str) -> Option<&'a str> {
    value_at(object, key).and_then(VdfValue::text)
}

fn number_at(object: &HashMap<String, VdfValue>, key: &str) -> u64 {
    text_at(object, key)
        .and_then(|value| value.parse().ok())
        .unwrap_or(0)
}

fn app_status(app: &HashMap<String, VdfValue>) -> SteamAppStatus {
    let flags = number_at(app, "StateFlags");
    let stage = if flags & 512 != 0 {
        "paused"
    } else if flags & 131_072 != 0 {
        "validating"
    } else if flags & 524_288 != 0 {
        "preallocating"
    } else if flags & 2_097_152 != 0 {
        "staging"
    } else if flags & 4_194_304 != 0 {
        "committing"
    } else if flags & (256 | 1_024 | 1_048_576) != 0 || flags & 2 != 0 {
        "updating"
    } else {
        "ready"
    };
    let staging = matches!(stage, "staging" | "committing");
    let current = number_at(
        app,
        if staging {
            "BytesStaged"
        } else {
            "BytesDownloaded"
        },
    );
    let total = number_at(
        app,
        if staging {
            "BytesToStage"
        } else {
            "BytesToDownload"
        },
    );
    SteamAppStatus {
        stage: stage.to_string(),
        state_flags: flags,
        progress_current: current,
        progress_total: (total > 0).then_some(total),
    }
}

fn query_registry_value(key: &str, value: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args(["query", key, "/v", value])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            if !line.contains(value) || !line.contains("REG_") {
                continue;
            }
            let marker = line.find("REG_SZ").or_else(|| line.find("REG_EXPAND_SZ"))?;
            let raw = line[marker..]
                .split_whitespace()
                .skip(1)
                .collect::<Vec<_>>()
                .join(" ");
            if !raw.is_empty() {
                return Some(PathBuf::from(raw));
            }
        }
        None
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (key, value);
        None
    }
}

pub(crate) fn find_steam_root() -> Result<PathBuf, String> {
    #[cfg(not(target_os = "windows"))]
    return Err("Steam 集成当前仅支持 Windows".to_string());

    #[cfg(target_os = "windows")]
    {
        let candidates = [
            query_registry_value(r"HKCU\Software\Valve\Steam", "SteamPath"),
            query_registry_value(r"HKLM\Software\WOW6432Node\Valve\Steam", "InstallPath"),
            std::env::var_os("PROGRAMFILES(X86)")
                .map(PathBuf::from)
                .map(|path| path.join("Steam")),
            std::env::var_os("PROGRAMFILES")
                .map(PathBuf::from)
                .map(|path| path.join("Steam")),
        ];
        candidates
            .into_iter()
            .flatten()
            .map(|path| PathBuf::from(path.to_string_lossy().replace('/', "\\")))
            .find(|path| path.join("steam.exe").is_file())
            .ok_or_else(|| "未找到 Steam 安装目录".to_string())
    }
}

fn library_paths(steam_root: &Path) -> Result<Vec<PathBuf>, String> {
    let manifest = [
        steam_root.join("steamapps").join("libraryfolders.vdf"),
        steam_root.join("config").join("libraryfolders.vdf"),
    ]
    .into_iter()
    .find(|path| path.is_file())
    .ok_or_else(|| "未找到 libraryfolders.vdf".to_string())?;
    let root = read_vdf(&manifest)?;
    let root = root
        .object()
        .ok_or_else(|| "库清单根节点无效".to_string())?;
    let libraries = value_at(root, "libraryfolders")
        .and_then(VdfValue::object)
        .unwrap_or(root);
    let mut paths = vec![steam_root.to_path_buf()];
    for (key, value) in libraries {
        if key.parse::<u32>().is_err() {
            continue;
        }
        let Some(path) = value.object().and_then(|value| text_at(value, "path")) else {
            continue;
        };
        paths.push(PathBuf::from(path));
    }
    let mut seen = HashSet::new();
    paths.retain(|path| seen.insert(path.to_string_lossy().to_ascii_lowercase()));
    Ok(paths)
}

fn executable_candidates(install_path: &Path) -> Vec<String> {
    const EXCLUDED: &[&str] = &[
        "unins",
        "uninstall",
        "crashhandler",
        "unitycrashhandler",
        "dxsetup",
        "vc_redist",
        "redistributable",
        "reportcrash",
        "bugreport",
    ];
    let mut candidates = WalkDir::new(install_path)
        .min_depth(1)
        .max_depth(MAX_EXECUTABLE_DEPTH)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| {
            let path = entry.path();
            if !path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
            {
                return None;
            }
            let name = path.file_name()?.to_string_lossy().to_ascii_lowercase();
            if EXCLUDED.iter().any(|value| name.contains(value)) {
                return None;
            }
            path.strip_prefix(install_path)
                .ok()
                .map(|relative| relative.to_string_lossy().replace('\\', "/"))
        })
        .take(MAX_EXECUTABLE_CANDIDATES)
        .collect::<Vec<_>>();
    candidates.sort_by_key(|value| (value.matches('/').count(), value.len(), value.clone()));
    candidates
}

fn parse_manifest_base(
    manifest_path: &Path,
    library_path: &Path,
) -> Result<SteamResolvedApp, String> {
    let root = read_vdf(manifest_path)?;
    let root = root
        .object()
        .ok_or_else(|| "应用清单根节点无效".to_string())?;
    let app = value_at(root, "AppState")
        .and_then(VdfValue::object)
        .unwrap_or(root);
    let app_id = text_at(app, "appid")
        .ok_or_else(|| "应用清单缺少 appid".to_string())?
        .parse::<u32>()
        .map_err(|_| "应用清单 appid 无效".to_string())?;
    let name = text_at(app, "name")
        .unwrap_or("Unknown Steam Game")
        .to_string();
    let install_dir =
        text_at(app, "installdir").ok_or_else(|| "应用清单缺少 installdir".to_string())?;
    let install_path = library_path
        .join("steamapps")
        .join("common")
        .join(install_dir);
    let warning = (!install_path.is_dir()).then(|| "Steam 安装目录不存在".to_string());
    Ok(SteamResolvedApp {
        app_id,
        name,
        library_path: library_path.to_path_buf(),
        install_path,
        manifest_path: manifest_path.to_path_buf(),
        status: app_status(app),
        warning,
    })
}

fn scan_game_from_manifest(
    manifest_path: &Path,
    library_path: &Path,
    existing: &HashMap<i64, i32>,
) -> Result<SteamLibraryGame, String> {
    let resolved = parse_manifest_base(manifest_path, library_path)?;
    Ok(SteamLibraryGame {
        app_id: resolved.app_id,
        name: resolved.name,
        library_path: resolved.library_path.to_string_lossy().to_string(),
        install_path: resolved.install_path.to_string_lossy().to_string(),
        executables: resolved
            .install_path
            .is_dir()
            .then(|| executable_candidates(&resolved.install_path))
            .unwrap_or_default(),
        status: resolved.status,
        existing_game_id: existing.get(&(resolved.app_id as i64)).copied(),
        warning: resolved.warning,
    })
}

fn app_id_from_manifest_name(path: &Path) -> Option<u32> {
    let file_name = path.file_name()?.to_string_lossy();
    file_name
        .strip_prefix("appmanifest_")?
        .strip_suffix(".acf")?
        .parse()
        .ok()
}

fn warning_game_from_manifest_error(
    manifest_path: &Path,
    library_path: &Path,
    existing: &HashMap<i64, i32>,
    error: &str,
) -> Option<SteamLibraryGame> {
    let app_id = app_id_from_manifest_name(manifest_path)?;
    Some(SteamLibraryGame {
        app_id,
        name: format!("Steam App {app_id}"),
        library_path: library_path.to_string_lossy().to_string(),
        install_path: library_path
            .join("steamapps")
            .join("common")
            .to_string_lossy()
            .to_string(),
        executables: Vec::new(),
        status: SteamAppStatus {
            stage: "failed".to_string(),
            state_flags: 0,
            progress_current: 0,
            progress_total: None,
        },
        existing_game_id: existing.get(&(app_id as i64)).copied(),
        warning: Some(error.to_string()),
    })
}

pub(crate) async fn scan_installed_games(
    db: &DatabaseConnection,
) -> Result<SteamLibraryScanResult, String> {
    let steam_root = find_steam_root()?;
    let existing = GamesRepository::get_steam_bindings(db)
        .await
        .map_err(|error| format!("读取 Steam 关联失败: {error}"))?;
    let libraries = library_paths(&steam_root)?;
    let mut games = Vec::new();
    let mut warnings = Vec::new();
    for library in libraries {
        let steamapps = library.join("steamapps");
        let entries = match fs::read_dir(&steamapps) {
            Ok(entries) => entries,
            Err(error) => {
                warnings.push(format!(
                    "读取 Steam 库 {} 失败: {error}",
                    steamapps.display()
                ));
                continue;
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
                continue;
            }
            match scan_game_from_manifest(&path, &library, &existing) {
                Ok(game) => games.push(game),
                Err(error) => {
                    if let Some(game) =
                        warning_game_from_manifest_error(&path, &library, &existing, &error)
                    {
                        games.push(game);
                    } else {
                        warnings.push(error);
                    }
                }
            }
        }
    }
    games.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(SteamLibraryScanResult {
        steam_path: steam_root.to_string_lossy().to_string(),
        steam_executable: steam_root.join("steam.exe").to_string_lossy().to_string(),
        games,
        warnings,
    })
}

pub(crate) async fn resolve_steam_app(
    db: &DatabaseConnection,
    app_id: u32,
) -> Result<(SteamResolvedApp, PathBuf), String> {
    let _ = db;
    let steam_root = find_steam_root()?;
    let steam_executable = steam_root.join("steam.exe");
    for library in library_paths(&steam_root)? {
        let manifest_path = library
            .join("steamapps")
            .join(format!("appmanifest_{app_id}.acf"));
        if !manifest_path.is_file() {
            continue;
        }
        return parse_manifest_base(&manifest_path, &library).map(|game| (game, steam_executable));
    }
    Err(format!("未找到已安装的 Steam 应用 {app_id}"))
}

pub(crate) fn refresh_steam_app_status(manifest_path: &Path) -> Result<SteamAppStatus, String> {
    let root = read_vdf(manifest_path)?;
    let root = root
        .object()
        .ok_or_else(|| "应用清单根节点无效".to_string())?;
    let app = value_at(root, "AppState")
        .and_then(VdfValue::object)
        .unwrap_or(root);
    Ok(app_status(app))
}

pub(crate) async fn create_steam_launch_task(
    db: &DatabaseConnection,
    title: &str,
    game_id: u32,
    steam_app_id: u32,
    time_tracking_mode: &str,
) -> Result<tasks::Model, String> {
    let dedupe_key = format!("steam_launch:{game_id}");
    if let Some(task) = tasks::Entity::find()
        .filter(tasks::Column::DedupeKey.eq(&dedupe_key))
        .filter(tasks::Column::Status.is_in(["pending", "running", "paused"]))
        .one(db)
        .await
        .map_err(|error| format!("检查 Steam 启动任务失败: {error}"))?
    {
        return Ok(task);
    }
    let now = chrono::Utc::now().timestamp();
    tasks::ActiveModel {
        id: NotSet,
        task_type: Set(STEAM_LAUNCH_TASK_TYPE.to_string()),
        title: Set(title.to_string()),
        status: Set("running".to_string()),
        stage: Set(Some("checking".to_string())),
        payload_json: Set(serde_json::to_value(SteamLaunchTaskPayload {
            version: 1,
            game_id,
            steam_app_id,
            time_tracking_mode: time_tracking_mode.to_string(),
        })
        .map_err(|error| format!("序列化 Steam 任务失败: {error}"))?),
        result_json: Set(None),
        progress_current: Set(0),
        progress_total: Set(None),
        progress_unit: Set(Some("bytes".to_string())),
        dedupe_key: Set(Some(dedupe_key)),
        error_code: Set(None),
        error_message: Set(None),
        created_at: Set(now),
        started_at: Set(Some(now)),
        updated_at: Set(now),
        finished_at: Set(None),
    }
    .insert(db)
    .await
    .map_err(|error| format!("创建 Steam 启动任务失败: {error}"))
}

pub(crate) fn emit_steam_launch_status<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    game_id: u32,
    status: &str,
    stage: &str,
    progress_current: u64,
    progress_total: Option<u64>,
    task_id: Option<i64>,
) -> Result<(), String> {
    app.emit(
        "steam-launch-status",
        json!({
            "gameId": game_id,
            "taskId": task_id,
            "status": if stage == "paused" { "paused" } else { status },
            "stage": stage,
            "progressCurrent": progress_current,
            "progressTotal": progress_total,
        }),
    )
    .map_err(|error| format!("发送 Steam 状态失败: {error}"))
}

pub(crate) async fn update_steam_launch_task<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    db: &DatabaseConnection,
    task_id: i64,
    game_id: u32,
    status: &str,
    stage: &str,
    progress_current: u64,
    progress_total: Option<u64>,
    error: Option<(&str, &str)>,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();
    let finished = matches!(status, "completed" | "failed" | "cancelled");
    let mut active = tasks::ActiveModel {
        id: Set(task_id),
        status: Set(status.to_string()),
        stage: Set(Some(stage.to_string())),
        progress_current: Set(progress_current.min(i64::MAX as u64) as i64),
        progress_total: Set(progress_total.map(|value| value.min(i64::MAX as u64) as i64)),
        updated_at: Set(now),
        finished_at: Set(finished.then_some(now)),
        ..Default::default()
    };
    if let Some((code, message)) = error {
        active.error_code = Set(Some(code.to_string()));
        active.error_message = Set(Some(message.to_string()));
    }
    active
        .update(db)
        .await
        .map_err(|error| format!("更新 Steam 启动任务失败: {error}"))?;
    let event_status = if stage == "paused" { "paused" } else { status };
    emit_steam_launch_status(
        app,
        game_id,
        status,
        stage,
        progress_current,
        progress_total,
        Some(task_id),
    )?;
    app.emit(
        "task-progress",
        json!({
            "task_id": task_id,
            "status": event_status,
            "stage": stage,
            "progress_current": progress_current.min(i64::MAX as u64) as i64,
            "progress_total": progress_total.map(|value| value.min(i64::MAX as u64) as i64),
            "progress_unit": "bytes",
        }),
    )
    .map_err(|error| format!("发送 Steam 任务进度失败: {error}"))?;
    Ok(())
}

#[command]
pub async fn scan_steam_library(
    db: State<'_, DatabaseConnection>,
) -> Result<SteamLibraryScanResult, String> {
    scan_installed_games(db.inner()).await
}

#[command]
pub async fn get_steam_app_status(
    db: State<'_, DatabaseConnection>,
    app_id: u32,
) -> Result<SteamAppStatus, String> {
    resolve_steam_app(db.inner(), app_id)
        .await
        .map(|(game, _)| game.status)
}

/// 按名称搜索已安装游戏的 acf 清单 (local)
#[command]
pub fn search_steam_acf(query: String, limit: Option<usize>) -> Result<Vec<SteamAcfEntry>, String> {
    search_steam_acf_impl(&query, limit.unwrap_or(50))
}

/// 已安装游戏的 acf 清单摘要
#[derive(Clone, Debug, Serialize)]
pub struct SteamAcfEntry {
    pub app_id: u32,
    pub name: String,
    /// 安装目录名（installdir），如 "Counter-Strike Global Offensive"
    pub install_dir: String,
}

/// 扫描所有 Steam 库的 appmanifest_*.acf，按游戏名称模糊搜索已安装游戏。
fn acf_query_matches(query: &str, app_id: u32, name: &str) -> bool {
    let query = query.trim();
    match query.parse::<u32>() {
        Ok(expected) => app_id == expected,
        Err(_) => query.is_empty() || name.to_lowercase().contains(&query.to_lowercase()),
    }
}

pub fn search_steam_acf_impl(query: &str, limit: usize) -> Result<Vec<SteamAcfEntry>, String> {
    let steam_root = find_steam_root()?;
    let mut matches = Vec::new();
    for library in library_paths(&steam_root)? {
        let steamapps = library.join("steamapps");
        let Ok(entries) = fs::read_dir(&steamapps) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
                continue;
            }
            let Ok(root) = read_vdf(&path) else {
                continue;
            };
            let Some(root) = root.object() else {
                continue;
            };
            let app = value_at(root, "AppState")
                .and_then(VdfValue::object)
                .unwrap_or(root);
            let Some(name) = text_at(app, "name") else {
                continue;
            };
            let Some(install_dir) = text_at(app, "installdir") else {
                continue;
            };
            let Some(app_id) = app_id_from_manifest_name(&path) else {
                continue;
            };
            let matched = acf_query_matches(query, app_id, name);
            if matched {
                matches.push(SteamAcfEntry {
                    app_id,
                    name: name.to_string(),
                    install_dir: install_dir.to_string(),
                });
            }
        }
    }
    matches.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    matches.truncate(limit);
    Ok(matches)
}

#[cfg(test)]
mod tests {
    use super::{
        acf_query_matches, app_status, parse_manifest_base, parse_vdf, value_at,
        warning_game_from_manifest_error,
    };
    use std::collections::HashMap;
    use std::path::Path;

    #[test]
    fn acf_query_matches_appid_exactly_for_numeric_query() {
        assert!(acf_query_matches("730", 730, "Counter-Strike 2"));
        assert!(!acf_query_matches("730", 570, "Dota 2"));
        assert!(!acf_query_matches("730", 5730, "Some Game 730 Edition"));
        assert!(acf_query_matches(" 730 ", 730, "Whatever"));
    }

    #[test]
    fn acf_query_matches_name_fuzzy_for_text_query() {
        assert!(acf_query_matches("dota", 570, "Dota 2"));
        assert!(acf_query_matches("DOTA", 570, "Dota 2"));
        assert!(acf_query_matches("counter", 730, "Counter-Strike 2"));
        assert!(!acf_query_matches("cs2", 730, "Counter-Strike 2"));
        assert!(acf_query_matches("", 730, "Anything"));
    }

    #[test]
    fn parses_comments_escapes_and_nested_objects() {
        let parsed = parse_vdf(
            r#"// comment
            "libraryfolders" { "0" { "path" "D:\\Steam Library" } }
            "#,
        )
        .unwrap();
        let root = parsed.object().unwrap();
        let libraries = value_at(root, "libraryfolders").unwrap().object().unwrap();
        let first = value_at(libraries, "0").unwrap().object().unwrap();
        assert_eq!(
            value_at(first, "path").unwrap().text(),
            Some(r"D:\Steam Library")
        );
    }

    #[test]
    fn maps_update_state_and_progress() {
        let parsed = parse_vdf(
            r#""AppState" { "StateFlags" "1048576" "BytesDownloaded" "25" "BytesToDownload" "100" }"#,
        )
        .unwrap();
        let root = parsed.object().unwrap();
        let app = value_at(root, "AppState").unwrap().object().unwrap();
        let status = app_status(app);
        assert_eq!(status.stage, "updating");
        assert_eq!(status.progress_current, 25);
        assert_eq!(status.progress_total, Some(100));
    }

    #[test]
    fn parses_multiple_libraryfolders_fixture() {
        let parsed = parse_vdf(include_str!("fixtures/steam/libraryfolders.vdf")).unwrap();
        let root = parsed.object().unwrap();
        let libraries = value_at(root, "libraryfolders").unwrap().object().unwrap();
        assert_eq!(
            value_at(value_at(libraries, "0").unwrap().object().unwrap(), "path")
                .unwrap()
                .text(),
            Some(r"C:\Program Files (x86)\Steam")
        );
        assert_eq!(
            value_at(value_at(libraries, "1").unwrap().object().unwrap(), "path")
                .unwrap()
                .text(),
            Some(r"D:\SteamLibrary")
        );
    }

    #[test]
    fn parses_ready_manifest_fixture() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src/game/fixtures/steam/appmanifest_ready.acf");
        let library = Path::new(r"D:\SteamLibrary");
        let app = parse_manifest_base(&fixture, library).unwrap();
        assert_eq!(app.app_id, 123456);
        assert_eq!(app.name, "Ready Fixture");
        assert_eq!(app.status.stage, "ready");
        assert!(
            app.install_path
                .to_string_lossy()
                .replace('\\', "/")
                .ends_with("steamapps/common/Ready Fixture")
        );
    }

    #[test]
    fn maps_paused_and_validating_manifest_states() {
        let paused = parse_vdf(include_str!("fixtures/steam/appmanifest_paused.acf")).unwrap();
        let paused_root = paused.object().unwrap();
        let paused_app = value_at(paused_root, "AppState").unwrap().object().unwrap();
        let paused_status = app_status(paused_app);
        assert_eq!(paused_status.stage, "paused");
        assert_eq!(paused_status.progress_current, 10);
        assert_eq!(paused_status.progress_total, Some(200));

        let validating =
            parse_vdf(include_str!("fixtures/steam/appmanifest_validating.acf")).unwrap();
        let validating_root = validating.object().unwrap();
        let validating_app = value_at(validating_root, "AppState")
            .unwrap()
            .object()
            .unwrap();
        assert_eq!(app_status(validating_app).stage, "validating");
    }

    #[test]
    fn malformed_manifest_can_be_reported_as_entry_warning() {
        let existing = HashMap::from([(999999_i64, 42_i32)]);
        let manifest = Path::new(r"D:\SteamLibrary\steamapps\appmanifest_999999.acf");
        let library = Path::new(r"D:\SteamLibrary");
        let warning =
            warning_game_from_manifest_error(manifest, library, &existing, "解析失败").unwrap();
        assert_eq!(warning.app_id, 999999);
        assert_eq!(warning.existing_game_id, Some(42));
        assert_eq!(warning.status.stage, "failed");
        assert_eq!(warning.warning.as_deref(), Some("解析失败"));
    }
}
