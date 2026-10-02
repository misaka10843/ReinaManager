use reina_path::{RuntimeEnvironment, initialize_environment, runtime_environment};
use tauri::{Context, Wry};

pub fn configure_runtime(context: &mut Context<Wry>) {
    let environment = RuntimeEnvironment::from_development(tauri::is_dev());
    initialize_environment(environment).expect("必须在访问应用数据前初始化运行环境");
    if !environment.is_development() {
        return;
    }

    context.package_info_mut().name.push_str(" Dev");
    let config = context.config_mut();
    config.identifier = environment.identifier().into();
    if let Some(name) = &mut config.product_name {
        name.push_str(" Dev");
    }
    for window in &mut config.app.windows {
        window.title.push_str(" [Dev]");
    }
}

#[tauri::command]
pub fn is_development() -> bool {
    runtime_environment().is_development()
}
