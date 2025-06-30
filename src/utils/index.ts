import { open } from '@tauri-apps/plugin-shell';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {path} from '@tauri-apps/api';
import type { GameData, HanleGamesProps } from '@/types';
import i18next, { t } from 'i18next';
import { open as openDirectory } from '@tauri-apps/plugin-dialog';
import { updateGameClearStatus } from './repository';

// import { createTheme } from '@mui/material/styles';

export const time_now=()=>{
    // 获取当前时间
const currentDate = new Date();

return currentDate;

}

export const getLocalDateString=(timestamp?: number): string =>{
  const date = timestamp ? new Date(timestamp * 1000) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// export const Buttontheme = createTheme({
//   components: {
//     MuiButton: {
//       styleOverrides: {
//         root: {
//           textTransform: 'none', // 禁用所有按钮的文本大写转换
//         },
//       },
//     },
//   },
// });

export async function openurl(url: string) {
  if (isTauri()) {
    await open(url)
  } else {
    window.open(url, '_blank')
  }
}

    export const handleOpenFolder = async ({id,getGameById}:HanleGamesProps) => {
      if (!id) {
            console.error('未选择游戏');
            return;
        }
        try {
            const selectedGame = await getGameById(id);
            if (!selectedGame || !selectedGame.localpath) {
                console.error('游戏路径未找到');
                return;
            }
            const folder = await path.dirname(selectedGame.localpath);
            if (folder) {
                // 使用我们自己的后端函数打开文件夹
                await invoke('open_directory', { dirPath: folder });
            }
        } catch (error) {
            console.error('打开文件夹失败:', error);
        }
    }

export function getGamePlatformId(game: GameData): string | undefined {
  // 严格检查：非空字符串
  if (game.bgm_id && game.bgm_id.trim() !== "") return game.bgm_id;
  if (game.vndb_id && game.vndb_id.trim() !== "") return game.vndb_id;
  return undefined;
}

export function formatRelativeTime(time: string | number | Date): string {
    const now = new Date();
    const target = time instanceof Date 
        ? time 
        : typeof time === 'number'
            ? new Date(time * (time.toString().length === 10 ? 1000 : 1))
            : new Date(time);
    
    const diff = (now.getTime() - target.getTime()) / 1000; // 秒
    
    if (diff < 60) return i18next.t('utils.relativetime.justNow'); // 刚刚
    if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return i18next.t('utils.relativetime.minutesAgo', { count: minutes });
    }
    if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        return i18next.t('utils.relativetime.hoursAgo', { count: hours });
    }
    if (diff < 7 * 86400) {
        const days = Math.floor(diff / 86400);
        return i18next.t('utils.relativetime.daysAgo', { count: days });
    }

    // 判断是否为上周
    const nowWeek = getWeekNumber(now);
    const targetWeek = getWeekNumber(target);
    if (now.getFullYear() === target.getFullYear() && nowWeek - targetWeek === 1) {
        return i18next.t('utils.relativetime.lastWeek');
    }

    // 超过一周，返回日期
    return target.toLocaleDateString();
}

function getWeekNumber(date: Date): number {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = ((date.getTime() - firstDay.getTime()) / 86400000) + 1;
    return Math.ceil(dayOfYear / 7);
}

// 格式化游戏时间
export function formatPlayTime(minutes: number): string {
  if (!minutes) return i18next.t('utils.formatPlayTime.minutes', { count: 0 }); 
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return i18next.t('utils.formatPlayTime.minutes', { count: mins });
  }
  
  if (mins > 0) {
    return i18next.t('utils.formatPlayTime.hoursAndMinutes', { hours, minutes: mins });
  } 
    return i18next.t('utils.formatPlayTime.hours', { count: hours });
  
}

export  const handleDirectory = async () => {
  const path = await openDirectory({
      multiple: false,
      directory: false,
      filters: [{
          name: t('components.AddModal.executable'),
          extensions: ["exe"]
      }]
  });
  if (path === null) return null;
  return path
}

export const getGameDisplayName = (game: GameData, language?: string): string => {
  const currentLanguage = language || i18next.language;
  
  // 只有当语言为zh-CN时才使用name_cn，其他语言都使用name
  return currentLanguage === 'zh-CN' && game.name_cn 
    ? game.name_cn 
    : game.name;
};

/**
 * 切换游戏通关状态的通用函数
 * @param gameId 游戏ID
 * @param getGameById 获取游戏数据的函数
 * @param onSuccess 成功回调函数，返回新的通关状态
 * @param updateGamesInStore 可选：更新store中games数组的函数
 * @returns Promise<void>
 */
export const toggleGameClearStatus = async (
  gameId: number,
  getGameById: (id: number) => Promise<GameData | null>,
  onSuccess?: (newStatus: 1 | 0, gameData: GameData) => void,
  updateGamesInStore?: (gameId: number, newClearStatus: 1 | 0) => void
): Promise<void> => {
  try {
    const game = await getGameById(gameId);
    if (!game) {
      console.error('游戏数据未找到');
      return;
    }

    const newClearStatus = game.clear === 1 ? 0 : 1;
    await updateGameClearStatus(gameId, newClearStatus as 1 | 0);
    
    // 更新store中的games数组
    if (updateGamesInStore) {
      updateGamesInStore(gameId, newClearStatus as 1 | 0);
    }
    
    // 调用成功回调
    if (onSuccess) {
      onSuccess(newClearStatus as 1 | 0, { ...game, clear: newClearStatus as 1 | 0 });
    }
  } catch (error) {
    console.error('更新游戏通关状态失败:', error);
    throw error;
  }
};