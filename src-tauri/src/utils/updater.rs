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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviousInstallation {
    previous_directory: String,
    current_directory: String,
}

#[tauri::command]
pub fn inspect_update_installation(
    webview: Webview,
) -> Result<Option<PreviousInstallation>, String> {
    if super::runtime::is_development() || reina_path::is_portable_mode() {
        return Ok(None);
    }
    #[cfg(target_os = "windows")]
    {
        use tauri::utils::config::BundleType;
        use windows::Win32::System::Registry::{RRF_SUBKEY_WOW6432KEY, RRF_SUBKEY_WOW6464KEY};

        let name = match tauri::utils::platform::bundle_type() {
            Some(BundleType::Msi) => "InstallDir",
            Some(BundleType::Nsis) => "",
            _ => return Ok(None),
        };
        let executable = std::env::current_exe().map_err(|error| error.to_string())?;
        let config = webview.app_handle().config();
        let key = format!(
            r"Software\{}\{}",
            config.bundle.publisher.as_deref().unwrap_or("huoshen80"),
            config.product_name.as_deref().unwrap_or("ReinaManager"),
        );
        for view in [RRF_SUBKEY_WOW6464KEY, RRF_SUBKEY_WOW6432KEY] {
            match read_registered_update_directory(&key, name, view) {
                Ok(Some(directory)) => {
                    if let Some(notice) =
                        previous_installation(&executable, std::path::Path::new(&directory))
                    {
                        log::warn!(
                            "更新前检测到旧目录仍有程序：旧目录={}，本次更新目录={}",
                            notice.previous_directory,
                            notice.current_directory,
                        );
                        return Ok(Some(notice));
                    }
                }
                Ok(None) => {}
                Err(error) => log::warn!("读取旧安装目录失败：{error}"),
            }
        }
        Ok(None)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = webview;
        Ok(None)
    }
}

#[cfg(target_os = "windows")]
fn read_registered_update_directory(
    key: &str,
    name: &str,
    view: windows::Win32::System::Registry::REG_ROUTINE_FLAGS,
) -> Result<Option<String>, String> {
    use windows::{
        Win32::{
            Foundation::ERROR_FILE_NOT_FOUND,
            System::Registry::{
                HKEY_CURRENT_USER, RRF_RT_REG_EXPAND_SZ, RRF_RT_REG_SZ, RegGetValueW,
            },
        },
        core::{HSTRING, PCWSTR},
    };

    let key = HSTRING::from(key);
    let name = HSTRING::from(name);
    let mut buffer = vec![0_u16; 32_768];
    let mut bytes = (buffer.len() * std::mem::size_of::<u16>()) as u32;
    // SAFETY: 字符串在调用期间存活并以 NUL 结尾；缓冲区对齐且容量与 bytes 一致。
    // 预定义 HKCU 句柄仅借用，不需要关闭；只在调用成功并核对返回长度后解码。
    let result = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(key.as_ptr()),
            PCWSTR(name.as_ptr()),
            RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ | view,
            None,
            Some(buffer.as_mut_ptr().cast()),
            Some(&mut bytes),
        )
    };
    if result == ERROR_FILE_NOT_FOUND {
        return Ok(None);
    }
    if result.is_err() {
        return Err(format!("Windows 注册表错误 {}", result.0));
    }
    if !bytes.is_multiple_of(2) || bytes as usize > buffer.len() * 2 {
        return Err("安装路径记录长度无效".into());
    }
    buffer.truncate(bytes as usize / 2);
    let length = buffer
        .iter()
        .position(|&character| character == 0)
        .unwrap_or(buffer.len());
    String::from_utf16(&buffer[..length])
        .map(Some)
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn previous_installation(
    executable: &std::path::Path,
    registered_directory: &std::path::Path,
) -> Option<PreviousInstallation> {
    let current = executable.parent()?;
    if !registered_directory.is_absolute() {
        return None;
    }
    // 只检查登记的旧位置；规范化目录用于排除大小写、尾部斜杠或目录别名造成的误报。
    let previous = registered_directory.canonicalize().ok()?;
    if previous == current.canonicalize().ok()? || !previous.join(executable.file_name()?).is_file()
    {
        return None;
    }
    Some(PreviousInstallation {
        previous_directory: registered_directory.to_string_lossy().into_owned(),
        current_directory: current.to_string_lossy().into_owned(),
    })
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

    #[test]
    fn notice_only_checks_the_registered_previous_executable() {
        let parent = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".local/frontend-tests");
        let directory = parent.join("update-installation-notice");
        assert!(!directory.exists());
        let current = directory.join("当前目录 with spaces");
        let previous = directory.join("旧目录");
        // 当前 EXE 无须再次检查，检测只依赖已知的运行路径和旧目录中的文件。
        let executable = current.join("ReinaManager.exe");
        let result = (|| -> std::io::Result<Vec<Option<(String, String)>>> {
            std::fs::create_dir_all(&current)?;
            std::fs::create_dir_all(&previous)?;
            let check = |path: &Path| {
                super::previous_installation(&executable, path)
                    .map(|notice| (notice.previous_directory, notice.current_directory))
            };
            let mut result = vec![check(&previous)];
            std::fs::write(previous.join("ReinaManager.exe"), "old-program")?;
            result.push(check(&previous));
            result.push(check(&current));
            result.push(check(Path::new("relative-directory")));
            std::fs::remove_file(previous.join("ReinaManager.exe"))?;
            result.push(check(&previous));
            std::fs::create_dir(previous.join("ReinaManager.exe"))?;
            result.push(check(&previous));
            Ok(result)
        })();
        assert!(directory.starts_with(&parent));
        std::fs::remove_dir_all(&directory).unwrap();
        assert_eq!(
            result.unwrap(),
            vec![
                None,
                Some((
                    previous.to_string_lossy().into_owned(),
                    current.to_string_lossy().into_owned()
                )),
                None,
                None,
                None,
                None,
            ]
        );
    }

    #[test]
    fn registry_reader_preserves_unicode_and_handles_missing_values() {
        use windows::{
            Win32::System::Registry::*,
            core::{HSTRING, Owned, PCWSTR, w},
        };

        struct Cleanup(HSTRING);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                // SAFETY: 路径由本测试生成并确认是新建键，删除范围仅限本次测试命名空间。
                let _ = unsafe { RegDeleteTreeW(HKEY_CURRENT_USER, PCWSTR(self.0.as_ptr())) };
            }
        }
        let path = format!(
            r"Software\ReinaUpdateNoticeVerification{}",
            std::process::id()
        );
        let wide_path = HSTRING::from(&path);
        let mut key = HKEY::default();
        let mut disposition = REG_CREATE_KEY_DISPOSITION::default();
        // SAFETY: 路径以 NUL 结尾且持续存活，两个输出指针指向有效的栈上变量。
        unsafe {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(wide_path.as_ptr()),
                None,
                PCWSTR::null(),
                REG_OPTION_NON_VOLATILE,
                KEY_READ | KEY_WRITE,
                None,
                &mut key,
                Some(&mut disposition),
            )
        }
        .ok()
        .unwrap();
        // SAFETY: 创建成功后的句柄由当前测试唯一拥有，Owned 在退出时关闭句柄。
        let key = unsafe { Owned::new(key) };
        assert_eq!(disposition, REG_CREATED_NEW_KEY);
        let _cleanup = Cleanup(wide_path);
        let view = if std::mem::size_of::<usize>() == 8 {
            RRF_SUBKEY_WOW6464KEY
        } else {
            RRF_SUBKEY_WOW6432KEY
        };
        assert!(
            super::read_registered_update_directory(&path, "InstallDir", view)
                .unwrap()
                .is_none()
        );
        let expected = "D:\\旧目录 with spaces\\";
        let bytes: Vec<u8> = expected
            .encode_utf16()
            .chain([0])
            .flat_map(u16::to_ne_bytes)
            .collect();
        // SAFETY: 句柄有效，名称以 NUL 结尾，数据切片包含完整的 UTF-16 字符串与终止符。
        unsafe { RegSetValueExW(*key, w!("InstallDir"), None, REG_SZ, Some(&bytes)) }
            .ok()
            .unwrap();
        assert_eq!(
            super::read_registered_update_directory(&path, "InstallDir", view)
                .unwrap()
                .as_deref(),
            Some(expected)
        );
        // SAFETY: 与上面的写入相同；空名称仅用于本测试键的默认值。
        unsafe { RegSetValueExW(*key, PCWSTR::null(), None, REG_SZ, Some(&bytes)) }
            .ok()
            .unwrap();
        assert_eq!(
            super::read_registered_update_directory(&path, "", view)
                .unwrap()
                .as_deref(),
            Some(expected)
        );
    }
}
