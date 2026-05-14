import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import i18n from "i18next";
import { useGamePlayStore } from "@/store/gamePlayStore";

const confirmTrayExitIfNeeded = async (): Promise<boolean> => {
	const runningGameCount = getRunningGameCount();

	if (runningGameCount <= 0) {
		return true;
	}

	return ask(
		i18n.t(
			"components.Window.runningExitDialog.message",
			"当前仍有 {{count}} 个游戏正在运行。退出应用后不会关闭这些游戏，但会丢失游戏时长记录。确定要退出应用吗？",
			{
				count: runningGameCount,
			},
		),
		{
			title: i18n.t("components.Window.runningExitDialog.title", "退出提醒"),
			kind: "warning",
			okLabel: i18n.t(
				"components.Window.runningExitDialog.exitApp",
				"仍然退出",
			),
			cancelLabel: i18n.t("common.cancel", "取消"),
		},
	);
};

export const getRunningGameCount = (): number => {
	return useGamePlayStore.getState().runningGameIds.size;
};

export const destroyCurrentWindow = async (): Promise<void> => {
	await getCurrentWindow().destroy();
};

export const exitCurrentWindowFromTray = async (): Promise<void> => {
	if (await confirmTrayExitIfNeeded()) {
		await destroyCurrentWindow();
	}
};
