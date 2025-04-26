import { listen } from '@tauri-apps/api/event';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getDb } from './database';
import type { GameSession, GameStatistics, GameTimeStats } from '../types';
import { formatPlayTime,getLocalDateString } from '@/utils';

// 类型定义
export type TimeUpdateCallback = (gameId: number, minutes: number) => void;
export type SessionEndCallback = (gameId: number, minutes: number) => void;

// 记录游戏会话 - 直接使用内部ID
export async function recordGameSession(
  gameId: number, // 改为number类型
  minutes: number, 
  startTime: number, 
  endTime: number,
): Promise<number> {
  const db = await getDb();
  
  // 当前日期，格式YYYY-MM-DD
  const date = getLocalDateString(endTime);
  
  try {
    // 插入游戏会话记录
    const result = await db.execute(
      `INSERT INTO game_sessions (
        game_id, start_time, end_time, duration, date
      ) VALUES (?, ?, ?, ?, ?);`,
      [gameId, startTime, endTime, minutes, date],
    );
    
    // 更新统计信息
    await updateGameStatistics(gameId);
    
    return result.lastInsertId ?? -1;
  } catch (error) {
    console.error('记录游戏会话失败:', error);
    throw error;
  }
}

// 更新游戏统计信息函数 - 优化版
export async function updateGameStatistics(gameId: number): Promise<void> {
  const db = await getDb();
  
  try {
    // 1. 获取现有统计数据，保留实时更新积累的数据
    const existingStats = await db.select<{
      total_time: number;
      session_count: number;
      last_played: number | null;
      daily_stats: string;
    }[]>(`SELECT total_time, session_count, last_played, daily_stats 
           FROM game_statistics WHERE game_id = ?;`, [gameId]);
    
    // 2. 获取最新的会话数据
    const sessions = await db.select<{
      id: number;
      start_time: number;
      end_time: number;
      duration: number;
    }[]>(`
      SELECT session_id as id, start_time, end_time, duration
      FROM game_sessions 
      WHERE game_id = ?;
    `, [gameId]);
    
    // 3. 计算基础统计信息（总时间、会话数等）
    const stats = {
      total_time: sessions.reduce((sum, session) => sum + session.duration, 0),
      session_count: sessions.length,
      last_played: sessions.length > 0 
        ? Math.max(...sessions.map(s => s.end_time)) 
        : null
    };
    
    // 4. 处理每日统计数据 - 从会话数据中计算
    const sessionsStatsMap = new Map<string, number>();
    
    // 处理每个会话，正确分配跨天时间
    for (const session of sessions) {
      // 使用本地日期字符串
      const startDateStr = getLocalDateString(session.start_time);
      const endDateStr = getLocalDateString(session.end_time);
      
      // 检测是否跨天
      const startDate = new Date(session.start_time * 1000);
      const endDate = new Date(session.end_time * 1000);
      const isSameDay = 
        startDate.getFullYear() === endDate.getFullYear() && 
        startDate.getMonth() === endDate.getMonth() && 
        startDate.getDate() === endDate.getDate();
      
      if (isSameDay) {
        // 同一天，直接添加时间
        const currentValue = sessionsStatsMap.get(startDateStr) || 0;
        sessionsStatsMap.set(startDateStr, currentValue + session.duration);
      } else {
        // 跨天情况，按比例分配时间
        const totalSeconds = session.end_time - session.start_time;
        
        // 计算午夜时间点
        const midnight = new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          0, 0, 0
        );
        const midnightTimestamp = Math.floor(midnight.getTime() / 1000);
        
        // 计算第一天和第二天的秒数
        const firstDaySeconds = midnightTimestamp - session.start_time;
        // const secondDaySeconds = session.end_time - midnightTimestamp;
        
        // 按比例分配分钟数
        const firstDayMinutes = Math.round((firstDaySeconds / totalSeconds) * session.duration);
        const secondDayMinutes = session.duration - firstDayMinutes;
        
        // 添加到对应日期
        const firstDayValue = sessionsStatsMap.get(startDateStr) || 0;
        sessionsStatsMap.set(startDateStr, firstDayValue + firstDayMinutes);
        
        const secondDayValue = sessionsStatsMap.get(endDateStr) || 0;
        sessionsStatsMap.set(endDateStr, secondDayValue + secondDayMinutes);
      }
    }

// 5. 合并现有统计和会话统计
const today = getLocalDateString();
let dailyStats: Array<{date: string; playtime: number}> = [];

// 解析现有的每日统计数据
if (existingStats.length > 0 && existingStats[0].daily_stats) {
  try {
    // 确保解析出的数据是预期的格式
    const parsed = JSON.parse(existingStats[0].daily_stats);
    
    // 验证解析出的数据是否是数组
    if (Array.isArray(parsed)) {
      dailyStats = parsed;
    } else if (typeof parsed === 'object') {
      // 处理可能是对象格式的情况
      dailyStats = Object.entries(parsed).map(([date, playtime]) => ({
        date,
        playtime: typeof playtime === 'number' ? playtime : 0
      }));
    }
  } catch (e) {
    console.error('解析游戏统计数据失败:', e);
    // 确保错误时也有一个有效的空数组
    dailyStats = [];
  }
}

// 确保即使没有会话数据时，也能创建今天的记录
if (sessionsStatsMap.size === 0 && !dailyStats.some(item => item.date === today)) {
  // 如果没有会话数据且今天没有记录，添加一个初始记录
  dailyStats.push({ date: today, playtime: 0 });
}
    
    // 根据会话数据更新统计
    for (const [date, playtime] of sessionsStatsMap.entries()) {
      // 查找现有数据中是否有这一天
      const existingIndex = dailyStats.findIndex(item => item.date === date);
      
      if (existingIndex >= 0) {
        // 如果是今天的数据，保留现有数据中可能包含的实时更新记录
        if (date === today) {
          // 如果实时统计已经记录了时间，检查是否超过从会话计算的时间
          const realTimePlaytime = dailyStats[existingIndex].playtime;
          const sessionPlaytime = playtime;
          
          // 选择较大的值，确保不会减少已经记录的时间
          dailyStats[existingIndex].playtime = Math.max(realTimePlaytime, sessionPlaytime);
        } else {
          // 非今天的数据使用从会话计算的时间
          dailyStats[existingIndex].playtime = playtime;
        }
      } else {
        // 不存在这一天的记录，添加新记录
        dailyStats.push({ date, playtime });
      }
    }
    
    // 6. 按日期降序排序
    dailyStats.sort((a, b) => b.date.localeCompare(a.date));
    
    // 7. 更新统计表
    await db.execute(
      `REPLACE INTO game_statistics 
       (game_id, total_time, session_count, last_played, daily_stats)
       VALUES (?, ?, ?, ?, ?);`,
      [
        gameId,
        stats.total_time || 0,
        stats.session_count || 0,
        stats.last_played || null,
        JSON.stringify(dailyStats),
      ]
    );
  } catch (error) {
    console.error('更新游戏统计失败:', error);
    throw error;
  }
}

// 获取游戏统计信息 - 直接使用内部ID
export async function getGameStatistics(gameId: number): Promise<GameStatistics | null> {
  const db = await getDb();
  
  const stats = await db.select<GameStatistics[]>(
    'SELECT * FROM game_statistics WHERE game_id = ?;',
    [gameId],
  );
  
  if (stats.length === 0) {
    return null;
  }
  
  const result = stats[0];
  
  // 解析JSON存储的每日统计数据
  if (typeof result.daily_stats === 'string') {
    try {
      const parsedStats = JSON.parse(result.daily_stats);
       
        result.daily_stats = parsedStats;
      
    } catch (e) {
      console.error('解析游戏统计数据失败:', e);
      result.daily_stats = [];
    }
  }
  
  return result;
}

// 获取今天的游戏时间 - 直接使用内部ID
export async function getTodayGameTime(gameId: number): Promise<number> {
  const stats = await getGameStatistics(gameId);
  const today = getLocalDateString();
  
  if (!stats || !stats.daily_stats) {
    return 0;
  }
  // 在数组中查找今天的记录
  const todayRecord = stats.daily_stats.find(record => record.date === today);
  return todayRecord?.playtime || 0;
}

// 获取游戏会话历史 - 直接使用内部ID
export async function getGameSessions(
  gameId: number,
  limit = 10, 
  offset = 0,
): Promise<GameSession[]> {
  const db = await getDb();
  
  const sessions = await db.select<GameSession[]>(
    `
    SELECT * FROM game_sessions
    WHERE game_id = ?
    ORDER BY start_time DESC
    LIMIT ? OFFSET ?;
    `,
    [gameId, limit, offset],
  );
  
  return sessions;
}

export async function getFormattedGameStats(gameId: number): Promise<GameTimeStats> {
  const stats = await getGameStatistics(gameId);
  const todayMinutes = await getTodayGameTime(gameId);
  
  // 确保 daily_stats 始终是有效数组
  let dailyStats = stats?.daily_stats || [];
  
  // 如果不是数组，进行转换
  if (!Array.isArray(dailyStats)) {
    if (typeof dailyStats === 'object') {
      dailyStats = Object.entries(dailyStats).map(([date, playtime]) => ({
        date, 
        playtime: typeof playtime === 'number' ? playtime : 0
      }));
    } else {
      dailyStats = [];
    }
  }
  
  // 确保今天有记录
  const today = getLocalDateString();
  if (!dailyStats.some(item => item.date === today)) {
    dailyStats.unshift({ date: today, playtime: todayMinutes || 0 });
  }
  
  return {
    totalPlayTime: formatPlayTime(stats?.total_time || 0),
    totalMinutes: stats?.total_time || 0,
    todayPlayTime: formatPlayTime(todayMinutes),
    todayMinutes,
    sessionCount: stats?.session_count || 0,
    lastPlayed: stats?.last_played ? new Date(stats.last_played * 1000) : null,
    daily_stats: dailyStats,
  };
}

// 初始化游戏时间跟踪
export function initGameTimeTracking(
  onTimeUpdate?: TimeUpdateCallback,
  onSessionEnd?: SessionEndCallback,
): () => void {
  if (!isTauri()) return () => {};

  // 游戏会话开始
// 游戏会话开始
const unlistenStart = listen<{gameId: number; processId: number; startTime: number}>(
  'game-session-started',
  async (event) => {
    const { gameId } = event.payload;
    
    try {
      // 只记录游戏启动，不增加会话计数
      console.log(`游戏 ${gameId} 开始运行`);
      
      // 检查是否需要创建初始记录
      const db = await getDb();
      const stats = await db.select<{count: number}[]>(
        'SELECT COUNT(*) as count FROM game_statistics WHERE game_id = ?;',
        [gameId]
      );
      
      if (stats[0].count === 0) {
        // 如果没有统计记录，创建一个初始记录（但session_count为0）
        await db.execute(
          `INSERT INTO game_statistics 
           (game_id, total_time, session_count, daily_stats)
           VALUES (?, 0, 0, ?);`,
          [
            gameId,
            JSON.stringify([])
          ]
        );
      }
    } catch (error) {
      console.error('游戏启动记录失败:', error);
    }
  }
);

// 游戏时间更新事件监听
const unlistenUpdate = listen<{gameId: number; totalSeconds: number; processId: number}>(
  'game-time-update',
  async (event) => {
    const { gameId, totalSeconds } = event.payload;
    const totalMinutes = Math.floor(totalSeconds / 60);
    
    try {
      // 只记录游戏正在运行，不更新统计数据
      console.log(`游戏 ${gameId} 正在运行，已运行 ${totalMinutes} 分钟`);
      
      // 调用回调函数通知前端
      if (onTimeUpdate) {
        onTimeUpdate(gameId, totalMinutes);
      }
    } catch (error) {
      console.error('处理游戏时间更新失败:', error);
    }
  }
);


// 修改游戏会话结束事件监听器
const unlistenEnd = listen<{gameId: number; totalMinutes: number; totalSeconds: number; startTime: number; endTime: number; processId: number}>(
  'game-session-ended',
  async (event) => {
    const { gameId, totalMinutes, totalSeconds, startTime, endTime } = event.payload;
    
    try {
      console.log('收到游戏会话结束事件:', event.payload);
      
      // 设置最低阈值为60秒，避免意外点击记录游戏时间
      const minThresholdSeconds = 60;
      
      if (totalSeconds < minThresholdSeconds) {
        console.log(`游戏会话时间过短(${totalSeconds}秒)，不记录统计数据`);
        
        // 虽然不记录统计数据，但仍然需要通知前端游戏已结束
        if (onSessionEnd) {
          onSessionEnd(gameId, 0);
        }
        
        return; // 不记录时间太短的会话
      }
      
      // 使用实际游戏时间，不强制最小值
      const minutesToRecord = totalMinutes;
      
      // 记录游戏会话
      await recordGameSession(gameId, minutesToRecord, startTime, endTime);
      
      // 调用回调函数
      if (onSessionEnd) {
        onSessionEnd(gameId, minutesToRecord);
      }
    } catch (error) {
      console.error('处理游戏结束事件失败:', error);
      
      if (onSessionEnd) {
        onSessionEnd(gameId, 0);
      }
    }
  }
);

  // 返回清理函数
  return () => {
    unlistenStart.then(fn => fn());
    unlistenUpdate.then(fn => fn());
    unlistenEnd.then(fn => fn());
  };
}

// 启动游戏并开始监控
export async function launchGameWithTracking(
  gamePath: string, 
  gameId: number,  // 改为number类型
  args?: string[],
): Promise<{success: boolean; message: string; process_id?: number}> {
  try {
    const result = await invoke<{success: boolean; message: string; process_id?: number}>('launch_game', { 
      gamePath, 
      gameId,  
      args: args || [],
    });
    
    return result;
  } catch (error) {
    const errorMessage = typeof error === 'string' ? error : 'Unknown error occurred';
    throw new Error(errorMessage);
  }
}