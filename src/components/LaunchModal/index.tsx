/**
 * @file LaunchModal 组件
 * @description 游戏启动弹窗组件，负责判断游戏是否可启动、是否正在运行，并提供启动按钮，适配 Tauri 桌面环境，支持国际化。
 * @module src/components/LaunchModal/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - LaunchModal：游戏启动弹窗组件
 *
 * 依赖：
 * - @mui/material
 * - @mui/icons-material
 * - @/store
 * - @/store/gamePlayStore
 * - @tauri-apps/api/core
 * - react-i18next
 */

import Button from '@mui/material/Button';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimerIcon from '@mui/icons-material/Timer';
import { useStore } from '@/store';
import { useGamePlayStore } from '@/store/gamePlayStore';
import { isTauri } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

/**
 * LaunchModal 组件
 * 判断游戏是否可启动、是否正在运行，并渲染启动按钮。
 * 仅本地游戏且未运行时可启动，适配 Tauri 桌面环境。
 *
 * @returns {JSX.Element} 启动按钮或运行中提示
 */
export const LaunchModal = () => {
    const { t } = useTranslation();
    const { selectedGameId, getGameById, useIsLocalGame } = useStore();
    const { launchGame, isGameRunning } = useGamePlayStore();

    // 检查这个特定游戏是否在运行
    const isThisGameRunning = isGameRunning(selectedGameId === null ? undefined : selectedGameId);

    /**
     * 判断当前游戏是否可以启动
     * @returns {boolean} 是否可启动
     */
    const canUse = (): boolean => {
        // 如果不是Tauri环境，无法启动游戏
        if (!isTauri()) return false;

        // 如果没有有效的游戏ID，无法启动
        if (!selectedGameId) return false;

        // 如果该游戏已在运行，不能再次启动
        if (isThisGameRunning) return false;

        // 检查是否为本地游戏，只有本地游戏才能启动
        return useIsLocalGame(selectedGameId);
    };

    /**
     * 启动游戏按钮点击事件
     */
    const handleStartGame = async () => {
        if (!selectedGameId) return;

        try {
            const selectedGame = await getGameById(selectedGameId);
            if (!selectedGame || !selectedGame.localpath) {
                console.error(t('components.LaunchModal.gamePathNotFound'));
                return;
            }

            // 使用游戏启动函数
            await launchGame(selectedGame.localpath, selectedGameId);
        } catch (error) {
            console.error(t('components.LaunchModal.launchFailed'), error);
        }
    };

    // 渲染不同状态的按钮
    if (isThisGameRunning) {
        return (
            <Button
                startIcon={<TimerIcon />}
                disabled
            >
                {t('components.LaunchModal.playing')}
            </Button>
        );
    }

    return (
        <Button
            startIcon={<PlayArrowIcon />}
            onClick={handleStartGame}
            disabled={!canUse()}
        >
            {t('components.LaunchModal.launchGame')}
        </Button>
    );
};