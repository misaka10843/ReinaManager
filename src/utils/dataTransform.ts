/**
 * @file 数据转换工具
 * @description 将后端数据结构转换为前端显示结构,智能合并关联数据
 */

import { convertFileSrc } from "@tauri-apps/api/core";
import { join } from "pathe";
import type { FullGameData, GameData } from "@/types";
import { getResourceDirPath } from "@/utils";

/**
 * 根据 id_type 智能合并游戏数据
 * 实现类似 api/mixed.ts 的逻辑
 *
 * @param fullData 完整游戏数据(包含关联表)
 * @param language 当前语言
 * @returns 展平的 GameData
 */
export function getDisplayGameData(
	fullData: FullGameData,
	_language?: string,
): GameData {
	const { game, bgm_data, vndb_data, other_data } = fullData;

	// 基础数据
	const baseData: GameData = {
		...game,
		// 初始化展平字段
		image: undefined,
		name: undefined,
		name_cn: undefined,
		summary: undefined,
		tags: [],
		rank: undefined,
		score: undefined,
		developer: undefined,
		all_titles: undefined,
		aliases: undefined,
		average_hours: undefined,
	};

	// 根据 id_type 决定数据来源
	switch (game.id_type) {
		case "bgm":
			// 纯 BGM 数据
			if (bgm_data) {
				baseData.image = bgm_data.image || undefined;
				baseData.name = bgm_data.name;
				baseData.name_cn = bgm_data.name_cn || undefined;
				baseData.summary = bgm_data.summary || undefined;
				baseData.tags = bgm_data.tags || [];
				baseData.rank = bgm_data.rank || undefined;
				baseData.score = bgm_data.score || undefined;
				baseData.developer = bgm_data.developer || undefined;
				baseData.aliases = bgm_data.aliases || [];
			}
			break;

		case "vndb":
			// 纯 VNDB 数据
			if (vndb_data) {
				baseData.image = vndb_data.image || undefined;
				baseData.name = vndb_data.name;
				baseData.name_cn = vndb_data.name_cn || undefined;
				baseData.summary = vndb_data.summary || undefined;
				baseData.tags = vndb_data.tags || [];
				baseData.score = vndb_data.score || undefined;
				baseData.developer = vndb_data.developer || undefined;
				baseData.all_titles = vndb_data.all_titles || [];
				baseData.aliases = vndb_data.aliases || [];
				baseData.average_hours = vndb_data.average_hours || undefined;
			}
			break;

		case "mixed":
			// 混合数据 - 参考 api/mixed.ts 的逻辑
			// 优先使用 BGM 数据,VNDB 补充
			if (bgm_data || vndb_data) {
				// 封面: BGM 优先
				baseData.image = bgm_data?.image || vndb_data?.image || undefined;

				// 名称: BGM 优先
				baseData.name = bgm_data?.name || vndb_data?.name || undefined;
				baseData.name_cn = bgm_data?.name_cn || vndb_data?.name_cn || undefined;

				// 简介: BGM 优先,如果为空则用 VNDB
				baseData.summary = bgm_data?.summary || vndb_data?.summary || undefined;

				// 标签: 合并两者,去重
				const bgmTags = bgm_data?.tags || [];
				const vndbTags = vndb_data?.tags || [];
				baseData.tags = Array.from(new Set([...bgmTags, ...vndbTags]));

				// 排名: 只有 BGM 有
				baseData.rank = bgm_data?.rank || undefined;

				// 评分: BGM 优先
				baseData.score = bgm_data?.score || vndb_data?.score || undefined;

				// 开发商: VNDB 优先
				baseData.developer =
					vndb_data?.developer || bgm_data?.developer || undefined;

				// VNDB 特有字段
				baseData.all_titles = vndb_data?.all_titles || [];
				baseData.average_hours = vndb_data?.average_hours || undefined;

				// 别名: 合并两者
				const bgmAliases = bgm_data?.aliases || [];
				const vndbAliases = vndb_data?.aliases || [];
				baseData.aliases = Array.from(new Set([...bgmAliases, ...vndbAliases]));
			}
			break;

		case "custom":
		case "Whitecloud":
			// 使用 other 表数据
			if (other_data) {
				baseData.image = other_data.image || undefined;
				baseData.name = other_data.name || undefined;
				baseData.summary = other_data.summary || undefined;
				baseData.tags = other_data.tags || [];
				baseData.developer = other_data.developer || undefined;
			}
			break;

		default: {
			// 未知类型,尝试使用任何可用数据
			const anyData = bgm_data || vndb_data || other_data;
			if (anyData) {
				baseData.image = anyData.image || undefined;
				baseData.name = anyData.name || undefined;
				baseData.summary = anyData.summary || undefined;
				baseData.tags = anyData.tags || [];
				baseData.developer = anyData.developer || undefined;
			}
			break;
		}
	}

	// 处理自定义封面
	if (game.custom_cover && game.id) {
		baseData.image = getCustomCoverUrl(game.id, game.custom_cover);
	}

	return baseData;
}

/**
 * 批量转换 FullGameData 数组
 */
export function getDisplayGameDataList(
	fullDataList: FullGameData[],
	language?: string,
): GameData[] {
	return fullDataList.map((fullData) => getDisplayGameData(fullData, language));
}

/**
 * 获取自定义封面 URL
 */
function getCustomCoverUrl(
	gameId: number,
	customCover: string,
): string | undefined {
	const resourceFolder = getResourceDirPath();
	if (!resourceFolder) {
		return;
	}

	const customCoverFolder = join(
		resourceFolder,
		"resources",
		"covers",
		`game_${gameId}`,
	);
	const customCoverPath = join(
		customCoverFolder,
		`cover_${gameId}_${customCover}`,
	);

	try {
		return convertFileSrc(customCoverPath);
	} catch (error) {
		console.error("转换自定义封面路径失败:", error);
	}
}
