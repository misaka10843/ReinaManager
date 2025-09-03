use tauri_plugin_sql::{Migration, MigrationKind};

/// 获取所有数据库迁移
/// 从版本0开始重置迁移系统
pub fn get_migrations() -> Vec<Migration> {
    vec![
        // 迁移 1: 数据库重置和完整初始化 (2025-09-03)
        Migration {
            version: 1,
            description: "database_initialization",
            sql: include_str!("../migrations/001_database_initialization.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
