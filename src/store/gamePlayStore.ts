import { create } from 'zustand';
import { isTauri } from '@tauri-apps/api/core';
import { 
  getFormattedGameStats, 
  getGameSessions,
  launchGameWithTracking,
  initGameTimeTracking,
  getGameStatistics
} from '@/utils/gameStats';
import type { GameSession, GameTimeStats } from '@/types';
import { useStore } from '@/store';
import { getLocalDateString } from '@/utils';


interface LaunchGameResult {
  success: boolean;
  message: string;
  process_id?: number;
}

// 游戏实时状态接口
interface GameRealTimeState {
  isRunning: boolean;
  currentSessionMinutes: number;
  currentSessionSeconds: number;
  startTime: number;
  processId?: number;
}

interface GamePlayState {
  runningGameIds: Set<number>;
  isTrackingInitialized: boolean;
  gameTimeStats: Record<string, GameTimeStats>;
  recentSessions: Record<string, GameSession[]>;
  // trendData: Record<string, GameTimeChartData[]>;
  gameRealTimeStates: Record<string, GameRealTimeState>;
  
  // 方法
  isGameRunning: (gameId?: number) => boolean;
  launchGame: (gamePath: string, gameId: number, args?: string[]) => Promise<LaunchGameResult>;
  loadGameStats: (gameId: number, forceRefresh?: boolean) => Promise<GameTimeStats | null>;
  loadRecentSessions: (gameId: number, limit?: number) => Promise<GameSession[] | null>;
  initTimeTracking: () => void;
  clearActiveGame: () => void;
  getGameRealTimeState: (gameId: number) => GameRealTimeState | null;
  getTotalPlayTime: () => Promise<number>;
  getWeekPlayTime: () => Promise<number>;
  getTodayPlayTime: () => Promise<number>;
}

export const useGamePlayStore = create<GamePlayState>((set, get) => ({
  runningGameIds: new Set<number>(),
  isTrackingInitialized: false,
  gameTimeStats: {},
  recentSessions: {},
  trendData: {},
  gameRealTimeStates: {},
  
  isGameRunning: (gameId?: number) => {
    const runningGames = get().runningGameIds;
    if (!gameId) return runningGames.size > 0;
    return runningGames.has(gameId);
  },
  
  getGameRealTimeState: (gameId: number) => {
    const state = get().gameRealTimeStates[gameId];
    return state || null;
  },
  
  launchGame: async (gamePath: string, gameId: number, args?: string[]): Promise<LaunchGameResult> => {
    if (!isTauri()) {
      return { success: false, message: '游戏启动功能仅在桌面应用中可用' };
    }
    
    try {
      if (get().isGameRunning(gameId)) {
        return { success: false, message: '该游戏已在运行中' };
      }
      
      // 添加到运行中游戏列表
      set(state => {
        const newRunningGames = new Set(state.runningGameIds);
        newRunningGames.add(gameId);
        
        // 初始化游戏实时状态
        const newRealTimeStates = {
          ...state.gameRealTimeStates,
          [gameId]: {
            isRunning: true,
            currentSessionMinutes: 0,
            currentSessionSeconds: 0,
            startTime: Math.floor(Date.now() / 1000)
          }
        };
        
        return { 
          runningGameIds: newRunningGames,
          gameRealTimeStates: newRealTimeStates
        };
      });
      
      // 确保初始化了事件监听
      if (!get().isTrackingInitialized) {
        get().initTimeTracking();
      }
      
      const result = await launchGameWithTracking(gamePath, gameId, args);
      
      if (!result.success) {
        // 恢复状态
        set(state => {
          const newRunningGames = new Set(state.runningGameIds);
          newRunningGames.delete(gameId);
          
          const newRealTimeStates = {...state.gameRealTimeStates};
          delete newRealTimeStates[gameId];
          
          return { 
            runningGameIds: newRunningGames,
            gameRealTimeStates: newRealTimeStates
          };
        });
      } else {
        // 更新进程 ID
        set(state => {
          const newRealTimeStates = {
            ...state.gameRealTimeStates,
            [gameId]: {
              ...state.gameRealTimeStates[gameId],
              processId: result.process_id
            }
          };
          return { gameRealTimeStates: newRealTimeStates };
        });
      }
      
      return result;
    } catch (error) {
      // 恢复状态
      set(state => {
        const newRunningGames = new Set(state.runningGameIds);
        newRunningGames.delete(gameId);
        
        const newRealTimeStates = {...state.gameRealTimeStates};
        delete newRealTimeStates[gameId];
        
        return { 
          runningGameIds: newRunningGames,
          gameRealTimeStates: newRealTimeStates
        };
      });
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: errorMessage };
    }
  },
  
  loadGameStats: async (gameId: number, forceRefresh = false): Promise<GameTimeStats | null> => {
    try {
      if (!isTauri()) return null;
      
      // 如果不强制刷新且已有缓存，则使用缓存
      const cached = get().gameTimeStats[gameId];
      if (!forceRefresh && cached) return cached;
      
      // 获取新数据
      const stats = await getFormattedGameStats(gameId);
      
      if (stats) {
        // 更新状态
        set(state => ({
          gameTimeStats: {
            ...state.gameTimeStats,
            [gameId]: stats
          }
        }));
      }
      
      return stats;
    } catch (error) {
      console.error('加载游戏统计失败:', error);
      return null;
    }
  },
  
  loadRecentSessions: async (gameId: number, limit = 5): Promise<GameSession[] | null> => {
    try {
      if (!isTauri()) return null;
      
      // 获取新数据
      const sessions = await getGameSessions(gameId, limit);
      
      // 更新状态
      set(state => ({
        recentSessions: {
          ...state.recentSessions,
          [gameId]: sessions
        }
      }));
      
      return sessions;
    } catch (error) {
      console.error('加载游戏会话失败:', error);
      return null;
    }
  },
  
  initTimeTracking: () => {
    if (!isTauri() || get().isTrackingInitialized) return;
    
    try {
      // 设置事件监听
      const cleanup = initGameTimeTracking(
        // 时间更新回调
        (gameId: number, minutes: number) => {
          // 更新实时游戏状态
          set(state => {
            if (!state.gameRealTimeStates[gameId]) return state;
            
            const totalSeconds = minutes * 60;
            const newMinutes = Math.floor(totalSeconds / 60);
            const newSeconds = totalSeconds % 60;
            
            return {
              gameRealTimeStates: {
                ...state.gameRealTimeStates,
                [gameId]: {
                  ...state.gameRealTimeStates[gameId],
                  currentSessionMinutes: newMinutes,
                  currentSessionSeconds: newSeconds,
                }
              }
            };
          });
        },
        // 会话结束回调
        async (gameId: number, _minutes: number) => {
          // 只清除运行状态
          set(state => {
            const newRunningGames = new Set(state.runningGameIds);
            newRunningGames.delete(gameId);
            
            // 移除对应游戏条目
            const newRealTimeStates = {...state.gameRealTimeStates};
            delete newRealTimeStates[gameId];
            
            return { 
              runningGameIds: newRunningGames,
              gameRealTimeStates: newRealTimeStates
            };
          });
        }
      );
      
      // 设置初始化标志
      set({ isTrackingInitialized: true });
      
      // 添加全局事件清理函数
      window.addEventListener('beforeunload', cleanup);
      
      return cleanup;
    } catch (error) {
      console.error('初始化游戏时间跟踪失败:', error instanceof Error ? error.message : String(error));
    }
  },
  
  clearActiveGame: () => {
    set({ 
      runningGameIds: new Set<number>(),
      gameRealTimeStates: {} 
    });
  },
  getTotalPlayTime: async () => {
    const { games } = useStore.getState();
    let total = 0;
    for (const game of games) {
      if (!game.id) continue;
      const stats = await getGameStatistics(game.id);
      if (stats && typeof stats.total_time === 'number') {
        total += stats.total_time;
      }
    }
    return total;
  },
  getWeekPlayTime: async () => {
    const { games } = useStore.getState();
    let total = 0;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    for (const game of games) {
      if (!game.id) continue;
      const stats = await getGameStatistics(game.id);
      if (stats && Array.isArray(stats.daily_stats)) {
        for (const record of stats.daily_stats) {
          if (record.date && new Date(record.date) >= weekStart) {
            total += record.playtime || 0;
          }
        }
      }
    }
    return total;
  },
  getTodayPlayTime: async () => {
    const { games } = useStore.getState();
    let total = 0;
    const today = getLocalDateString();
    for (const game of games) {
      if (!game.id) continue;
      const stats = await getGameStatistics(game.id);
      if (stats && Array.isArray(stats.daily_stats)) {
        const todayRecord = stats.daily_stats.find((r) => r.date === today);
        if (todayRecord) {
          total += todayRecord.playtime || 0;
        }
      }
    }
    return total;
  },
}));

// 在应用启动时初始化时间跟踪
export const initializeGamePlayTracking = (): void => {
  useGamePlayStore.getState().initTimeTracking();
};