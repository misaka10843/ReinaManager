import Database  from '@tauri-apps/plugin-sql';
import { exists, BaseDirectory,mkdir,remove,copyFile } from '@tauri-apps/plugin-fs';

let check=true;
let dbInstance: Database | null = null;

export async function initDatabase() {
    // 检查数据库目录并创建（包括父目录）
    if (!await exists('data', { baseDir: BaseDirectory.AppData })) {
      await mkdir('data', { 
        baseDir: BaseDirectory.AppData, 
        recursive: true  // recursive确保所有父目录也被创建
      });
      console.log("已创建数据目录");
    }

const existdb= await exists('data/reina_manager.db', { baseDir: BaseDirectory.AppData });
  if(!existdb){
    const db = await Database.load('sqlite:data/reina_manager.db');
    createTable(db);
  }
  
// 加载 SQLite 数据库，如果不存在则会自动创建
  const db = await Database.load('sqlite:data/reina_manager.db');

  if(check&&(!await checkDatabaseStructure(db))){
    resetDatabase();
    await createTable(db);
  }
  
  return db;
}

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await initDatabase();
  }
  return dbInstance;
}

export async function backupDatabase(): Promise<string> {
  // 生成带时间戳的备份文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `reina_manager_${timestamp}.db`;
  const backupPath = `data/backups/${backupName}`;
  
  try {
    // 确保备份目录存在
    await mkdir('data/backups', { baseDir: BaseDirectory.AppData, recursive: true });
    
    // 关闭当前连接
    if (dbInstance) {
      await dbInstance.close();
      dbInstance = null;
    }
    
    // 复制数据库文件
    await copyFile(
      'data/reina_manager.db', 
      backupPath, 
      { fromPathBaseDir: BaseDirectory.AppData ,
      toPathBaseDir: BaseDirectory.AppData}
    );
    
    console.log(`数据库已备份到: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('备份数据库失败:', error);
    throw error;
  }
}

// 2. 重置数据库函数
export async function resetDatabase(): Promise<void> {
  try {
    // 先备份当前数据库
    await backupDatabase();
    
    // 关闭连接
    if (dbInstance) {
      await dbInstance.close();
      dbInstance = null;
    }
    
    // 删除当前数据库
    await remove('data/reina_manager.db', { baseDir: BaseDirectory.AppData });
    
    // 重新初始化，会创建全新数据库

    dbInstance = await initDatabase();
    console.log('数据库已重置');
  } catch (error) {
    console.error('重置数据库失败:', error);
    throw error;
  }
}

// 检查数据库表结构
async function checkDatabaseStructure(db: Database): Promise<boolean> {
  check=false;
  try {
    // 定义预期表结构
    const requiredColumns = {
      'games': [
        'id', 'bgm_id', 'vndb_id','id_type', 'date', 'image', 'summary', 'name', 
        'name_cn', 'tags', 'rank', 'score', 'time', 'localpath', 
        'developer', 'all_titles', 'aveage_hours', 'clear'
      ],
      'user': [
        'id', 'BGM_TOKEN'
      ],
      // 添加新表的列检查
      'game_sessions': [
        'session_id', 'game_id', 'start_time', 'end_time', 'duration', 'date'
      ],
      'game_statistics': [
        'game_id',  'total_time', 'session_count', 'last_played', 'daily_stats'
      ]
    };
    
    // 检查每个表结构
    for (const [tableName, columns] of Object.entries(requiredColumns)) {
      // 检查表是否存在
      const tableExists = await db.select<{count: number}[]>(
        `SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=?;`,
        [tableName]
      );
      
      if (tableExists[0].count === 0) {
        console.log(`表 ${tableName} 不存在`);
        return false;
      }
      
      // 获取表的列信息
      const tableInfo = await db.select<{name: string}[]>(`PRAGMA table_info(${tableName});`);
      const existingColumns = tableInfo.map(col => col.name);
      
      // 检查是否有缺失的列
      for (const column of columns) {
        if (!existingColumns.includes(column)) {
          console.log(`表 ${tableName} 缺少列: ${column}`);
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('检查数据库结构时出错:', error);
    return false;
  }
}

const createTable=async(db:Database)=>{
  // 创建存储游戏数据的表，注意将 tags 以 JSON 字符串形式存储
  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bgm_id TEXT,
      vndb_id TEXT,
      id_type TEXT NOT NULL,
      date TEXT,
      image TEXT,
      summary TEXT,
      name TEXT,
      name_cn TEXT,
      tags TEXT,
      rank INTEGER,
      score REAL,
      time TEXT,
      localpath TEXT,
      developer TEXT,
      all_titles TEXT,
      aveage_hours REAL,
      clear INTEGER DEFAULT 0
    );
  `);

  // 创建 user 表，仅存储一条记录，用于保存 BGM_TOKEN
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY,
      BGM_TOKEN TEXT
    );
  `);

  // 游戏会话表 - 记录每次游戏会话
  await db.execute(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      session_id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      date TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(game_id) REFERENCES games(id)
    );
  `);
  
  // 游戏统计表 - 存储聚合数据
  await db.execute(`
    CREATE TABLE IF NOT EXISTS game_statistics (
      game_id INTEGER PRIMARY KEY,
      total_time INTEGER DEFAULT 0,
      session_count INTEGER DEFAULT 0,
      last_played INTEGER,
      daily_stats TEXT DEFAULT '{}',
      FOREIGN KEY(game_id) REFERENCES games(id)
    );
  `);
}