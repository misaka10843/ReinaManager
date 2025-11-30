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
import { useEffect, useRef } from "react";
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
 * 支持两种计时模式：
 * - playtime: 真实游戏时间（仅活跃时间，通过后端事件更新）
 * - elapsed: 游戏启动时间（从启动到现在的总时间，前端计时器计算）
 *
 * @returns {JSX.Element} 启动按钮或运行中提示
 */
export const LaunchModal = () => {
	const { t } = useTranslation();
	const {
		selectedGameId,
		getGameById,
		isLocalGame,
		allGames,
		timeTrackingMode,
	} = useStore();
	const { launchGame, stopGame, isGameRunning, getGameRealTimeState } =
		useGamePlayStore();

	// 用于 elapsed 模式下的前端计时器显示
	const timerRef = useRef<HTMLSpanElement>(null);

	// 检查这个特定游戏是否在运行
	const isThisGameRunning = isGameRunning(
		selectedGameId === null ? undefined : selectedGameId,
	);

	// 获取实时游戏状态
	const realTimeState = selectedGameId
		? getGameRealTimeState(selectedGameId)
		: null;

	// elapsed 模式下使用 setInterval 每秒更新一次显示（不触发 React re-render）
	useEffect(() => {
		// 仅在 elapsed 模式且游戏运行中时启动前端计时器
		if (
			timeTrackingMode !== "elapsed" ||
			!isThisGameRunning ||
			!realTimeState?.startTime
		) {
			return;
		}

		const startTime = realTimeState.startTime;

		const updateDisplay = () => {
			if (!timerRef.current) return;

			const now = Math.floor(Date.now() / 1000);
			const elapsed = now - startTime;
			const minutes = Math.floor(elapsed / 60);
			const seconds = elapsed % 60;
			timerRef.current.textContent = formatPlayTime(minutes, seconds);
		};

		// 立即更新一次
		updateDisplay();

		const intervalId = setInterval(updateDisplay, 1000);

		return () => {
			clearInterval(intervalId);
		};
	}, [timeTrackingMode, isThisGameRunning, realTimeState?.startTime]);

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
		// playtime 模式：使用后端事件更新的时间
		// elapsed 模式：使用 ref 显示前端计时器计算的时间
		const { currentSessionMinutes, currentSessionSeconds } = realTimeState;

		// playtime 模式的初始显示值
		const initialTimeDisplay = formatPlayTime(
			currentSessionMinutes,
			currentSessionSeconds,
		);

		// elapsed 模式的初始显示值（从 startTime 计算）
		const elapsedInitial = realTimeState.startTime
			? Math.floor(Date.now() / 1000) - realTimeState.startTime
			: 0;
		const elapsedInitialDisplay = formatPlayTime(
			Math.floor(elapsedInitial / 60),
			elapsedInitial % 60,
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
					ref={timerRef}
					className="ml-1"
					variant="button"
					component="span"
					color="textDisabled"
				>
					{timeTrackingMode === "elapsed"
						? elapsedInitialDisplay
						: initialTimeDisplay}
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
