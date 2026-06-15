use std::path::Path;

use tauri::http::{Response, StatusCode};

pub fn infer_image_extension(url: &str) -> Option<String> {
    let url_without_suffix = url.split(['?', '#']).next().unwrap_or(url);
    let file_name = url_without_suffix
        .rsplit('/')
        .next()
        .unwrap_or(url_without_suffix);

    file_name
        .rsplit_once('.')
        .map(|(_, ext)| ext.trim().to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
}

pub fn content_type_for_extension(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

pub fn content_type_for_file(path: &Path) -> &'static str {
    content_type_for_extension(
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase())
            .as_deref()
            .unwrap_or(""),
    )
}

pub fn make_image_response(
    bytes: Vec<u8>,
    content_type: &str,
    cache_control: &str,
) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", content_type)
        .header("Cache-Control", cache_control)
        .header("Access-Control-Allow-Origin", "*")
        .body(bytes)
        .expect("failed to build image response")
}

pub fn make_status_response(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(Vec::new())
        .expect("failed to build status response")
}
