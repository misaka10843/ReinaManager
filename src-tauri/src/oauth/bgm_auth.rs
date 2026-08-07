//! BGM OAuth 授权模块。
//!
//! 仅放需要 `BGM_APP_SECRET` 的流程：授权 URL、code 换 token、refresh。

use std::time::Duration;

use chrono::Utc;
use sea_orm::{ActiveModelTrait, DatabaseConnection, Set};
use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::database::repository::settings_repository::SettingsRepository;
use crate::entity::user::BgmAuth;
use crate::oauth::shared::{cancel_oauth_callback, generate_oauth_state, start_oauth_callback};

const BGM_APP_ID: &str = "bgm606669f8b19c14e6e";
const BGM_REDIRECT_URI: &str = "http://127.0.0.1:23380/callback";
const BGM_CALLBACK_PORT: u16 = 23380;
const BGM_CALLBACK_PATH: &str = "/callback";
const BGM_CALLBACK_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Debug, Deserialize)]
struct BgmTokenResponse {
    access_token: String,
    expires_in: i64,
    refresh_token: Option<String>,
}

#[tauri::command]
pub async fn bgm_oauth_start_login(app: AppHandle) -> Result<String, String> {
    let state = generate_oauth_state()?;

    start_oauth_callback(
        app,
        "bgm",
        BGM_CALLBACK_PORT,
        BGM_CALLBACK_PATH,
        BGM_CALLBACK_TIMEOUT,
        state.clone(),
        None,
    )?;

    let mut url = url::Url::parse("https://bgm.tv/oauth/authorize")
        .map_err(|e| format!("构造 BGM 授权地址失败: {}", e))?;
    url.query_pairs_mut()
        .append_pair("client_id", BGM_APP_ID)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", BGM_REDIRECT_URI)
        .append_pair("state", &state);

    Ok(url.to_string())
}

#[tauri::command]
pub async fn bgm_oauth_cancel_login() -> Result<(), String> {
    cancel_oauth_callback(BGM_CALLBACK_PORT, BGM_CALLBACK_PATH)
}

#[tauri::command]
pub async fn bgm_oauth_exchange_code(
    db: State<'_, DatabaseConnection>,
    code: String,
) -> Result<BgmAuth, String> {
    let app_secret = read_bgm_app_secret()?;

    let token_resp = request_token(&serde_json::json!({
        "grant_type": "authorization_code",
        "client_id": BGM_APP_ID,
        "client_secret": app_secret,
        "code": code,
        "redirect_uri": BGM_REDIRECT_URI,
    }))
    .await?;

    let auth = BgmAuth {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token,
        expires_at: Some(Utc::now().timestamp() + token_resp.expires_in),
        username: None,
        nickname: None,
    };

    store_bgm_auth(&db, &auth).await?;
    log::info!("BGM OAuth 授权信息已保存 expires_at={:?}", auth.expires_at);
    Ok(auth)
}

#[tauri::command]
pub async fn bgm_oauth_refresh_token(
    db: State<'_, DatabaseConnection>,
    refresh_token: String,
) -> Result<BgmAuth, String> {
    let app_secret = read_bgm_app_secret()?;

    let token_resp = request_token(&serde_json::json!({
        "grant_type": "refresh_token",
        "client_id": BGM_APP_ID,
        "client_secret": app_secret,
        "refresh_token": refresh_token,
        "redirect_uri": BGM_REDIRECT_URI,
    }))
    .await?;

    let settings = SettingsRepository::get_all_settings(&db)
        .await
        .map_err(|e| format!("获取现有设置失败: {}", e))?;
    let existing = settings.bgm_auth.as_ref();

    let auth = BgmAuth {
        access_token: token_resp.access_token,
        refresh_token: token_resp
            .refresh_token
            .or_else(|| existing.and_then(|auth| auth.refresh_token.clone())),
        expires_at: Some(Utc::now().timestamp() + token_resp.expires_in),
        username: existing.and_then(|auth| auth.username.clone()),
        nickname: existing.and_then(|auth| auth.nickname.clone()),
    };

    store_bgm_auth(&db, &auth).await?;
    log::info!("BGM OAuth 授权信息已刷新 expires_at={:?}", auth.expires_at);
    Ok(auth)
}

fn read_bgm_app_secret() -> Result<String, String> {
    if let Some(value) = option_env!("BGM_APP_SECRET") {
        let value = value.trim().to_string();
        if !value.is_empty() {
            return Ok(value);
        }
    }

    std::env::var("BGM_APP_SECRET")
        .map(|value| value.trim().to_string())
        .ok()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "缺少环境变量 BGM_APP_SECRET".to_string())
}

async fn request_token(body: &serde_json::Value) -> Result<BgmTokenResponse, String> {
    let response = crate::utils::http::get_client()
        .post("https://bgm.tv/oauth/access_token")
        .header("Content-Type", "application/json")
        .body(serde_json::to_vec(body).map_err(|e| format!("序列化请求体失败: {}", e))?)
        .send()
        .await
        .map_err(|e| format!("请求 BGM OAuth 接口失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("BGM OAuth 请求失败 ({}): {}", status, body));
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("读取 BGM OAuth 响应失败: {}", e))?;

    serde_json::from_str(&text).map_err(|e| format!("解析 BGM OAuth 响应失败: {} - {}", e, text))
}

async fn store_bgm_auth(db: &DatabaseConnection, auth: &BgmAuth) -> Result<(), String> {
    let settings = SettingsRepository::get_all_settings(db)
        .await
        .map_err(|e| format!("获取用户记录失败: {}", e))?;

    let mut active: crate::entity::user::ActiveModel = settings.into();
    active.bgm_auth = Set(Some(auth.clone()));
    active
        .update(db)
        .await
        .map_err(|e| format!("保存 BGM 授权信息失败: {}", e))?;

    Ok(())
}
