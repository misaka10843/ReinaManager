pub mod cloud;
pub mod custom;

pub use cloud::{
    DownloadState, delete_cloud_cache, delete_game_cover_dir, register_game_cover_protocol,
};
