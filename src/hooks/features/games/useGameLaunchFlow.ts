import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateGame } from "@/hooks/queries/useGames";
import { snackbar } from "@/providers/snackBar";
import { getLocalPathDirectory, handleExeFile } from "@/services/fs/fileDialog";
import { useGamePlayStore } from "@/store/gamePlayStore";
import type { GameData, UpdateGameParams } from "@/types";
import { getUserErrorMessage } from "@/utils/errors";

interface PendingLocalPathDialog {
	game: GameData;
	retryAfterSave: boolean;
}

async function resolveExecutablePickerDefaultPath(
	localPath?: string | null,
): Promise<string> {
	if (!localPath) return "";

	try {
		return await getLocalPathDirectory(localPath);
	} catch {
		return "";
	}
}

export function useGameLaunchFlow() {
	const { t } = useTranslation();
	const updateGameMutation = useUpdateGame();
	const launchGame = useGamePlayStore((s) => s.launchGame);
	const [pendingDialog, setPendingDialog] =
		useState<PendingLocalPathDialog | null>(null);
	const [localPath, setLocalPath] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const openLocalPathDialog = useCallback(
		(game: GameData, options: { retryAfterSave: boolean }) => {
			setPendingDialog({ game, retryAfterSave: options.retryAfterSave });
			setLocalPath(game.localpath ?? "");
		},
		[],
	);

	const closeLocalPathDialog = useCallback(() => {
		if (isSaving) return;
		setPendingDialog(null);
		setLocalPath("");
	}, [isSaving]);

	const runLaunch = useCallback(
		async (game: GameData) => {
			try {
				if (!game.localpath) {
					openLocalPathDialog(game, { retryAfterSave: true });
					return;
				}

				const result = await launchGame(game.id);
				if (result.success) return;

				if (result.code === "NEED_EXECUTABLE") {
					openLocalPathDialog(game, { retryAfterSave: true });
					return;
				}

				snackbar.error(result.message);
			} catch (error) {
				snackbar.error(
					`${t("components.LaunchModal.launchFailed", "游戏启动失败:")}: ${getUserErrorMessage(error, t)}`,
				);
			}
		},
		[launchGame, openLocalPathDialog, t],
	);

	const handleSelectExecutable = useCallback(async () => {
		if (!pendingDialog) return;

		try {
			const defaultPath = await resolveExecutablePickerDefaultPath(
				localPath || pendingDialog.game.localpath,
			);
			const selectedPath = await handleExeFile(defaultPath);
			if (selectedPath) {
				setLocalPath(selectedPath);
			}
		} catch (error) {
			snackbar.error(
				`${t("components.LaunchModal.selectFolder", "选择文件夹")}: ${getUserErrorMessage(error, t)}`,
			);
		}
	}, [localPath, pendingDialog, t]);

	const handleSavePath = useCallback(async () => {
		if (!pendingDialog) return;

		const nextLocalPath = localPath.trim();
		if (!nextLocalPath) {
			snackbar.error(
				t("components.LaunchModal.pathRequired", "请选择或输入路径"),
			);
			return;
		}

		setIsSaving(true);
		try {
			const updateData: UpdateGameParams = {
				localpath: nextLocalPath,
			};
			const retryAfterSave = pendingDialog.retryAfterSave;
			const gameId = pendingDialog.game.id;

			await updateGameMutation.mutateAsync({
				gameId,
				updates: updateData,
			});
			snackbar.success(t("components.LaunchModal.pathSaved", "路径已保存"));
			setPendingDialog(null);
			setLocalPath("");

			if (retryAfterSave) {
				// 保存后只自动重试一次；若仍失败，交给错误提示，不循环弹窗。
				const retryResult = await launchGame(gameId);
				if (!retryResult.success) {
					snackbar.error(retryResult.message);
				}
			}
		} catch (error) {
			snackbar.error(
				`${t("components.LaunchModal.pathSaveFailed", "保存路径失败")}: ${getUserErrorMessage(error, t)}`,
			);
		} finally {
			setIsSaving(false);
		}
	}, [launchGame, localPath, pendingDialog, t, updateGameMutation]);

	const dialogProps = useMemo(
		() => ({
			open: pendingDialog !== null,
			localPath,
			isSaving,
			onClose: closeLocalPathDialog,
			onLocalPathChange: setLocalPath,
			onSelectExecutable: handleSelectExecutable,
			onSave: handleSavePath,
		}),
		[
			closeLocalPathDialog,
			handleSavePath,
			handleSelectExecutable,
			isSaving,
			localPath,
			pendingDialog,
		],
	);

	return {
		launchGame: runLaunch,
		openLocalPathDialog,
		localPathDialogProps: dialogProps,
	};
}
