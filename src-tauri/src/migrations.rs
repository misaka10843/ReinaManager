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
        // 迁移 2: 添加自定义字段支持 (2025-09-03)
        Migration {
            version: 2,
            description: "add_custom_fields",
            sql: include_str!("../migrations/002_add_custom_fields.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
