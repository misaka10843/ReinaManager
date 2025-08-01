-- 迁移 1: 数据库升级支持
-- 版本: 1
-- 描述: 为现有数据库添加缺失的列和表，用于升级旧版本数据库

-- ========================================
-- 数据库升级支持（添加缺失的列和表）
-- ========================================

-- 为现有games表添加可能缺失的列（忽略已存在的错误）
ALTER TABLE games ADD COLUMN savepath TEXT;
ALTER TABLE games ADD COLUMN autosave INTEGER DEFAULT 0;

-- 为现有user表添加可能缺失的列
ALTER TABLE user ADD COLUMN save_root_path TEXT;

-- 创建可能缺失的新表（如果不存在）
CREATE TABLE IF NOT EXISTS savedata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    file TEXT NOT NULL,
    backup_time INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY(game_id) REFERENCES games(id)
);

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_games_autosave ON games(autosave);
CREATE INDEX IF NOT EXISTS idx_savedata_game_id ON savedata(game_id);
CREATE INDEX IF NOT EXISTS idx_savedata_backup_time ON savedata(backup_time);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_date ON game_sessions(date);
