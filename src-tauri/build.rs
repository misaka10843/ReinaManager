fn main() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is required"),
    );
    let _ = dotenvy::from_path(manifest_dir.join("../.env"));
    forward_env("BGM_APP_SECRET");
    tauri_build::build()
}

fn forward_env(name: &str) {
    println!("cargo:rerun-if-env-changed={}", name);
    println!("cargo:rerun-if-changed=../.env");

    if let Ok(value) = std::env::var(name) {
        let value = value.trim();
        if !value.is_empty() {
            println!("cargo:rustc-env={}={}", name, value);
        }
    }
}
