import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateGame } from "@/hooks/queries/useGames";
import { snackbar } from "@/providers/snackBar";
import {
	getLocalPathPickerDirectory,
	handleExeFile,
} from "@/services/fs/fileDialog";
import { useGamePlayStore } from "@/store/gamePlayStore";
import type { GameData, UpdateGameParams } from "@/types";
import { getUserErrorMessage } from "@/utils/errors";

export function useGameLaunchFlow() {
	const { t } = useTranslation();
	const { mutateAsync: updateGame } = useUpdateGame();
	const launchGame = useGamePlayStore((s) => s.launchGame);

	const syncLocalPath = useCallback(
		async (game: GameData) => {
			let selectedPath: string | null;
			try {
				const defaultPath = await getLocalPathPickerDirectory(game.localpath);
				selectedPath = await handleExeFile(defaultPath);
			} catch (error) {
				snackbar.error(
					`${t("components.LaunchModal.selectFolder", "选择文件夹")}: ${getUserErrorMessage(error, t)}`,
				);
				return false;
			}

			if (!selectedPath) {
				snackbar.warning(
					t(
						"components.LaunchModal.selectExecutableRequired",
						"请选择可执行文件",
					),
				);
				return false;
			}

			try {
				const updateData: UpdateGameParams = {
					localpath: selectedPath,
				};

				await updateGame({
					gameId: game.id,
					updates: updateData,
				});
				snackbar.success(t("components.LaunchModal.pathSaved", "路径已保存"));
				return true;
			} catch (error) {
				snackbar.error(
					`${t("components.LaunchModal.pathSaveFailed", "保存路径失败")}: ${getUserErrorMessage(error, t)}`,
				);
				return false;
			}
		},
		[t, updateGame],
	);

	const runLaunch = useCallback(
		async (game: GameData) => {
			try {
				if (!game.localpath) {
					const synced = await syncLocalPath(game);
					if (!synced) return;
				}

				let result = await launchGame(game.id);
				if (result.success) return;

				if (result.code === "NEED_EXECUTABLE") {
					const synced = await syncLocalPath(game);
					if (!synced) return;
					result = await launchGame(game.id);
					if (result.success) return;
				}

				snackbar.error(result.message);
			} catch (error) {
				snackbar.error(
					`${t("components.LaunchModal.launchFailed", "游戏启动失败:")}: ${getUserErrorMessage(error, t)}`,
				);
			}
		},
		[launchGame, syncLocalPath, t],
	);

	return {
		launchGame: runLaunch,
		syncLocalPath,
	};
}
