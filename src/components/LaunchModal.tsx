/**
 * @file LaunchModal 组件
 * @description 游戏启动弹窗组件，负责判断游戏是否可启动、是否正在运行，并提供启动按钮，支持国际化。
 * @module src/components/LaunchModal/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - LaunchModal：游戏启动弹窗组件
 */

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import SyncIcon from "@mui/icons-material/Sync";
import TimerIcon from "@mui/icons-material/Timer";
import { Button, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { SelectedGameGuard } from "@/components/SelectedGameGuard";
import { useGameLaunchFlow } from "@/hooks/features/games/useGameLaunchFlow";
import { useUpdateGame } from "@/hooks/queries/useGames";
import { snackbar } from "@/providers/snackBar";
import { useGamePlayStore } from "@/store/gamePlayStore";
import type { GameData } from "@/types";
import { getUserErrorMessage } from "@/utils/errors";

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
 * 仅本地游戏且未运行时可启动。
 * 运行时显示实时游戏时长。
 * 支持两种计时模式：
 * - playtime: 真实游戏时间（仅活跃时间，通过后端事件更新）
 * - elapsed: 游戏启动时间（从启动到现在的总时间，前端计时器计算）
 *
 * @returns {JSX.Element} 启动按钮或运行中提示
 */
export const LaunchModal = () => {
	const { t } = useTranslation();
	const disabledFallback = (
		<Button startIcon={<PlayArrowIcon />} disabled>
			{t("components.LaunchModal.launchGame", "启动游戏")}
		</Button>
	);

	return (
		<SelectedGameGuard
			fallback={disabledFallback}
			loadingFallback={disabledFallback}
			notFoundFallback={disabledFallback}
		>
			{(selectedGame) => <LaunchModalContent selectedGame={selectedGame} />}
		</SelectedGameGuard>
	);
};

interface LaunchModalContentProps {
	selectedGame: GameData;
}

function LaunchModalContent({ selectedGame }: LaunchModalContentProps) {
	const { t } = useTranslation();
	const selectedGameId = selectedGame.id;
	const { launchGame, syncLocalPath } = useGameLaunchFlow();
	const { mutateAsync: updateGame } = useUpdateGame();
	const { stopGame, isThisGameRunning, realTimeState } = useGamePlayStore(
		useShallow((s) => ({
			stopGame: s.stopGame,
			isThisGameRunning: s.runningGameIds.has(selectedGameId),
			realTimeState: s.gameRealTimeStates[selectedGameId] ?? null,
		})),
	);
	const hasLocalPath = Boolean(selectedGame.localpath);
	const sessionTimeTrackingMode = realTimeState?.timeTrackingMode;
	const isLaunching = realTimeState?.lifecycle === "launching";

	// 用于 elapsed 模式下的前端计时器显示
	const timerRef = useRef<HTMLSpanElement>(null);
	const [stopping, setStopping] = useState(false);

	useEffect(() => {
		if (
			sessionTimeTrackingMode !== "elapsed" ||
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

		updateDisplay();

		const intervalId = setInterval(updateDisplay, 1000);

		return () => {
			clearInterval(intervalId);
		};
	}, [sessionTimeTrackingMode, isThisGameRunning, realTimeState?.startTime]);

	const handleStartGame = () => {
		void launchGame(selectedGame);
	};

	const handleSyncLocalPath = () => {
		void syncLocalPath(selectedGame);
	};

	const handleStopGame = async () => {
		setStopping(true);
		try {
			const res = await stopGame(selectedGameId);
			if (!res.success) {
				snackbar.error(
					res.message ||
						t("components.LaunchModal.stopFailed", "游戏停止失败:"),
				);
			}
		} catch (error) {
			snackbar.error(
				`${t("components.LaunchModal.stopFailed", "游戏停止失败:")}: ${getUserErrorMessage(error, t)}`,
			);
		} finally {
			setStopping(false);
		}
	};

	const handleSaveDetectedProcess = async () => {
		const processPath = realTimeState?.detectedSteamProcessPath;
		if (!processPath) return;
		try {
			await updateGame({
				gameId: selectedGameId,
				updates: { steam_process_path: processPath },
			});
			snackbar.success(
				t(
					"components.LaunchModal.steamProcessSaved",
					"已保存检测到的 Steam 游戏进程",
				),
			);
		} catch (error) {
			snackbar.error(getUserErrorMessage(error, t));
		}
	};

	const content = (() => {
		if (stopping) {
			return (
				<Button startIcon={<StopIcon />} disabled>
					{t("components.LaunchModal.stoppingGame", "停止游戏中...")}
				</Button>
			);
		}

		if (isThisGameRunning && realTimeState) {
			if (isLaunching) {
				const total = realTimeState.progressTotal;
				const progressStages = new Set([
					"updating",
					"validating",
					"preallocating",
					"staging",
					"committing",
					"paused",
				]);
				const progress =
					total && progressStages.has(realTimeState.steamStage ?? "")
						? Math.min(
								100,
								(Number(realTimeState.progressCurrent ?? 0) / Number(total)) *
									100,
							)
						: null;
				const stageLabels: Record<string, string> = {
					checking: t(
						"components.LaunchModal.steamChecking",
						"检查 Steam 状态",
					),
					updating: t("components.LaunchModal.steamUpdating", "Steam 更新中"),
					validating: t(
						"components.LaunchModal.steamValidating",
						"Steam 校验中",
					),
					preallocating: t(
						"components.LaunchModal.steamPreallocating",
						"Steam 预分配中",
					),
					staging: t("components.LaunchModal.steamStaging", "Steam 暂存中"),
					committing: t(
						"components.LaunchModal.steamCommitting",
						"Steam 提交更新",
					),
					paused: t("components.LaunchModal.steamPaused", "Steam 更新已暂停"),
					waiting_for_process: t(
						"components.LaunchModal.steamWaiting",
						"等待游戏进程",
					),
				};
				return (
					<Button
						startIcon={<StopIcon />}
						onClick={handleStopGame}
						color="warning"
						variant="outlined"
					>
						{stageLabels[realTimeState.steamStage ?? "checking"] ??
							realTimeState.steamStage}
						{progress !== null ? ` ${progress.toFixed(0)}%` : ""}
					</Button>
				);
			}

			const { currentSessionMinutes, currentSessionSeconds } = realTimeState;
			const initialTimeDisplay = formatPlayTime(
				currentSessionMinutes,
				currentSessionSeconds,
			);
			const elapsedInitial = realTimeState.startTime
				? Math.floor(Date.now() / 1000) - realTimeState.startTime
				: 0;
			const elapsedInitialDisplay = formatPlayTime(
				Math.floor(elapsedInitial / 60),
				elapsedInitial % 60,
			);

			const stopButton = (
				<Button
					startIcon={<StopIcon />}
					onClick={handleStopGame}
					className="rounded-2xl"
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
						sx={{ fontVariantNumeric: "tabular-nums" }}
					>
						{sessionTimeTrackingMode === "elapsed"
							? elapsedInitialDisplay
							: initialTimeDisplay}
					</Typography>
				</Button>
			);

			if (
				selectedGame.launch_type === "steam" &&
				realTimeState.detectedSteamProcessPath &&
				!selectedGame.steam_process_path
			) {
				return (
					<Stack direction="row" spacing={1}>
						<Button
							size="small"
							variant="outlined"
							onClick={handleSaveDetectedProcess}
						>
							{t("components.LaunchModal.saveSteamProcess", "保存游戏进程")}
						</Button>
						{stopButton}
					</Stack>
				);
			}

			return stopButton;
		}

		if (hasLocalPath) {
			return (
				<Button startIcon={<PlayArrowIcon />} onClick={handleStartGame}>
					{t("components.LaunchModal.launchGame", "启动游戏")}
				</Button>
			);
		}

		return (
			<Button
				startIcon={<SyncIcon />}
				onClick={handleSyncLocalPath}
				variant="text"
			>
				{t("components.LaunchModal.syncLocalPath", "同步本地")}
			</Button>
		);
	})();

	return content;
}
