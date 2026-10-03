use std::time::Duration;

use serde::Serialize;
use tauri::{Manager, ResourceId, Webview};
use tauri_plugin_updater::UpdaterExt;

/// 保留官方 Update 资源，前端继续复用插件的下载、验签、安装和资源回收。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    rid: ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

#[tauri::command]
pub async fn check_app_update(
    webview: Webview,
    timeout: Option<u64>,
    proxy: Option<String>,
) -> Result<Option<UpdateMetadata>, String> {
    if super::runtime::is_development() {
        return Ok(None);
    }

    let mut builder = webview.updater_builder();
    if let Some(timeout) = timeout {
        builder = builder.timeout(Duration::from_millis(timeout));
    }
    if let Some(proxy) = proxy {
        builder = builder.proxy(url::Url::parse(&proxy).map_err(|error| error.to_string())?);
    }

    #[cfg(target_os = "windows")]
    {
        let executable = std::env::current_exe().map_err(|error| error.to_string())?;
        let portable = reina_path::is_portable_mode();
        let (target, arguments) = windows_update_plan(
            tauri::utils::platform::bundle_type(),
            portable,
            std::env::consts::ARCH,
            &executable,
        )?;
        // 显式选择类型，避免缺少专用条目时回退到另一种安装器。
        builder = builder
            .target(target)
            .clear_installer_args()
            .installer_args(arguments);
    }

    let update = builder
        .build()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?;
    let Some(update) = update else {
        return Ok(None);
    };

    let metadata = UpdateMetadata {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        date: update
            .raw_json
            .get("pub_date")
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned),
        body: update.body.clone(),
        raw_json: update.raw_json.clone(),
        rid: webview.resources_table().add(update),
    };
    Ok(Some(metadata))
}

#[cfg(target_os = "windows")]
fn windows_update_plan(
    bundle: Option<tauri::utils::config::BundleType>,
    portable: bool,
    arch: &str,
    executable: &std::path::Path,
) -> Result<(String, Vec<String>), String> {
    use tauri::utils::config::BundleType;

    let directory = executable
        .parent()
        .filter(|directory| directory.is_absolute() && directory.parent().is_some())
        .and_then(std::path::Path::to_str)
        .filter(|directory| !directory.contains(['"', '\r', '\n', '\0']))
        .ok_or_else(|| "无法为当前程序目录生成更新参数".to_string())?;
    let arch = match arch {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        "x86" => "i686",
        _ => return Err("当前架构不支持 Windows 自动更新".into()),
    };

    // 便携目录优先于二进制的打包标记：ZIP 中的 EXE 可能带有最后一次打包的类型。
    let (kind, arguments) = if portable {
        (
            "nsis",
            vec![
                "/REINAPORTABLE".into(),
                "/S".into(),
                format!("/D={directory}"),
            ],
        )
    } else {
        match bundle {
            Some(BundleType::Msi) => ("msi", vec![format!("REINA_UPDATEDIR=\"{directory}\"")]),
            // /D 必须保持为最后一个参数，路径即使含空格也不能加引号。
            Some(BundleType::Nsis) => ("nsis", vec![format!("/D={directory}")]),
            _ => return Err("无法识别安装类型，请使用安装包修复安装或启用便携模式".into()),
        }
    };
    Ok((format!("windows-{arch}-{kind}"), arguments))
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::windows_update_plan;
    use std::path::Path;
    use tauri::utils::config::BundleType;

    #[test]
    fn moved_installs_use_the_running_directory() {
        let executable = Path::new(r"D:\新目录 with spaces\ReinaManager.exe");
        let (target, arguments) =
            windows_update_plan(Some(BundleType::Msi), false, "x86_64", executable).unwrap();
        assert_eq!(target, "windows-x86_64-msi");
        assert_eq!(arguments, ["REINA_UPDATEDIR=\"D:\\新目录 with spaces\""]);
        let (target, arguments) =
            windows_update_plan(Some(BundleType::Nsis), false, "aarch64", executable).unwrap();
        assert_eq!(target, "windows-aarch64-nsis");
        assert_eq!(arguments, [r"/D=D:\新目录 with spaces"]);
    }

    #[test]
    fn portable_mode_overrides_installer_markers() {
        for bundle in [None, Some(BundleType::Msi), Some(BundleType::Nsis)] {
            let (target, arguments) = windows_update_plan(
                bundle,
                true,
                "x86",
                Path::new(r"D:\便携包\ReinaManager.exe"),
            )
            .unwrap();
            assert_eq!(target, "windows-i686-nsis");
            assert_eq!(arguments, ["/REINAPORTABLE", "/S", r"/D=D:\便携包"]);
        }
    }

    #[test]
    fn unknown_installations_and_invalid_paths_do_not_fall_back_to_msi() {
        assert!(windows_update_plan(None, false, "x86_64", Path::new(r"D:\App\app.exe")).is_err());
        for path in [r"app.exe", r"D:\app.exe", "D:\\bad\"name\\app.exe"] {
            assert!(
                windows_update_plan(Some(BundleType::Msi), false, "x86_64", Path::new(path))
                    .is_err()
            );
        }
    }
}
