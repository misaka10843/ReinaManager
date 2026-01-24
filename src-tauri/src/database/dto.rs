//! 数据传输对象 (DTO)
//!
//! 用于前后端数据交互的结构定义。
//! 重构后采用单表架构，元数据以 JSON 列形式嵌入 games 表。

use crate::entity::bgm_data::BgmData;
use crate::entity::custom_data::CustomData;
use crate::entity::vndb_data::VndbData;
use crate::entity::ymgal_data::YmgalData;
use serde::{Deserialize, Deserializer, Serialize};

/// 辅助函数：支持 Option<Option<T>> 的反序列化
/// 用于区分"未提供字段"和"显式设为 null"
fn double_option<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

/// 用于插入游戏的数据结构（单表架构）
///
/// 包含所有需要插入的字段，元数据通过 JSON 结构体传入
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InsertGameData {
    // === 外部 ID ===
    pub bgm_id: Option<String>,
    pub vndb_id: Option<String>,
    pub ymgal_id: Option<String>,
    pub id_type: String,

    // === 核心状态 ===
    pub date: Option<String>,
    pub localpath: Option<String>,
    pub savepath: Option<String>,
    pub autosave: Option<i32>,
    pub maxbackups: Option<i32>,
    pub clear: Option<i32>,
    pub le_launch: Option<i32>,
    pub magpie: Option<i32>,

    // === JSON 元数据 ===
    pub vndb_data: Option<VndbData>,
    pub bgm_data: Option<BgmData>,
    pub ymgal_data: Option<YmgalData>,
    pub custom_data: Option<CustomData>,
}

/// 用于更新游戏的数据结构（单表架构）
///
/// 所有字段均为 Option，允许部分更新。
/// 使用 Option<Option<T>> 来区分"未提供"和"设为 null"。
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateGameData {
    // === 外部 ID ===
    #[serde(default, deserialize_with = "double_option")]
    pub bgm_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub vndb_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub ymgal_id: Option<Option<String>>,
    pub id_type: Option<String>,

    // === 核心状态 ===
    #[serde(default, deserialize_with = "double_option")]
    pub date: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub localpath: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub savepath: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub autosave: Option<Option<i32>>,
    #[serde(default, deserialize_with = "double_option")]
    pub maxbackups: Option<Option<i32>>,
    #[serde(default, deserialize_with = "double_option")]
    pub clear: Option<Option<i32>>,
    #[serde(default, deserialize_with = "double_option")]
    pub le_launch: Option<Option<i32>>,
    #[serde(default, deserialize_with = "double_option")]
    pub magpie: Option<Option<i32>>,
    // === JSON 元数据 ===
    #[serde(default, deserialize_with = "double_option")]
    pub vndb_data: Option<Option<VndbData>>,
    #[serde(default, deserialize_with = "double_option")]
    pub bgm_data: Option<Option<BgmData>>,
    #[serde(default, deserialize_with = "double_option")]
    pub ymgal_data: Option<Option<YmgalData>>,
    #[serde(default, deserialize_with = "double_option")]
    pub custom_data: Option<Option<CustomData>>,
}

/// 游戏启动选项
///
/// 前端传递的启动参数，决定是否使用特殊启动方式
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GameLaunchOptions {
    pub le_launch: Option<bool>,
    pub magpie: Option<bool>,
}