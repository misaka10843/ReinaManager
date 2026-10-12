//! NextMoe public client 授权，与其它账号统一保存到用户数据库。

use std::sync::{
    OnceLock,
    atomic::{AtomicU64, Ordering},
};
use std::time::{Duration, Instant};

use chrono::Utc;
use sea_orm::{ActiveModelTrait, DatabaseConnection, Set};
use serde::Deserialize;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

use super::shared::{
    cancel_oauth_callback, generate_oauth_state, generate_pkce_pair, start_oauth_callback,
};
use crate::database::repository::settings_repository::SettingsRepository;
use crate::entity::user::NextmoeAuth;

const CLIENT_ID: &str = "741bebbd822505a5e13c13e711fb8801";
const REDIRECT_URI: &str = "http://127.0.0.1:23380/callback/nextmoe";
const CALLBACK_PORT: u16 = 23380;
const CALLBACK_PATH: &str = "/callback/nextmoe";
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);
const AUTHORIZATION_ENDPOINT: &str = "https://account.nextmoe.com/api/v1/oauth/authorize";
const TOKEN_ENDPOINT: &str = "https://account.nextmoe.com/api/v1/oauth/token";
const USERINFO_ENDPOINT: &str = "https://account.nextmoe.com/api/v1/oauth/userinfo";
const SCOPES: &str = "openid profile catalog:read";
const AUTH_EXPIRED: &str = "nextmoe_auth_expired: Kungal 授权已失效，请重新登录";
const STORE_ERROR: &str = "nextmoe_credential_store_error: 保存或读取 Kungal 授权信息失败，请重试";
const LOGIN_CANCELLED: &str = "Kungal 登录已取消或过期，请重新登录";

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    scope: Option<String>,
    token_type: Option<String>,
}

#[derive(Default, Deserialize)]
struct UserInfo {
    sub: Option<String>,
    name: Option<String>,
    picture: Option<String>,
}

struct PendingLogin {
    verifier: String,
    deadline: Instant,
    generation: u64,
}

#[derive(Default)]
struct AuthSession {
    login: Option<PendingLogin>,
    // 轮换后旧 refresh 已失效；写库失败时保留新凭据，下次只重试保存。
    pending_save: Option<NextmoeAuth>,
}

static AUTH_SESSION: OnceLock<Mutex<AuthSession>> = OnceLock::new();
static LOGIN_GENERATION: AtomicU64 = AtomicU64::new(0);

fn auth_session() -> &'static Mutex<AuthSession> {
    AUTH_SESSION.get_or_init(|| Mutex::new(AuthSession::default()))
}

fn login_is_current(generation: u64) -> bool {
    LOGIN_GENERATION.load(Ordering::SeqCst) == generation
}

async fn read_auth(db: &DatabaseConnection) -> Result<Option<NextmoeAuth>, String> {
    SettingsRepository::get_all_settings(db)
        .await
        .map(|settings| settings.nextmoe_auth)
        .map_err(|_| STORE_ERROR.to_string())
}

async fn store_auth(db: &DatabaseConnection, auth: Option<NextmoeAuth>) -> Result<(), String> {
    let settings = SettingsRepository::get_all_settings(db)
        .await
        .map_err(|_| STORE_ERROR.to_string())?;
    let mut active: crate::entity::user::ActiveModel = settings.into();
    active.nextmoe_auth = Set(auth);
    active
        .update(db)
        .await
        .map_err(|_| STORE_ERROR.to_string())?;
    Ok(())
}

fn auth_from_response(
    response: TokenResponse,
    info: UserInfo,
    previous: Option<&NextmoeAuth>,
) -> NextmoeAuth {
    NextmoeAuth {
        access_token: response.access_token,
        refresh_token: Some(response.refresh_token),
        expires_at: Utc::now().timestamp().saturating_add(response.expires_in),
        scope: response.scope.unwrap_or_else(|| {
            previous.map_or_else(|| SCOPES.to_string(), |auth| auth.scope.clone())
        }),
        user_id: info
            .sub
            .or_else(|| previous.and_then(|auth| auth.user_id.clone())),
        name: info
            .name
            .or_else(|| previous.and_then(|auth| auth.name.clone())),
        avatar: info
            .picture
            .or_else(|| previous.and_then(|auth| auth.avatar.clone())),
    }
}

fn require_catalog_scope(auth: &NextmoeAuth) -> Result<(), String> {
    if !auth
        .scope
        .split_whitespace()
        .any(|scope| scope == "catalog:read")
    {
        return Err("nextmoe_scope_required: Kungal 授权缺少 catalog:read，请重新登录".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn nextmoe_oauth_start_login(app: AppHandle) -> Result<String, String> {
    let generation = LOGIN_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let state = generate_oauth_state()?;
    let (verifier, challenge) = generate_pkce_pair()?;
    let mut url = url::Url::parse(AUTHORIZATION_ENDPOINT)
        .map_err(|_| "构造 Kungal 授权地址失败".to_string())?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", CLIENT_ID)
        .append_pair("redirect_uri", REDIRECT_URI)
        .append_pair("scope", SCOPES)
        .append_pair("state", &state)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");
    let mut session = auth_session().lock().await;
    if !login_is_current(generation) {
        return Err(LOGIN_CANCELLED.to_string());
    }
    cancel_oauth_callback(CALLBACK_PORT, CALLBACK_PATH)?;
    start_oauth_callback(
        app,
        "nextmoe",
        CALLBACK_PORT,
        CALLBACK_PATH,
        LOGIN_TIMEOUT,
        state,
        Some(verifier.clone()),
    )?;
    session.login = Some(PendingLogin {
        verifier,
        deadline: Instant::now() + LOGIN_TIMEOUT,
        generation,
    });
    Ok(url.to_string())
}

#[tauri::command]
pub async fn nextmoe_oauth_cancel_login() -> Result<(), String> {
    // 先失效代次，取消不能被在途网络请求持有的锁推迟。
    LOGIN_GENERATION.fetch_add(1, Ordering::SeqCst);
    cancel_oauth_callback(CALLBACK_PORT, CALLBACK_PATH)?;
    auth_session().lock().await.login = None;
    Ok(())
}

#[tauri::command]
pub async fn nextmoe_oauth_exchange_code(
    db: State<'_, DatabaseConnection>,
    code: String,
    code_verifier: String,
) -> Result<NextmoeAuth, String> {
    let login = auth_session()
        .lock()
        .await
        .login
        .take()
        .ok_or_else(|| LOGIN_CANCELLED.to_string())?;
    if login.deadline <= Instant::now()
        || login.verifier != code_verifier
        || code.trim().is_empty()
        || !login_is_current(login.generation)
    {
        return Err(LOGIN_CANCELLED.to_string());
    }
    let response = request_token(
        &[
            ("grant_type", "authorization_code"),
            ("client_id", CLIENT_ID),
            ("code", code.trim()),
            ("redirect_uri", REDIRECT_URI),
            ("code_verifier", &code_verifier),
        ],
        false,
    )
    .await?;
    if !login_is_current(login.generation) {
        return Err(LOGIN_CANCELLED.to_string());
    }
    let info = fetch_user_info(&response.access_token)
        .await
        .unwrap_or_default();
    let auth = auth_from_response(response, info, None);
    require_catalog_scope(&auth)?;
    let mut session = auth_session().lock().await;
    if !login_is_current(login.generation) {
        return Err(LOGIN_CANCELLED.to_string());
    }
    let previous = read_auth(&db).await?;
    store_auth(&db, Some(auth.clone())).await?;
    // 取消若发生在异步写库期间，恢复写入前的账号，不留下后台成功登录。
    if !login_is_current(login.generation) {
        store_auth(&db, previous).await?;
        return Err(LOGIN_CANCELLED.to_string());
    }
    session.pending_save = None;
    Ok(auth)
}

#[tauri::command]
pub async fn nextmoe_oauth_get_auth(
    db: State<'_, DatabaseConnection>,
    force_refresh: Option<bool>,
    expired_access_token: Option<String>,
) -> Result<Option<NextmoeAuth>, String> {
    // 刷新和保存串行；多个 401 只能轮换一次被拒绝的同一份 token。
    let mut session = auth_session().lock().await;
    if let Some(auth) = &session.pending_save {
        store_auth(&db, Some(auth.clone())).await?;
        session.pending_save = None;
    }
    let Some(auth) = read_auth(&db).await? else {
        return Ok(None);
    };
    if auth.access_token.trim().is_empty() {
        return Ok(None);
    }
    let rejected_current = force_refresh.unwrap_or(false)
        && expired_access_token
            .as_deref()
            .is_none_or(|token| token == auth.access_token);
    if auth.expires_at > Utc::now().timestamp() + 60 && !rejected_current {
        require_catalog_scope(&auth)?;
        return Ok(Some(auth));
    }
    let Some(refresh_token) = auth
        .refresh_token
        .as_deref()
        .filter(|token| !token.trim().is_empty())
    else {
        return Err(AUTH_EXPIRED.to_string());
    };
    let response = match request_token(
        &[
            ("grant_type", "refresh_token"),
            ("client_id", CLIENT_ID),
            ("refresh_token", refresh_token),
        ],
        true,
    )
    .await
    {
        Ok(response) => response,
        Err(error) if error == AUTH_EXPIRED => {
            store_auth(&db, None).await?;
            return Err(error);
        }
        Err(error) => return Err(error),
    };
    let updated = auth_from_response(response, UserInfo::default(), Some(&auth));
    session.pending_save = Some(updated.clone());
    store_auth(&db, Some(updated.clone())).await?;
    session.pending_save = None;
    // 即使 scope 异常，也必须先保存已经轮换的新 refresh，不能重新使用旧值。
    require_catalog_scope(&updated)?;
    Ok(Some(updated))
}

#[tauri::command]
pub async fn nextmoe_oauth_logout(db: State<'_, DatabaseConnection>) -> Result<(), String> {
    LOGIN_GENERATION.fetch_add(1, Ordering::SeqCst);
    cancel_oauth_callback(CALLBACK_PORT, CALLBACK_PATH)?;
    let mut session = auth_session().lock().await;
    store_auth(&db, None).await?;
    *session = AuthSession::default();
    Ok(())
}

async fn request_token(params: &[(&str, &str)], is_refresh: bool) -> Result<TokenResponse, String> {
    let response = crate::utils::http::get_client()
        .post(TOKEN_ENDPOINT)
        .timeout(Duration::from_secs(30))
        .form(params)
        .send()
        .await
        .map_err(|_| "请求 Kungal 授权接口失败，请检查网络后重试".to_string())?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|_| "读取 Kungal 授权响应失败，请重试".to_string())?;
    if !status.is_success() {
        let error = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|value| {
                value
                    .get("error")
                    .and_then(|value| value.as_str())
                    .map(str::to_owned)
            });
        if is_refresh
            && (status.as_u16() == 400 || status.as_u16() == 401)
            && error.as_deref() == Some("invalid_grant")
        {
            return Err(AUTH_EXPIRED.to_string());
        }
        return Err(format!(
            "Kungal 授权请求失败（HTTP {}），请重试或重新登录",
            status.as_u16()
        ));
    }
    let token = serde_json::from_str::<TokenResponse>(&body)
        .map_err(|_| "解析 Kungal 授权响应失败，请重新登录".to_string())?;
    if token.access_token.trim().is_empty()
        || token.refresh_token.trim().is_empty()
        || token.expires_in <= 0
        || token
            .token_type
            .as_deref()
            .is_some_and(|kind| !kind.eq_ignore_ascii_case("bearer"))
    {
        return Err("Kungal 授权响应不完整，请重新登录".to_string());
    }
    Ok(token)
}

async fn fetch_user_info(access_token: &str) -> Result<UserInfo, ()> {
    let response = crate::utils::http::get_client()
        .get(USERINFO_ENDPOINT)
        .timeout(Duration::from_secs(10))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| ())?;
    if !response.status().is_success() {
        return Err(());
    }
    let body = response.text().await.map_err(|_| ())?;
    serde_json::from_str(&body).map_err(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refresh_replaces_credentials_and_keeps_profile() {
        let previous = NextmoeAuth {
            access_token: "old".into(),
            refresh_token: Some("old-refresh".into()),
            scope: SCOPES.into(),
            name: Some("name".into()),
            ..Default::default()
        };
        let updated = auth_from_response(
            TokenResponse {
                access_token: "new".into(),
                refresh_token: "new-refresh".into(),
                expires_in: 900,
                scope: None,
                token_type: Some("Bearer".into()),
            },
            UserInfo::default(),
            Some(&previous),
        );
        assert_eq!(updated.refresh_token.as_deref(), Some("new-refresh"));
        assert_eq!(updated.name, previous.name);
        assert!(updated.expires_at > Utc::now().timestamp());
        assert!(require_catalog_scope(&updated).is_ok());
    }

    #[test]
    fn scope_validation_does_not_accept_partial_names() {
        let auth = NextmoeAuth {
            scope: "openid catalog:read-extra".into(),
            ..Default::default()
        };
        assert!(require_catalog_scope(&auth).is_err());
    }

    #[tokio::test]
    async fn credentials_are_saved_and_cleared_in_the_user_database() {
        use sea_orm::{ConnectionTrait, Database};
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.execute_unprepared("CREATE TABLE user (id INTEGER PRIMARY KEY, bgm_auth TEXT, hikarinagi_auth TEXT, nextmoe_auth TEXT, vndb_token TEXT, save_root_path TEXT, db_backup_path TEXT, install_root_path TEXT, le_path TEXT, magpie_path TEXT, default_le_launch BOOLEAN NOT NULL DEFAULT 0, default_magpie BOOLEAN NOT NULL DEFAULT 0);").await.unwrap();
        let auth = NextmoeAuth {
            access_token: "test-access".into(),
            refresh_token: Some("test-refresh".into()),
            expires_at: 123,
            scope: SCOPES.into(),
            ..Default::default()
        };
        store_auth(&db, Some(auth.clone())).await.unwrap();
        assert_eq!(read_auth(&db).await.unwrap(), Some(auth));
        store_auth(&db, None).await.unwrap();
        assert_eq!(read_auth(&db).await.unwrap(), None);
    }
}
