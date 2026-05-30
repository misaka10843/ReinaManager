import { path as tauriPath } from "@tauri-apps/api";
import { open as openDirectory } from "@tauri-apps/plugin-dialog";
import { readDir, stat } from "@tauri-apps/plugin-fs";
import i18next, { t } from "i18next";
import { extname, join } from "pathe";
import { snackbar } from "@/providers/snackBar";
import { fileService } from "@/services/invoke";
import type { GameData } from "@/types";
import { getUserErrorMessage } from "@/utils/errors";

export const handleOpenFolder = async (
	selectedGame: Pick<GameData, "localpath">,
) => {
	try {
		if (!selectedGame.localpath) {
			snackbar.error(
				i18next.t("components.LaunchModal.gamePathNotFound", "游戏路径未找到"),
			);
			return;
		}
		const folder = await tauriPath.dirname(selectedGame.localpath);
		if (folder) {
			await fileService.openDirectory(folder);
		}
	} catch (error) {
		const errorMessage = getUserErrorMessage(error, i18next.t.bind(i18next));
		snackbar.error(
			`${i18next.t(
				"components.Snackbar.failedOpenGameFolder",
				"打开游戏文件夹失败",
			)}: ${errorMessage}`,
		);
		console.error("打开文件夹失败:", error);
	}
};

export const handleFolder = async (defaultPath: string = "") => {
	const selectedPath = await openDirectory({
		multiple: false,
		directory: true,
		defaultPath: defaultPath,
		filters: [
			{
				name: t("utils.handleDirectory.folder", "文件夹"),
				extensions: ["*"],
			},
		],
	});
	if (selectedPath === null) return null;
	return selectedPath;
};

export const handleExeFile = async (defaultPath: string = "") => {
	const selectedPath = await openDirectory({
		multiple: false,
		directory: false,
		defaultPath: defaultPath,
		filters: [
			{
				name: t("utils.handleDirectory.executable", "可执行文件"),
				extensions: ["exe", "bat", "cmd"],
			},
			{
				name: t("utils.handleDirectory.allFiles", "所有文件"),
				extensions: ["*"],
			},
		],
	});
	if (selectedPath === null) return null;
	return selectedPath;
};

const EXECUTABLE_EXTENSIONS = [".exe", ".bat", ".cmd"];

function isExecutableFile(filePath: string): boolean {
	const ext = extname(filePath).toLowerCase();
	return EXECUTABLE_EXTENSIONS.includes(ext);
}

async function getExecutablesInDirectory(dirPath: string): Promise<string[]> {
	try {
		const entries = await readDir(dirPath);
		const executables: string[] = [];

		for (const entry of entries) {
			if (!entry.isDirectory && entry.name) {
				const fullPath = join(dirPath, entry.name);
				if (isExecutableFile(entry.name)) {
					executables.push(fullPath);
				}
			}
		}

		return executables;
	} catch (error) {
		console.error("读取目录失败:", error);
		return [];
	}
}

export const handleDroppedPath = async (
	droppedPath: string,
): Promise<string | null> => {
	try {
		const fileInfo = await stat(droppedPath);

		if (fileInfo.isDirectory) {
			const executables = await getExecutablesInDirectory(droppedPath);

			if (executables.length === 0) {
				snackbar.error(
					t("components.AddModal.emptyFolder", "该文件夹中没有找到可执行文件"),
				);
				return null;
			}

			if (executables.length === 1) {
				return executables[0];
			}

			snackbar.info(
				t(
					"components.AddModal.selectFromFolder",
					"文件夹中有多个可执行文件，请选择一个",
				),
			);
			return handleExeFile(droppedPath);
		}

		if (isExecutableFile(droppedPath)) {
			return droppedPath;
		}

		snackbar.error(
			t(
				"components.AddModal.invalidFile",
				"请拖入有效的可执行文件（.exe/.bat/.cmd）或文件夹",
			),
		);
		return null;
	} catch (error) {
		console.error("处理拖拽路径失败:", error);
		snackbar.error(
			`${t(
				"components.AddModal.invalidFile",
				"请拖入有效的可执行文件（.exe/.bat/.cmd）或文件夹",
			)}: ${getUserErrorMessage(error, t)}`,
		);
		return null;
	}
};

/**
 * 从目录名中移除括号内容，提取搜索用的游戏名
 * 例如: "[社团名] 游戏名 (版本)" -> "游戏名"
 */
export function trimDirnameToSearchName(dirName: string): string {
	let result = "";
	let squareDepth = 0;
	let roundDepth = 0;
	let cornerDepth = 0;
	let fullwidthRoundDepth = 0;

	for (const ch of dirName) {
		switch (ch) {
			case "[":
				squareDepth++;
				break;
			case "]":
				squareDepth = Math.max(0, squareDepth - 1);
				break;
			case "(":
				roundDepth++;
				break;
			case ")":
				roundDepth = Math.max(0, roundDepth - 1);
				break;
			case "【":
				cornerDepth++;
				break;
			case "】":
				cornerDepth = Math.max(0, cornerDepth - 1);
				break;
			case "（":
				fullwidthRoundDepth++;
				break;
			case "）":
				fullwidthRoundDepth = Math.max(0, fullwidthRoundDepth - 1);
				break;
			default:
				if (
					squareDepth === 0 &&
					roundDepth === 0 &&
					cornerDepth === 0 &&
					fullwidthRoundDepth === 0
				) {
					result += ch;
				}
		}
	}

	const trimmed = result.replace(/\s+/g, " ").trim();
	return trimmed || dirName.trim();
}
