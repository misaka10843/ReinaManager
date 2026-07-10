use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub enum ResolvedLocalPath {
    Unset,
    Missing {
        raw_path: PathBuf,
    },
    File {
        executable_path: PathBuf,
        game_dir: PathBuf,
    },
    Directory {
        game_dir: PathBuf,
    },
}

#[derive(Debug, Clone)]
pub enum GameLaunchTarget {
    NormalExecutable {
        executable_path: PathBuf,
        /// 普通启动两者相同；未来 Steam / 外部启动器可能需要不同的工作目录和检测目录。
        working_dir: PathBuf,
        detection_dir: PathBuf,
    },
    DirectoryOnly {
        game_dir: PathBuf,
    },
    MissingLocalPath,
    MissingPath {
        raw_path: PathBuf,
    },
}

pub fn resolve_local_path(localpath: Option<&str>) -> ResolvedLocalPath {
    let Some(raw_path) = localpath.map(str::trim).filter(|value| !value.is_empty()) else {
        return ResolvedLocalPath::Unset;
    };

    let path = PathBuf::from(raw_path);
    let Ok(metadata) = std::fs::metadata(&path) else {
        return ResolvedLocalPath::Missing { raw_path: path };
    };

    if metadata.is_dir() {
        return ResolvedLocalPath::Directory { game_dir: path };
    }

    let game_dir = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    ResolvedLocalPath::File {
        executable_path: path,
        game_dir,
    }
}

pub fn resolve_launch_target(localpath: Option<&str>) -> GameLaunchTarget {
    match resolve_local_path(localpath) {
        ResolvedLocalPath::Unset => GameLaunchTarget::MissingLocalPath,
        ResolvedLocalPath::Missing { raw_path } => GameLaunchTarget::MissingPath { raw_path },
        ResolvedLocalPath::Directory { game_dir } => GameLaunchTarget::DirectoryOnly { game_dir },
        ResolvedLocalPath::File {
            executable_path,
            game_dir,
        } => GameLaunchTarget::NormalExecutable {
            executable_path,
            working_dir: game_dir.clone(),
            detection_dir: game_dir,
        },
    }
}

pub fn resolve_game_directory(localpath: &str) -> Result<PathBuf, String> {
    match resolve_local_path(Some(localpath)) {
        ResolvedLocalPath::Unset => Err("路径未设置".to_string()),
        ResolvedLocalPath::Missing { raw_path } => {
            Err(format!("路径不存在: {}", raw_path.display()))
        }
        ResolvedLocalPath::File { game_dir, .. } | ResolvedLocalPath::Directory { game_dir } => {
            Ok(game_dir)
        }
    }
}
