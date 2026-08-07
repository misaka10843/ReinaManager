//! 解析 Steam 客户端的二进制 `appinfo.vdf`（v40/v41 格式），建立 appid 名称索引。
//!
//! `appinfo.vdf` 与文本格式 `.acf` 不同，是 Valve 专有二进制 KeyValues 格式：
//!
//! - 文件头：`u32 magic` + `u32 universe`，v41 额外含 `i64 string_table_offset`。
//! - App 记录：`u32 appid`、`u32 size`（= 固定字段 + VDF blob，不含 appid/size 自身）、
//!   60 字节固定字段（info_state/last_updated/pics_token/sha1/change_number/binary_sha1）、
//!   之后是二进制 KV blob。记录重复直到 `appid == 0`（文件尾）。
//! - v41 引入字符串表（位于文件头偏移处）：`u32 count` + count 个 null-terminated UTF-8
//!   字符串；KV 节点中的 key 为 u32 字符串表索引，**字符串值仍内联 null-terminated UTF-8**。
//! - KV 节点：`u8 type` + key + value。类型：0x00 Dict（递归）、0x01 String、
//!   0x02 Int32、0x03 Float32、0x04 Pointer、0x05 WString（UTF-16 LE）、0x06 Color、
//!   0x07 UInt64、0x08 End of dict、0x0A Int64。
//!
//! 解析结果按 文件路径 + mtime + size 缓存（`OnceLock<RwLock<_>>`），避免重复解析
//! 100-200MB 的大文件。
//! Todo 注意！此解析方法可能会因为steam更新vdf导致失败，所以还需要追踪steam的改变

use crate::game::steam::find_steam_root;
use parking_lot::RwLock;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::SystemTime;

/// v40（2022-12 起）：magic 小端字节为 `28 44 56 07`
const MAGIC_V40: u32 = 0x0756_4428;
/// v41（2024-06 起）：magic 小端字节为 `29 44 56 07`，引入字符串表
const MAGIC_V41: u32 = 0x0756_4429;

/// info_state(4) + last_updated(4) + pics_token(8) + sha1_text(20) + change_number(4) + sha1_binary(20)
const RECORD_FIXED_SIZE: usize = 60;


#[derive(Clone, Debug, Serialize)]
pub struct AppInfoEntry {
    pub appid: u32,
    pub name: Option<String>,
    pub app_type: Option<String>,
    pub oslist: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub release_date: Option<String>,
    pub aliases: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AppInfoStatus {
    pub steam_path: Option<String>,
    pub appinfo_path: Option<String>,
    pub exists: bool,
    pub size: Option<u64>,
    pub modified_at: Option<u64>,
    pub version: Option<u32>,
}

#[derive(Clone)]
struct AppInfoIndex {
    path: PathBuf,
    modified: Option<SystemTime>,
    size: u64,
    version: u32,
    apps: Vec<AppInfoEntry>,
}

static APPINFO_INDEX: OnceLock<RwLock<Option<AppInfoIndex>>> = OnceLock::new();

fn index_lock() -> &'static RwLock<Option<AppInfoIndex>> {
    APPINFO_INDEX.get_or_init(|| RwLock::new(None))
}

struct ByteReader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> ByteReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    fn read_u8(&mut self) -> Result<u8, String> {
        let value = *self
            .data
            .get(self.pos)
            .ok_or_else(|| format!("unexpected end of data at offset {}", self.pos))?;
        self.pos += 1;
        Ok(value)
    }

    fn read_u32(&mut self) -> Result<u32, String> {
        let bytes = self
            .data
            .get(self.pos..self.pos + 4)
            .ok_or_else(|| format!("unexpected end of data at offset {}", self.pos))?;
        self.pos += 4;
        Ok(u32::from_le_bytes(bytes.try_into().unwrap()))
    }

    fn read_u64(&mut self) -> Result<u64, String> {
        let bytes = self
            .data
            .get(self.pos..self.pos + 8)
            .ok_or_else(|| format!("unexpected end of data at offset {}", self.pos))?;
        self.pos += 8;
        Ok(u64::from_le_bytes(bytes.try_into().unwrap()))
    }

    fn read_i64(&mut self) -> Result<i64, String> {
        Ok(self.read_u64()? as i64)
    }

    fn read_f32(&mut self) -> Result<f32, String> {
        let bytes = self
            .data
            .get(self.pos..self.pos + 4)
            .ok_or_else(|| format!("unexpected end of data at offset {}", self.pos))?;
        self.pos += 4;
        Ok(f32::from_le_bytes(bytes.try_into().unwrap()))
    }

    fn read_cstring(&mut self) -> Result<String, String> {
        let start = self.pos;
        while self.pos < self.data.len() && self.data[self.pos] != 0 {
            self.pos += 1;
        }
        if self.pos >= self.data.len() {
            return Err(format!("unterminated string at offset {start}"));
        }
        let raw = &self.data[start..self.pos];
        self.pos += 1; // 跳过 \0
        String::from_utf8(raw.to_vec())
            .map_err(|_| format!("invalid utf-8 string at offset {start}"))
    }

    fn read_wide_cstring(&mut self) -> Result<String, String> {
        let start = self.pos;
        while self.pos + 1 < self.data.len()
            && !(self.data[self.pos] == 0 && self.data[self.pos + 1] == 0)
        {
            self.pos += 2;
        }
        if self.pos + 1 >= self.data.len() {
            return Err(format!("unterminated wide string at offset {start}"));
        }
        let units: Vec<u16> = self.data[start..self.pos]
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect();
        self.pos += 2; // 跳过 \0\0
        String::from_utf16(&units)
            .map_err(|_| format!("invalid utf-16 string at offset {start}"))
    }

    fn skip(&mut self, count: usize) -> Result<(), String> {
        self.pos = self
            .pos
            .checked_add(count)
            .filter(|end| *end <= self.data.len())
            .ok_or_else(|| format!("skip beyond end of data at offset {}", self.pos))?;
        Ok(())
    }
}

#[derive(Debug)]
enum KvValue {
    Object(Vec<(String, KvValue)>),
    String(String),
    Int32(i32),
    Float32,
    Pointer,
    WideString(String),
    Color,
    UInt64(u64),
    Int64(i64),
}

impl KvValue {
    fn as_string(&self) -> Option<String> {
        match self {
            KvValue::String(value) | KvValue::WideString(value) => Some(value.clone()),
            KvValue::Int32(value) => Some(value.to_string()),
            KvValue::Int64(value) => Some(value.to_string()),
            KvValue::UInt64(value) => Some(value.to_string()),
            _ => None,
        }
    }
}

struct KvParser<'a> {
    reader: ByteReader<'a>,
    strings: Option<&'a [String]>,
    uses_string_table: bool,
}

impl<'a> KvParser<'a> {
    fn new(data: &'a [u8], strings: Option<&'a [String]>, version: u32) -> Self {
        Self {
            reader: ByteReader::new(data),
            strings,
            uses_string_table: version >= 41,
        }
    }

    fn read_key(&mut self) -> Result<String, String> {
        if self.uses_string_table {
            let index = self.reader.read_u32()? as usize;
            let table = self
                .strings
                .ok_or_else(|| "v41 文件缺少字符串表".to_string())?;
            table
                .get(index)
                .cloned()
                .ok_or_else(|| format!("字符串表索引 {index} 越界"))
        } else {
            self.reader.read_cstring()
        }
    }

    fn parse_object(&mut self) -> Result<Vec<(String, KvValue)>, String> {
        let mut items = Vec::new();
        loop {
            let field_type = self.reader.read_u8()?;
            match field_type {
                0x00 => {
                    let key = self.read_key()?;
                    let children = self.parse_object()?;
                    items.push((key, KvValue::Object(children)));
                }
                0x01 => {
                    let key = self.read_key()?;
                    let value = self.reader.read_cstring()?;
                    items.push((key, KvValue::String(value)));
                }
                0x02 => {
                    let key = self.read_key()?;
                    let value = self.reader.read_u32()? as i32;
                    items.push((key, KvValue::Int32(value)));
                }
                0x03 => {
                    let key = self.read_key()?;
                    let _value = self.reader.read_f32()?;
                    items.push((key, KvValue::Float32));
                }
                0x04 => {
                    let key = self.read_key()?;
                    let _value = self.reader.read_u32()?;
                    items.push((key, KvValue::Pointer));
                }
                0x05 => {
                    let key = self.read_key()?;
                    let value = self.reader.read_wide_cstring()?;
                    items.push((key, KvValue::WideString(value)));
                }
                0x06 => {
                    let key = self.read_key()?;
                    let _value = self.reader.read_u32()?;
                    items.push((key, KvValue::Color));
                }
                0x07 => {
                    let key = self.read_key()?;
                    let value = self.reader.read_u64()?;
                    items.push((key, KvValue::UInt64(value)));
                }
                0x0A => {
                    let key = self.read_key()?;
                    let value = self.reader.read_u64()? as i64;
                    items.push((key, KvValue::Int64(value)));
                }
                0x08 | 0x09 => break,
                other => {
                    return Err(format!("未知 KV 节点类型 {other:#04x}"));
                }
            }
        }
        Ok(items)
    }
}

fn parse_appinfo(data: &[u8]) -> Result<(u32, Vec<AppInfoEntry>), String> {
    let mut reader = ByteReader::new(data);
    let magic = reader.read_u32()?;
    let version = match magic {
        MAGIC_V41 => 41,
        MAGIC_V40 => 40,
        other => return Err(format!("未知 appinfo.vdf magic {other:#08x}")),
    };
    let _universe = reader.read_u32()?;

    let string_table_offset = if version >= 41 {
        let offset = reader.read_i64()?;
        if offset <= 0 {
            return Err("appinfo.vdf 字符串表偏移无效".to_string());
        }
        Some(offset as usize)
    } else {
        None
    };

    let strings: Vec<String> = if let Some(offset) = string_table_offset {
        if offset >= data.len() {
            return Err("appinfo.vdf 字符串表偏移越界".to_string());
        }
        let mut table_reader = ByteReader::new(&data[offset..]);
        let count = table_reader.read_u32()? as usize;
        let mut table = Vec::with_capacity(count.min(1_000_000));
        for _ in 0..count {
            table.push(table_reader.read_cstring()?);
        }
        table
    } else {
        Vec::new()
    };

    let record_end = string_table_offset
        .map(|offset| offset.saturating_sub(4))
        .unwrap_or(data.len());

    let mut entries = Vec::new();
    loop {
        let appid = reader.read_u32()?;
        if appid == 0 {
            break;
        }
        if reader.pos + 4 > record_end {
            return Err("appinfo.vdf 记录超出边界".to_string());
        }
        let size = reader.read_u32()? as usize;
        if size < RECORD_FIXED_SIZE {
            return Err(format!("appid {appid} 记录大小异常 {size}"));
        }
        let record_start = reader.pos;
        reader.skip(RECORD_FIXED_SIZE)?;
        let blob_len = size - RECORD_FIXED_SIZE;
        if reader.pos + blob_len > record_end {
            return Err(format!("appid {appid} 记录超出文件边界"));
        }
        let blob = &data[reader.pos..reader.pos + blob_len];
        let mut parser = KvParser::new(blob, Some(&strings), version);
        let root = parser.parse_object()?;
        entries.push(extract_entry(appid, &root));
        reader.pos = record_start + size;
    }

    Ok((version, entries))
}

fn find_section<'a>(
    root: &'a [(String, KvValue)],
    name: &str,
) -> Option<&'a [(String, KvValue)]> {
    for (key, value) in root {
        let KvValue::Object(children) = value else {
            continue;
        };
        if key == name {
            return Some(children);
        }
        if key == "appinfo" {
            if let Some(found) = find_section(children, name) {
                return Some(found);
            }
        }
    }
    None
}

fn extract_entry(appid: u32, root: &[(String, KvValue)]) -> AppInfoEntry {
    let mut name = None;
    let mut app_type = None;
    let mut oslist = None;
    let mut developer = None;
    let mut publisher = None;
    let mut release_date = None;
    let mut aliases = None;

    if let Some(children) = find_section(root, "common") {
        for (key, value) in children {
            match key.as_str() {
                "name" => name = value.as_string(),
                "type" => app_type = value.as_string(),
                "oslist" => oslist = value.as_string(),
                "steam_release_date" => release_date = value.as_string(),
                _ => {}
            }
        }
    }
    if let Some(children) = find_section(root, "extended") {
        for (key, value) in children {
            match key.as_str() {
                "developer" => developer = value.as_string(),
                "publisher" => publisher = value.as_string(),
                "aliases" => aliases = value.as_string(),
                _ => {}
            }
        }
    }

    AppInfoEntry {
        appid,
        name,
        app_type,
        oslist,
        developer,
        publisher,
        release_date,
        aliases,
    }
}

fn load_index() -> Result<AppInfoIndex, String> {
    let steam_root = find_steam_root()?;
    let path = steam_root.join("appcache").join("appinfo.vdf");
    let metadata = fs::metadata(&path)
        .map_err(|_| "未找到 appinfo.vdf，请先运行 Steam 客户端以生成该文件".to_string())?;
    let modified = metadata.modified().ok();
    let size = metadata.len();

    let lock = index_lock();
    let mut guard = lock.write();
    if let Some(index) = guard.as_ref() {
        if index.path == path && index.size == size && index.modified == modified {
            return Ok(index.clone());
        }
    }

    let data = fs::read(&path).map_err(|error| format!("读取 appinfo.vdf 失败: {error}"))?;
    let (version, apps) = parse_appinfo(&data)?;
    let index = AppInfoIndex {
        path,
        modified,
        size,
        version,
        apps,
    };
    *guard = Some(index.clone());
    Ok(index)
}

pub fn search_appinfo(query: &str, limit: usize) -> Result<Vec<AppInfoEntry>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let index = load_index()?;
    let needle = query.to_lowercase();
    let mut matches: Vec<&AppInfoEntry> = index
        .apps
        .iter()
        .filter(|entry| {
            entry
                .name
                .as_deref()
                .is_some_and(|name| name.to_lowercase().contains(&needle))
        })
        .collect();
    matches.sort_by_key(|entry| {
        !entry
            .name
            .as_deref()
            .is_some_and(|name| name.to_lowercase().starts_with(&needle))
    });
    matches.truncate(limit);
    Ok(matches.into_iter().cloned().collect())
}

pub fn get_appinfo(appid: u32) -> Result<Option<AppInfoEntry>, String> {
    let index = load_index()?;
    Ok(index.apps.iter().find(|entry| entry.appid == appid).cloned())
}

pub fn appinfo_status() -> AppInfoStatus {
    let steam_path = find_steam_root().ok();
    let appinfo_path = steam_path
        .as_ref()
        .map(|root| root.join("appcache").join("appinfo.vdf"));
    let (exists, size, modified_at, version) = match appinfo_path.as_ref() {
        Some(path) if path.is_file() => {
            let metadata = fs::metadata(path).ok();
            let modified_at = metadata
                .as_ref()
                .and_then(|meta| meta.modified().ok())
                .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs());
            let version = index_lock().read().as_ref().map(|index| index.version);
            (
                true,
                metadata.map(|meta| meta.len()),
                modified_at,
                version,
            )
        }
        _ => (false, None, None, None),
    };
    AppInfoStatus {
        steam_path: steam_path.map(|path| path.to_string_lossy().to_string()),
        appinfo_path: appinfo_path.map(|path| path.to_string_lossy().to_string()),
        exists,
        size,
        modified_at,
        version,
    }
}

#[tauri::command]
pub fn search_steam_appinfo(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<AppInfoEntry>, String> {
    search_appinfo(&query, limit.unwrap_or(8))
}

#[tauri::command]
pub fn get_steam_appinfo(appid: u32) -> Result<Option<AppInfoEntry>, String> {
    get_appinfo(appid)
}

#[tauri::command]
pub fn get_steam_appinfo_status() -> AppInfoStatus {
    appinfo_status()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_v40_fixture() -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(&MAGIC_V40.to_le_bytes());
        out.extend_from_slice(&1u32.to_le_bytes()); // universe

        let mut blob = Vec::new();
        // root: appinfo { ... }
        blob.push(0x00);
        blob.extend_from_slice(b"appinfo\0");
        blob.push(0x02);
        blob.extend_from_slice(b"appid\0");
        blob.extend_from_slice(&730u32.to_le_bytes());
        blob.push(0x00);
        blob.extend_from_slice(b"common\0");
        blob.push(0x01);
        blob.extend_from_slice(b"name\0");
        blob.extend_from_slice(b"Counter-Strike 2\0");
        blob.push(0x01);
        blob.extend_from_slice(b"type\0");
        blob.extend_from_slice(b"game\0");
        blob.push(0x08);
        blob.push(0x00);
        blob.extend_from_slice(b"extended\0");
        blob.push(0x01);
        blob.extend_from_slice(b"developer\0");
        blob.extend_from_slice(b"Valve\0");
        blob.push(0x01);
        blob.extend_from_slice(b"aliases\0");
        blob.extend_from_slice(b"csgo, cs2\0");
        blob.push(0x08);
        blob.push(0x08);
        blob.push(0x08);

        let size = RECORD_FIXED_SIZE + blob.len();
        out.extend_from_slice(&730u32.to_le_bytes());
        out.extend_from_slice(&(size as u32).to_le_bytes());
        out.extend_from_slice(&[0u8; RECORD_FIXED_SIZE]);
        out.extend_from_slice(&blob);
        out.extend_from_slice(&0u32.to_le_bytes()); // footer
        out
    }

    fn build_v41_fixture() -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(&MAGIC_V41.to_le_bytes());
        out.extend_from_slice(&1u32.to_le_bytes()); // universe
        let offset_pos = out.len();
        out.extend_from_slice(&0u64.to_le_bytes()); // string table offset 占位

        let keys = ["appinfo", "appid", "common", "name", "type", "extended", "developer", "aliases"];
        let mut blob = Vec::new();
        // root: appinfo { ... }
        blob.push(0x00);
        blob.extend_from_slice(&0u32.to_le_bytes()); // "appinfo"
        blob.push(0x02);
        blob.extend_from_slice(&1u32.to_le_bytes()); // "appid"
        blob.extend_from_slice(&730u32.to_le_bytes());
        blob.push(0x00);
        blob.extend_from_slice(&2u32.to_le_bytes()); // "common"
        blob.push(0x01);
        blob.extend_from_slice(&3u32.to_le_bytes()); // "name"
        blob.extend_from_slice(b"Counter-Strike 2\0");
        blob.push(0x01);
        blob.extend_from_slice(&4u32.to_le_bytes()); // "type"
        blob.extend_from_slice(b"game\0");
        blob.push(0x08);
        blob.push(0x00);
        blob.extend_from_slice(&5u32.to_le_bytes()); // "extended"
        blob.push(0x01);
        blob.extend_from_slice(&6u32.to_le_bytes()); // "developer"
        blob.extend_from_slice(b"Valve\0");
        blob.push(0x01);
        blob.extend_from_slice(&7u32.to_le_bytes()); // "aliases"
        blob.extend_from_slice(b"csgo, cs2\0");
        blob.push(0x08);
        blob.push(0x08);
        blob.push(0x08);

        let size = RECORD_FIXED_SIZE + blob.len();
        out.extend_from_slice(&730u32.to_le_bytes());
        out.extend_from_slice(&(size as u32).to_le_bytes());
        out.extend_from_slice(&[0u8; RECORD_FIXED_SIZE]);
        out.extend_from_slice(&blob);
        out.extend_from_slice(&0u32.to_le_bytes()); // footer

        let table_offset = out.len();
        out.extend_from_slice(&(keys.len() as u32).to_le_bytes());
        for key in keys {
            out.extend_from_slice(key.as_bytes());
            out.push(0);
        }
        let offset_bytes = (table_offset as u64).to_le_bytes();
        out[offset_pos..offset_pos + 8].copy_from_slice(&offset_bytes);
        out
    }

    #[test]
    fn parses_v40() {
        let (version, entries) = parse_appinfo(&build_v40_fixture()).unwrap();
        assert_eq!(version, 40);
        assert_eq!(entries.len(), 1);
        let entry = &entries[0];
        assert_eq!(entry.appid, 730);
        assert_eq!(entry.name.as_deref(), Some("Counter-Strike 2"));
        assert_eq!(entry.app_type.as_deref(), Some("game"));
        assert_eq!(entry.developer.as_deref(), Some("Valve"));
        assert_eq!(entry.aliases.as_deref(), Some("csgo, cs2"));
    }

    #[test]
    fn parses_v41() {
        let (version, entries) = parse_appinfo(&build_v41_fixture()).unwrap();
        assert_eq!(version, 41);
        assert_eq!(entries.len(), 1);
        let entry = &entries[0];
        assert_eq!(entry.appid, 730);
        assert_eq!(entry.name.as_deref(), Some("Counter-Strike 2"));
        assert_eq!(entry.app_type.as_deref(), Some("game"));
        assert_eq!(entry.developer.as_deref(), Some("Valve"));
        assert_eq!(entry.aliases.as_deref(), Some("csgo, cs2"));
    }

    #[test]
    fn parses_real_appinfo_when_present() {
        let path = r"C:\Program Files (x86)\Steam\appcache\appinfo.vdf";
        let Ok(data) = std::fs::read(path) else {
            return;
        };
        let (version, entries) = parse_appinfo(&data).expect("real appinfo.vdf parse");
        assert!(version == 40 || version == 41);
        assert!(!entries.is_empty());
        let named = entries.iter().filter(|entry| entry.name.is_some()).count();
        assert!(
            named > 0,
            "expected at least one named entry, got {named}/{}",
            entries.len()
        );
        let aliased = entries
            .iter()
            .filter(|entry| entry.aliases.is_some())
            .count();
        assert!(
            aliased > 0,
            "expected at least one aliased entry, got {aliased}/{}",
            entries.len()
        );
    }

    #[test]
    fn rejects_unknown_magic() {
        let mut data = build_v40_fixture();
        data[0] = 0xFF;
        assert!(parse_appinfo(&data).is_err());
    }

    #[test]
    fn rejects_truncated_record() {
        let mut data = build_v40_fixture();
        data.truncate(data.len() - 8);
        assert!(parse_appinfo(&data).is_err());
    }
}
