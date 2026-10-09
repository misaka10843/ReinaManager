use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use keyring::Entry;
use reqwest::blocking::{Body, Client};
use reqwest::header::{CONTENT_LENGTH, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Manager, command};
use tauri_plugin_store::StoreExt;
use url::Url;

const SERVICE_NAME: &str = "ReinaManager.WebDAV";
const STORE_FILE: &str = "webdav.json";
const CONFIG_KEY: &str = "config";
const PASSWORD_USER: &str = "connection-password";
const MASTER_PASSWORD_USER: &str = "backup-master-password";
const ENCRYPTED_MAGIC: &[u8; 8] = b"RMWDAV01";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WebDavBackupConfig {
    pub enabled: bool,
    pub url: String,
    pub username: String,
    pub remote_path: String,
    pub encrypt: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavSecretStatus {
    pub password_saved: bool,
    pub master_password_saved: bool,
}

fn entry(user: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, user).map_err(|error| format!("打开系统凭据存储失败: {error}"))
}

fn load_config(app: &AppHandle) -> Result<WebDavBackupConfig, String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|error| format!("读取 WebDAV 配置失败: {error}"))?;
    Ok(store
        .get(CONFIG_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default())
}

#[command]
pub fn get_webdav_config(app: AppHandle) -> Result<WebDavBackupConfig, String> {
    load_config(&app)
}

#[command]
pub fn save_webdav_config(app: AppHandle, config: WebDavBackupConfig) -> Result<(), String> {
    if config.enabled {
        validate_config(&config)?;
        if entry(PASSWORD_USER)?.get_password().is_err() {
            return Err("启用 WebDAV 上传前请先保存连接密码".to_string());
        }
        if config.encrypt && entry(MASTER_PASSWORD_USER)?.get_password().is_err() {
            return Err("启用远端加密前请先保存备份主密码".to_string());
        }
    }
    let store = app
        .store(STORE_FILE)
        .map_err(|error| format!("打开 WebDAV 配置失败: {error}"))?;
    store.set(
        CONFIG_KEY,
        serde_json::to_value(config).map_err(|error| format!("编码 WebDAV 配置失败: {error}"))?,
    );
    store
        .save()
        .map_err(|error| format!("保存 WebDAV 配置失败: {error}"))
}

#[command]
pub fn set_webdav_secrets(password: String, master_password: String) -> Result<(), String> {
    if !password.is_empty() {
        entry(PASSWORD_USER)?
            .set_password(&password)
            .map_err(|error| format!("保存 WebDAV 密码失败: {error}"))?;
    }
    if !master_password.is_empty() {
        entry(MASTER_PASSWORD_USER)?
            .set_password(&master_password)
            .map_err(|error| format!("保存备份主密码失败: {error}"))?;
    }
    Ok(())
}

#[command]
pub fn get_webdav_secret_status() -> Result<WebDavSecretStatus, String> {
    Ok(WebDavSecretStatus {
        password_saved: entry(PASSWORD_USER)?.get_password().is_ok(),
        master_password_saved: entry(MASTER_PASSWORD_USER)?.get_password().is_ok(),
    })
}

#[command]
pub fn clear_webdav_secrets() -> Result<(), String> {
    for user in [PASSWORD_USER, MASTER_PASSWORD_USER] {
        match entry(user)?.delete_credential() {
            Ok(()) => {}
            Err(keyring::Error::NoEntry) => {}
            Err(error) => return Err(format!("删除系统凭据失败: {error}")),
        }
    }
    Ok(())
}

pub async fn upload_auto_backup(
    app: AppHandle,
    database: Option<String>,
    covers: Option<String>,
    batch_id: String,
) -> Result<(), String> {
    let config = load_config(&app)?;
    if !config.enabled {
        return Ok(());
    }
    let mut uploads = Vec::new();
    if let Some(path) = database {
        uploads.push(PathBuf::from(path));
    }
    if let Some(path) = covers {
        uploads.push(PathBuf::from(path));
    }
    if uploads.first().and_then(|path| path.parent()).is_none() {
        return Ok(());
    }
    let pending_path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("解析 WebDAV 重试记录目录失败: {error}"))?
        .join("webdav-pending-uploads.json");
    if let Some(parent) = pending_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("创建 WebDAV 重试记录目录失败: {error}"))?;
    }
    if let Ok(contents) = fs::read(&pending_path)
        && let Ok(mut pending) = serde_json::from_slice::<Vec<PathBuf>>(&contents)
    {
        uploads.splice(0..0, pending.drain(..));
    }
    let password = match entry(PASSWORD_USER)
        .and_then(|secret| secret.get_password().map_err(|error| error.to_string()))
    {
        Ok(password) => password,
        Err(error) => {
            save_pending_uploads(&pending_path, &uploads)?;
            return Err(format!("读取 WebDAV 密码失败: {error}"));
        }
    };
    let master_password = if config.encrypt {
        match entry(MASTER_PASSWORD_USER)
            .and_then(|secret| secret.get_password().map_err(|error| error.to_string()))
        {
            Ok(password) => Some(password),
            Err(error) => {
                save_pending_uploads(&pending_path, &uploads)?;
                return Err(format!("读取备份主密码失败: {error}"));
            }
        }
    } else {
        None
    };
    let config_for_task = config.clone();
    tokio::task::spawn_blocking(move || {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(30 * 60))
            .build()
            .map_err(|error| format!("创建 WebDAV 客户端失败: {error}"))?;
        let mut pending = Vec::new();
        let mut first_error = None;
        for path in uploads {
            if !path.is_file() {
                continue;
            }
            match upload_file(
                &client,
                &config_for_task,
                &password,
                master_password.as_deref(),
                &path,
                &batch_id,
            ) {
                Ok(()) => {}
                Err(error) => {
                    first_error.get_or_insert(error);
                    pending.push(path);
                }
            }
        }
        save_pending_uploads(&pending_path, &pending)?;
        if let Some(error) = first_error {
            return Err(error);
        }
        Ok(())
    })
    .await
    .map_err(|error| format!("WebDAV 上传任务异常: {error}"))?
}

#[command]
pub async fn test_webdav_connection(config: WebDavBackupConfig) -> Result<(), String> {
    validate_config(&config)?;
    let password = entry(PASSWORD_USER)?
        .get_password()
        .map_err(|error| format!("读取 WebDAV 密码失败: {error}"))?;
    let config_for_task = config.clone();
    tokio::task::spawn_blocking(move || {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|error| format!("创建 WebDAV 客户端失败: {error}"))?;
        ensure_remote_directories(&client, &config_for_task, &password)
    })
    .await
    .map_err(|error| format!("WebDAV 连接测试任务异常: {error}"))??;
    Ok(())
}

fn validate_config(config: &WebDavBackupConfig) -> Result<(), String> {
    let parsed =
        Url::parse(config.url.trim()).map_err(|error| format!("WebDAV 地址无效: {error}"))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err("WebDAV 地址必须是有效的 http 或 https URL".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("WebDAV 用户名和密码请填写在对应字段中，不要嵌入 URL".to_string());
    }
    if config.remote_path.trim().is_empty() {
        return Err("WebDAV 远端目录不能为空".to_string());
    }
    if config
        .remote_path
        .split('/')
        .any(|part| matches!(part, "." | ".."))
    {
        return Err("WebDAV 远端目录不能包含 . 或 .. 路径段".to_string());
    }
    Ok(())
}

fn save_pending_uploads(path: &Path, pending: &[PathBuf]) -> Result<(), String> {
    let pending_json = serde_json::to_vec(pending)
        .map_err(|error| format!("编码 WebDAV 待上传列表失败: {error}"))?;
    fs::write(path, pending_json).map_err(|error| format!("保存 WebDAV 待上传列表失败: {error}"))
}

fn upload_file(
    client: &Client,
    config: &WebDavBackupConfig,
    password: &str,
    master_password: Option<&str>,
    local_path: &Path,
    batch_id: &str,
) -> Result<(), String> {
    let file_name = local_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "备份文件名无效".to_string())?;
    let encrypted_temp = if let Some(master_password) = master_password {
        let temp_path = std::env::temp_dir().join(format!(
            "reina-webdav-{}-{}.enc",
            std::process::id(),
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let size = encrypt_file_to(local_path, &temp_path, master_password)?;
        Some((temp_path, size))
    } else {
        None
    };
    let result = (|| {
        let (upload_path, size, remote_name) = match encrypted_temp.as_ref() {
            Some((path, size)) => (path.as_path(), *size, format!("{file_name}.enc")),
            None => {
                let size = fs::metadata(local_path)
                    .map_err(|error| format!("读取备份大小失败: {error}"))?
                    .len();
                (local_path, size, file_name.to_string())
            }
        };
        ensure_remote_directories(client, config, password)?;
        let file = File::open(upload_path)
            .map_err(|error| format!("打开上传文件失败 {}: {error}", upload_path.display()))?;
        let endpoint = build_remote_url(config, &remote_name)?;
        match client
            .put(endpoint)
            .basic_auth(&config.username, Some(password))
            .header(CONTENT_TYPE, "application/octet-stream")
            .header(CONTENT_LENGTH, size.to_string())
            .body(Body::new(file))
            .send()
        {
            Err(error) => Err(format!("上传 WebDAV 文件失败 {remote_name}: {error}")),
            Ok(response) if !response.status().is_success() => Err(format!(
                "WebDAV 上传失败 batch={batch_id} file={remote_name} status={}",
                response.status()
            )),
            Ok(_) => Ok(()),
        }
    })();
    if let Some((path, _)) = encrypted_temp {
        let _ = std::fs::remove_file(path);
    }
    result
}

fn ensure_remote_directories(
    client: &Client,
    config: &WebDavBackupConfig,
    password: &str,
) -> Result<(), String> {
    let mut current =
        Url::parse(config.url.trim()).map_err(|error| format!("WebDAV 地址无效: {error}"))?;
    for component in config
        .remote_path
        .split('/')
        .filter(|part| !part.is_empty())
    {
        current
            .path_segments_mut()
            .map_err(|_| "WebDAV 地址不支持目录路径".to_string())?
            .push(component);
        let response = client
            .request(
                reqwest::Method::from_bytes(b"MKCOL").expect("valid method"),
                current.clone(),
            )
            .basic_auth(&config.username, Some(password))
            .send()
            .map_err(|error| format!("创建 WebDAV 目录失败: {error}"))?;
        if !response.status().is_success() && response.status().as_u16() != 405 {
            return Err(format!("创建 WebDAV 目录失败: {}", response.status()));
        }
    }
    Ok(())
}

fn build_remote_url(config: &WebDavBackupConfig, filename: &str) -> Result<Url, String> {
    let mut url =
        Url::parse(config.url.trim()).map_err(|error| format!("WebDAV 地址无效: {error}"))?;
    url.path_segments_mut()
        .map_err(|_| "WebDAV 地址不支持目录路径".to_string())?
        .pop_if_empty();
    for component in config
        .remote_path
        .split('/')
        .filter(|part| !part.is_empty())
    {
        url.path_segments_mut().unwrap().push(component);
    }
    url.path_segments_mut().unwrap().push(filename);
    Ok(url)
}

fn encrypt_file_to(source_path: &Path, target_path: &Path, password: &str) -> Result<u64, String> {
    match encrypt_file_to_inner(source_path, target_path, password) {
        Ok(size) => Ok(size),
        Err(error) => {
            let _ = fs::remove_file(target_path);
            Err(error)
        }
    }
}

fn encrypt_file_to_inner(
    source_path: &Path,
    target_path: &Path,
    password: &str,
) -> Result<u64, String> {
    let mut source = File::open(source_path)
        .map_err(|error| format!("打开待加密备份失败 {}: {error}", source_path.display()))?;
    let mut target =
        File::create(target_path).map_err(|error| format!("创建加密临时文件失败: {error}"))?;
    let mut salt = [0_u8; 16];
    let mut nonce = [0_u8; 24];
    getrandom::fill(&mut salt).map_err(|error| format!("生成加密盐失败: {error}"))?;
    getrandom::fill(&mut nonce).map_err(|error| format!("生成加密随机数失败: {error}"))?;
    let params = Params::new(19 * 1024, 2, 1, Some(32))
        .map_err(|error| format!("初始化密码派生失败: {error}"))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0_u8; 32];
    argon
        .hash_password_into(password.as_bytes(), &salt, &mut key)
        .map_err(|error| format!("派生备份加密密钥失败: {error}"))?;
    let cipher =
        XChaCha20Poly1305::new_from_slice(&key).map_err(|_| "初始化备份加密器失败".to_string())?;
    target
        .write_all(ENCRYPTED_MAGIC)
        .and_then(|_| target.write_all(&salt))
        .and_then(|_| target.write_all(&nonce))
        .map_err(|error| format!("写入加密备份头失败: {error}"))?;
    let mut total = (ENCRYPTED_MAGIC.len() + salt.len() + nonce.len()) as u64;
    let mut counter = 0_u64;
    let mut plaintext = vec![0_u8; 1024 * 1024];
    loop {
        let read = source
            .read(&mut plaintext)
            .map_err(|error| format!("读取待加密备份失败: {error}"))?;
        if read == 0 {
            break;
        }
        let mut chunk_nonce = nonce;
        let counter_bytes = counter.to_le_bytes();
        for (target, value) in chunk_nonce[16..].iter_mut().zip(counter_bytes) {
            *target ^= value;
        }
        let encrypted = cipher
            .encrypt(&XNonce::from(chunk_nonce), &plaintext[..read])
            .map_err(|_| "加密备份失败".to_string())?;
        target
            .write_all(&(read as u32).to_le_bytes())
            .and_then(|_| target.write_all(&encrypted))
            .map_err(|error| format!("写入加密备份数据失败: {error}"))?;
        total += 4 + encrypted.len() as u64;
        counter = counter
            .checked_add(1)
            .ok_or_else(|| "加密备份分块数量溢出".to_string())?;
    }
    let mut final_nonce = nonce;
    for (target, value) in final_nonce[16..].iter_mut().zip(counter.to_le_bytes()) {
        *target ^= value;
    }
    let final_tag = cipher
        .encrypt(&XNonce::from(final_nonce), &[][..])
        .map_err(|_| "生成加密备份结束标记失败".to_string())?;
    target
        .write_all(&0_u32.to_le_bytes())
        .and_then(|_| target.write_all(&final_tag))
        .map_err(|error| format!("写入加密备份结束标记失败: {error}"))?;
    total += 4 + final_tag.len() as u64;
    target
        .sync_all()
        .map_err(|error| format!("同步加密备份失败: {error}"))?;
    key.fill(0);
    Ok(total)
}

#[allow(dead_code)]
fn decrypt_file_to(source_path: &Path, target_path: &Path, password: &str) -> Result<(), String> {
    let result = decrypt_file_to_inner(source_path, target_path, password);
    if result.is_err() {
        let _ = fs::remove_file(target_path);
    }
    result
}

fn decrypt_file_to_inner(
    source_path: &Path,
    target_path: &Path,
    password: &str,
) -> Result<(), String> {
    let mut source =
        File::open(source_path).map_err(|error| format!("打开加密备份失败: {error}"))?;
    let mut target =
        File::create(target_path).map_err(|error| format!("创建解密临时文件失败: {error}"))?;
    let mut magic = [0_u8; 8];
    source
        .read_exact(&mut magic)
        .map_err(|error| format!("加密备份头部损坏: {error}"))?;
    if &magic != ENCRYPTED_MAGIC {
        return Err("加密备份格式无效".to_string());
    }
    let mut salt = [0_u8; 16];
    let mut nonce = [0_u8; 24];
    source
        .read_exact(&mut salt)
        .and_then(|_| source.read_exact(&mut nonce))
        .map_err(|error| format!("加密备份头部损坏: {error}"))?;
    let params = Params::new(19 * 1024, 2, 1, Some(32))
        .map_err(|error| format!("初始化密码派生失败: {error}"))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0_u8; 32];
    argon
        .hash_password_into(password.as_bytes(), &salt, &mut key)
        .map_err(|error| format!("派生备份解密密钥失败: {error}"))?;
    let cipher =
        XChaCha20Poly1305::new_from_slice(&key).map_err(|_| "初始化备份解密器失败".to_string())?;
    let mut counter = 0_u64;
    let mut has_final_tag = false;
    loop {
        let mut length_bytes = [0_u8; 4];
        let first = source
            .read(&mut length_bytes[..1])
            .map_err(|error| format!("读取加密备份失败: {error}"))?;
        if first == 0 {
            if !has_final_tag {
                return Err("加密备份缺少完整性结束标记".to_string());
            }
            break;
        }
        if has_final_tag {
            return Err("加密备份结束标记后存在额外数据".to_string());
        }
        source
            .read_exact(&mut length_bytes[1..])
            .map_err(|error| format!("加密备份分块长度损坏: {error}"))?;
        let plaintext_size = u32::from_le_bytes(length_bytes) as usize;
        if plaintext_size > 1024 * 1024 {
            return Err("加密备份分块长度无效".to_string());
        }
        let mut encrypted = vec![0_u8; plaintext_size + 16];
        source
            .read_exact(&mut encrypted)
            .map_err(|error| format!("加密备份分块不完整: {error}"))?;
        let mut chunk_nonce = nonce;
        for (target, value) in chunk_nonce[16..].iter_mut().zip(counter.to_le_bytes()) {
            *target ^= value;
        }
        let plaintext = cipher
            .decrypt(&XNonce::from(chunk_nonce), encrypted.as_ref())
            .map_err(|_| "备份主密码错误或加密备份已损坏".to_string())?;
        if plaintext_size == 0 {
            if !plaintext.is_empty() || source.read(&mut [0_u8; 1]).unwrap_or(0) != 0 {
                return Err("加密备份结束标记无效".to_string());
            }
            has_final_tag = true;
            continue;
        }
        target
            .write_all(&plaintext)
            .map_err(|error| format!("写入解密备份失败: {error}"))?;
        counter = counter
            .checked_add(1)
            .ok_or_else(|| "加密备份分块数量溢出".to_string())?;
    }
    target
        .sync_all()
        .map_err(|error| format!("同步解密备份失败: {error}"))?;
    key.fill(0);
    Ok(())
}

#[allow(dead_code)]
fn validate_encrypted_header(mut reader: impl Read) -> Result<(), String> {
    let mut magic = [0_u8; 8];
    reader
        .read_exact(&mut magic)
        .map_err(|error| format!("加密备份头部损坏: {error}"))?;
    if &magic != ENCRYPTED_MAGIC {
        return Err("加密备份格式无效".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{decrypt_file_to, encrypt_file_to};
    use std::fs;

    #[test]
    fn encrypted_backup_round_trips_and_rejects_wrong_password() {
        let root = std::env::temp_dir().join(format!(
            "reina-webdav-crypto-test-{}-{}",
            std::process::id(),
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        fs::create_dir(&root).expect("创建加密格式测试目录");
        let source = root.join("source.db");
        let encrypted = root.join("backup.db.enc");
        let truncated = root.join("truncated.db.enc");
        let restored = root.join("restored.db");
        let payload: Vec<u8> = (0..1024 * 1024 + 19)
            .map(|index| (index % 251) as u8)
            .collect();
        fs::write(&source, &payload).expect("写入测试源文件");

        encrypt_file_to(&source, &encrypted, "shared-master-password").expect("加密备份");
        assert!(decrypt_file_to(&encrypted, &restored, "incorrect-password").is_err());
        let mut encrypted_bytes = fs::read(&encrypted).expect("读取加密结果");
        encrypted_bytes.pop();
        fs::write(&truncated, encrypted_bytes).expect("写入截断文件");
        assert!(decrypt_file_to(&truncated, &restored, "shared-master-password").is_err());
        decrypt_file_to(&encrypted, &restored, "shared-master-password").expect("解密备份");
        assert_eq!(fs::read(&restored).expect("读取解密结果"), payload);
        fs::remove_dir_all(&root).expect("清理加密格式测试目录");
    }
}
