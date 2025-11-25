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

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import TimerIcon from "@mui/icons-material/Timer";
import { Typography } from "@mui/material";
import Button from "@mui/material/Button";
import { isTauri } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useStore } from "@/store";
import { useGamePlayStore } from "@/store/gamePlayStore";

/**
 * 格式化游戏时长显示
 * @param minutes 分钟数
 * @param seconds 秒数
 * @returns 格式化的时长字符串，如 "1:23:45" 或 "23:45" 或 "0:05"
 */
const formatPlayTime = (minutes: number, seconds: number): string => {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	const secs = seconds;

	if (hours > 0) {
		return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * LaunchModal 组件
 * 判断游戏是否可启动、是否正在运行，并渲染启动按钮。
 * 仅本地游戏且未运行时可启动，适配 Tauri 桌面环境。
 * 运行时显示实时游戏时长。
 *
 * @returns {JSX.Element} 启动按钮或运行中提示
 */
export const LaunchModal = () => {
	const { t } = useTranslation();
	const { selectedGameId, getGameById, isLocalGame, allGames } = useStore();
	const { launchGame, stopGame, isGameRunning, getGameRealTimeState } =
		useGamePlayStore();

	// 检查这个特定游戏是否在运行
	const isThisGameRunning = isGameRunning(
		selectedGameId === null ? undefined : selectedGameId,
	);

	// 获取实时游戏状态
	const realTimeState = selectedGameId
		? getGameRealTimeState(selectedGameId)
		: null;

	/**
	 * 判断当前游戏是否可以启动
	 * 通过订阅 allGames 确保当游戏列表更新时组件重新渲染
	 * @returns {boolean} 是否可启动
	 */
	const canUse = (): boolean => {
		// 基础检查
		if (!isTauri() || !selectedGameId || isThisGameRunning) {
			return false;
		}

		// 检查是否为本地游戏
		// isLocalGame 内部从 allGames 查找，组件已订阅 allGames 确保数据同步
		return allGames.length >= 0 && isLocalGame(selectedGameId);
	};

	/**
	 * 启动游戏按钮点击事件
	 */
	const handleStartGame = async () => {
		if (!selectedGameId) return;

		try {
			const selectedGame = await getGameById(selectedGameId);
			if (!selectedGame || !selectedGame.localpath) {
				console.error(t("components.LaunchModal.gamePathNotFound"));
				return;
			}

			// 使用游戏启动函数
			await launchGame(selectedGame.localpath, selectedGameId);
		} catch (error) {
			console.error(t("components.LaunchModal.launchFailed"), error);
		}
	};

	/**
	 * 停止游戏按钮点击事件
	 */
	const handleStopGame = async () => {
		if (!selectedGameId) return;

		try {
			await stopGame(selectedGameId);
		} catch (error) {
			console.error(t("components.LaunchModal.stopFailed"), error);
		}
	};

	// 渲染不同状态的按钮
	if (isThisGameRunning && realTimeState) {
		const { currentSessionMinutes, currentSessionSeconds } = realTimeState;
		const timeDisplay = formatPlayTime(
			currentSessionMinutes,
			currentSessionSeconds,
		);

		return (
			<Button
				startIcon={<StopIcon />}
				onClick={handleStopGame}
				className="rounded"
				color="error"
				variant="outlined"
			>
				<TimerIcon fontSize="small" color="disabled" />
				<Typography
					className="ml-1"
					variant="button"
					component="span"
					color="textDisabled"
				>
					{timeDisplay}
				</Typography>
			</Button>
		);
	}

	return (
		<Button
			startIcon={<PlayArrowIcon />}
			onClick={handleStartGame}
			disabled={!canUse()}
		>
			{t("components.LaunchModal.launchGame")}
		</Button>
	);
};
