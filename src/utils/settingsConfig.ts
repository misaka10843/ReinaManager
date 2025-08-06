import { getDb } from "./database";

// 读取 BGM_TOKEN
export async function getBgmTokenRepository(): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ BGM_TOKEN: string }>(`
    SELECT BGM_TOKEN FROM user WHERE id = 1 LIMIT 1;
  `);
  if (Array.isArray(rows) && rows.length > 0 && typeof rows[0].BGM_TOKEN === 'string') {
    return rows[0].BGM_TOKEN;
  }
  return "";
}

// 保存 BGM_TOKEN，id 固定为 1
export async function setBgmTokenRepository(token: string): Promise<void> {
  const db = await getDb();
  
  // 先尝试更新，如果没有影响行数则插入新记录
  const updateResult = await db.execute(
    "UPDATE user SET BGM_TOKEN = ? WHERE id = 1;",
    [token]
  );
  
  // 如果没有更新任何行，说明记录不存在，需要插入新记录
  if (updateResult.rowsAffected === 0) {
    await db.execute(
      "INSERT INTO user (id, BGM_TOKEN) VALUES (1, ?);",
      [token]
    );
  }
}

export async function getSavePathRepository(): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ save_root_path: string }>(`
    SELECT save_root_path FROM user WHERE id = 1 LIMIT 1;
  `);
  if (Array.isArray(rows) && rows.length > 0 && typeof rows[0].save_root_path === 'string') {
    return rows[0].save_root_path;
  }
  return "";
}

export async function setSavePathRepository(path: string): Promise<void> {
  const db = await getDb();
  
  // 先尝试更新，如果没有影响行数则插入新记录
  const updateResult = await db.execute(
    "UPDATE user SET save_root_path = ? WHERE id = 1;",
    [path]
  );
  
  // 如果没有更新任何行，说明记录不存在，需要插入新记录
  if (updateResult.rowsAffected === 0) {
    await db.execute(
      "INSERT INTO user (id, save_root_path) VALUES (1, ?);",
      [path]
    );
  }
}