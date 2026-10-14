//! NextMoe OAuth 授权模块。
//!
//! NextMoe 使用授权码 + 强制 PKCE S256；public client 不保存 client secret。
//! 令牌端点返回裸 RFC 6749 响应，没有 `data` 外壳。

use std::time::Duration;

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, DatabaseConnection, Set};
use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::database::repository::settings_repository::SettingsRepository;
use crate::entity::user::NextmoeAuth;
use crate::oauth::shared::{
    cancel_oauth_callback, generate_oauth_state, generate_pkce_pair, start_oauth_callback,
};

const NEXTMOE_CLIENT_ID: &str = "73842f8fcc537a51eb8e35a1f693e3da";
const NEXTMOE_REDIRECT_URI: &str = "http://127.0.0.1:23381/callback";
const NEXTMOE_CALLBACK_PORT: u16 = 23381;
const NEXTMOE_CALLBACK_PATH: &str = "/callback";
const NEXTMOE_CALLBACK_TIMEOUT: Duration = Duration::from_secs(300);
const NEXTMOE_AUTHORIZATION_ENDPOINT: &str = "https://account.nextmoe.com/api/v1/oauth/authorize";
const NEXTMOE_TOKEN_ENDPOINT: &str = "https://account.nextmoe.com/api/v1/oauth/token";
const NEXTMOE_SCOPES: &str = "openid profile catalog:read";
const NEXTMOE_DEFAULT_EXPIRES_IN: i64 = 900;

#[derive(Debug, Deserialize)]
struct NextmoeTokenResponse {
    access_token: String,
    expires_in: Option<i64>,
    refresh_token: Option<String>,
    scope: Option<String>,
}

/// 本地解码 JWT 载荷，仅用于显示登录身份，不验签、不参与安全判断。
fn decode_jwt_claims(token: &str) -> Option<serde_json::Value> {
    let payload = token.split('.').nth(1)?;
    let bytes = URL_SAFE_NO_PAD.decode(payload).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn read_identity(access_token: &str) -> (Option<String>, Option<String>) {
    let Some(claims) = decode_jwt_claims(access_token) else {
        return (None, None);
    };

    let user_id = claims
        .get("sub")
        .and_then(|value| match value {
            serde_json::Value::String(text) => Some(text.clone()),
            serde_json::Value::Number(number) => Some(number.to_string()),
            _ => None,
        })
        .filter(|value| !value.is_empty());

    let name = ["name", "preferred_username", "nickname"]
        .iter()
        .find_map(|key| claims.get(*key).and_then(|value| value.as_str()))
        .map(str::to_string)
        .filter(|value| !value.is_empty());

    (user_id, name)
}

#[tauri::command]
pub async fn nextmoe_oauth_start_login(app: AppHandle) -> Result<String, String> {
    let state = generate_oauth_state()?;
    let (code_verifier, code_challenge) = generate_pkce_pair()?;

    start_oauth_callback(
        app,
        "nextmoe",
        NEXTMOE_CALLBACK_PORT,
        NEXTMOE_CALLBACK_PATH,
        NEXTMOE_CALLBACK_TIMEOUT,
        state.clone(),
        Some(code_verifier),
    )?;

    let mut url = url::Url::parse(NEXTMOE_AUTHORIZATION_ENDPOINT)
        .map_err(|error| format!("构造 NextMoe 授权地址失败: {error}"))?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", NEXTMOE_CLIENT_ID)
        .append_pair("redirect_uri", NEXTMOE_REDIRECT_URI)
        .append_pair("scope", NEXTMOE_SCOPES)
        .append_pair("state", &state)
        .append_pair("code_challenge", &code_challenge)
        .append_pair("code_challenge_method", "S256");

    Ok(url.to_string())
}

#[tauri::command]
pub async fn nextmoe_oauth_exchange_code(
    db: State<'_, DatabaseConnection>,
    code: String,
    code_verifier: String,
) -> Result<NextmoeAuth, String> {
    let token_response = request_token(&[
        ("grant_type", "authorization_code"),
        ("client_id", NEXTMOE_CLIENT_ID),
        ("code", code.trim()),
        ("redirect_uri", NEXTMOE_REDIRECT_URI),
        ("code_verifier", code_verifier.trim()),
    ])
    .await?;

    let (user_id, name) = read_identity(&token_response.access_token);
    let auth = NextmoeAuth {
        expires_at: Some(
            Utc::now().timestamp()
                + token_response
                    .expires_in
                    .unwrap_or(NEXTMOE_DEFAULT_EXPIRES_IN),
        ),
        access_token: token_response.access_token,
        refresh_token: token_response.refresh_token,
        user_id,
        name,
        scope: token_response
            .scope
            .or_else(|| Some(NEXTMOE_SCOPES.to_string())),
    };

    store_nextmoe_auth(&db, &auth).await?;
    log::info!(
        "NextMoe OAuth 授权信息已保存 expires_at={:?}",
        auth.expires_at
    );
    Ok(auth)
}

#[tauri::command]
pub async fn nextmoe_oauth_cancel_login() -> Result<(), String> {
    cancel_oauth_callback(NEXTMOE_CALLBACK_PORT, NEXTMOE_CALLBACK_PATH)
}

#[tauri::command]
pub async fn nextmoe_oauth_refresh_token(
    db: State<'_, DatabaseConnection>,
    refresh_token: String,
) -> Result<NextmoeAuth, String> {
    let token_response = request_token(&[
        ("grant_type", "refresh_token"),
        ("client_id", NEXTMOE_CLIENT_ID),
        ("refresh_token", refresh_token.trim()),
    ])
    .await?;

    let settings = SettingsRepository::get_all_settings(&db)
        .await
        .map_err(|error| format!("获取现有设置失败: {error}"))?;
    let existing = settings.nextmoe_auth.as_ref();
    let (user_id, name) = read_identity(&token_response.access_token);
    let auth = NextmoeAuth {
        expires_at: Some(
            Utc::now().timestamp()
                + token_response
                    .expires_in
                    .unwrap_or(NEXTMOE_DEFAULT_EXPIRES_IN),
        ),
        access_token: token_response.access_token,
        refresh_token: token_response
            .refresh_token
            .or_else(|| existing.and_then(|auth| auth.refresh_token.clone())),
        user_id: user_id.or_else(|| existing.and_then(|auth| auth.user_id.clone())),
        name: name.or_else(|| existing.and_then(|auth| auth.name.clone())),
        scope: token_response
            .scope
            .or_else(|| existing.and_then(|auth| auth.scope.clone())),
    };

    store_nextmoe_auth(&db, &auth).await?;
    log::info!(
        "NextMoe OAuth 授权信息已刷新 expires_at={:?}",
        auth.expires_at
    );
    Ok(auth)
}

async fn request_token(params: &[(&str, &str)]) -> Result<NextmoeTokenResponse, String> {
    let response = crate::utils::http::get_client()
        .post(NEXTMOE_TOKEN_ENDPOINT)
        .form(params)
        .send()
        .await
        .map_err(|error| format!("请求 NextMoe OAuth 接口失败: {error}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("读取 NextMoe OAuth 响应失败: {error}"))?;
    if !status.is_success() {
        return Err(format!("NextMoe OAuth 请求失败 ({status}): {text}"));
    }

    let token_response: NextmoeTokenResponse = serde_json::from_str(&text)
        .map_err(|error| format!("解析 NextMoe OAuth token 失败: {error} - {text}"))?;
    if token_response.access_token.trim().is_empty() {
        return Err("NextMoe OAuth 响应缺少 access_token".to_string());
    }

    Ok(token_response)
}

async fn store_nextmoe_auth(db: &DatabaseConnection, auth: &NextmoeAuth) -> Result<(), String> {
    let settings = SettingsRepository::get_all_settings(db)
        .await
        .map_err(|error| format!("获取用户记录失败: {error}"))?;

    let mut active: crate::entity::user::ActiveModel = settings.into();
    active.nextmoe_auth = Set(Some(auth.clone()));
    active
        .update(db)
        .await
        .map_err(|error| format!("保存 NextMoe 授权信息失败: {error}"))?;

    Ok(())
}
