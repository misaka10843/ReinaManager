import { convertFileSrc } from "@tauri-apps/api/core";
import { type } from "@tauri-apps/plugin-os";
import i18next from "i18next";
import { join } from "pathe";
import type { GameData } from "@/types";
import { getAppDataDirPath } from "@/utils/fs/pathCache";

export const getGameDisplayName = (game: GameData): string => {
	if (game.custom_data?.name) {
		return game.custom_data.name;
	}
	return i18next.language === "zh-CN" && game.name_cn
		? game.name_cn
		: game.name || "";
};

export const getcustomCoverFolder = (gameID: number): string => {
	const resourceFolder = getAppDataDirPath();
	return join(resourceFolder, "covers", `game_${gameID}`);
};

export const getGameCover = (game: GameData): string => {
	if (game.custom_data?.image) {
		const customCoverFolder = getcustomCoverFolder(game.id);
		if (customCoverFolder) {
			const customCoverPath = join(
				customCoverFolder,
				`cover_${game.id}_${game.custom_data.image}`,
			);

			try {
				return convertFileSrc(customCoverPath);
			} catch (error) {
				console.error("转换自定义封面路径失败:", error);
			}
		}
	}

	if (game.image) {
		const base =
			type() === "windows"
				? "http://reina-cover.localhost"
				: "reina-cover://localhost";
		return `${base}/${game.id}?url=${game.image}`;
	}

	return "/images/default.png";
};

export const getGameNsfwStatus = (game: GameData): boolean => {
	return game.nsfw ?? isNsfwGame(game.tags || []);
};

export function applyNsfwFilter(
	data: GameData[],
	nsfwFilter: boolean,
): GameData[] {
	if (!nsfwFilter) {
		return data;
	}
	return data.filter((game) => !getGameNsfwStatus(game));
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: 允许 ASCII 范围检查
const ASCII_ONLY_RE = /^[\x00-\x7F]+$/;

function isNsfwGame(tags: string[]): boolean {
	if (tags.length === 0) return false;

	if (tags.some((tag) => tag.includes("R18") || tag === "拔作")) {
		return true;
	}

	const isAllEnglish = tags.every((tag) => ASCII_ONLY_RE.test(tag));
	return isAllEnglish && !tags.includes("No Sexual Content");
}
