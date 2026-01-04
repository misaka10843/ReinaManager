/**
 * @file 数据转换工具
 * @description 将后端数据结构转换为前端显示结构,智能合并关联数据
 *
 * 重构说明:
 * - 后端已采用单表架构，FullGameData 直接包含 JSON 元数据字段
 * - 不再需要从 game 属性中提取数据
 * - 转换时将 null 值转换为 undefined（展示层不需要 null）
 */

import type { FullGameData, GameData } from "@/types";

/**
 * 将 null 转换为 undefined
 * 用于将后端返回的 null 值转换为前端展示层的 undefined
 */
const nullToUndefined = <T>(value: T | null | undefined): T | undefined =>
	value ?? undefined;

/**
 * 辅助函数：从数据源提取基础字段（避免重复代码）
 */
const assignBasicFields = (
	target: GameData,
	source: {
		image?: string | null;
		name?: string | null;
		name_cn?: string | null;
		summary?: string | null;
		developer?: string | null;
		nsfw?: boolean | null;
		date?: string | null;
	},
) => {
	if (source.image != null) target.image = source.image;
	if (source.name != null) target.name = source.name;
	if (source.name_cn != null) target.name_cn = source.name_cn;
	if (source.summary != null) target.summary = source.summary;
	if (source.developer != null) target.developer = source.developer;
	if (source.nsfw != null) target.nsfw = source.nsfw;
	if (source.date != null) target.date = source.date;
};

/**
 * 根据 id_type 智能合并游戏数据
 *
 * @param fullData 完整游戏数据（单表架构，元数据嵌入）
 * @param language 当前语言
 * @returns 展平的 GameData
 */
export function getDisplayGameData(
	fullData: FullGameData,
	_language?: string,
): GameData {
	const { bgm_data, vndb_data, ymgal_data, custom_data } = fullData;

	// 基础数据 - 直接从 fullData 中获取根节点字段
	// 使用 nullToUndefined 将 null 转换为 undefined
	const baseData: GameData = {
		id: fullData.id,
		bgm_id: fullData.bgm_id,
		vndb_id: fullData.vndb_id,
		ymgal_id: fullData.ymgal_id,
		id_type: fullData.id_type,
		date: fullData.date,
		localpath: nullToUndefined(fullData.localpath),
		savepath: nullToUndefined(fullData.savepath),
		autosave: fullData.autosave,
		maxbackups: fullData.maxbackups,
		clear: fullData.clear,
		custom_data: nullToUndefined(fullData.custom_data),
		created_at: fullData.created_at,
		updated_at: fullData.updated_at,
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
		nsfw: undefined,
	};

	// 根据 id_type 决定数据来源
	switch (fullData.id_type) {
		case "bgm":
			if (bgm_data) {
				assignBasicFields(baseData, bgm_data);
				baseData.tags = bgm_data.tags || [];
				baseData.rank = bgm_data.rank || undefined;
				baseData.score = bgm_data.score || undefined;
				baseData.aliases = bgm_data.aliases || [];
			}
			break;

		case "vndb":
			if (vndb_data) {
				assignBasicFields(baseData, vndb_data);
				baseData.tags = vndb_data.tags || [];
				baseData.score = vndb_data.score || undefined;
				baseData.all_titles = vndb_data.all_titles || [];
				baseData.aliases = vndb_data.aliases || [];
				baseData.average_hours = vndb_data.average_hours || undefined;
			}
			break;

		case "ymgal":
			if (ymgal_data) {
				assignBasicFields(baseData, ymgal_data);
				baseData.aliases = ymgal_data.aliases || [];
			}
			break;

		case "mixed":
			// 混合数据 - BGM 优先，VNDB 补充
			if (bgm_data || vndb_data) {
				// 基础字段：BGM 优先，VNDB 补充
				assignBasicFields(baseData, bgm_data || {});
				assignBasicFields(baseData, vndb_data || {});

				// 开发商: VNDB 优先（特殊处理）
				baseData.developer =
					vndb_data?.developer || bgm_data?.developer || undefined;

				// 标签: 合并两者,去重
				const bgmTags = bgm_data?.tags || [];
				const vndbTags = vndb_data?.tags || [];
				baseData.tags = Array.from(new Set([...bgmTags, ...vndbTags]));

				// 别名: 合并两者
				const bgmAliases = bgm_data?.aliases || [];
				const vndbAliases = vndb_data?.aliases || [];
				baseData.aliases = Array.from(new Set([...bgmAliases, ...vndbAliases]));

				// BGM 特有字段
				baseData.rank = bgm_data?.rank || undefined;
				baseData.score = bgm_data?.score || vndb_data?.score || undefined;

				// VNDB 特有字段
				baseData.all_titles = vndb_data?.all_titles || [];
				baseData.average_hours = vndb_data?.average_hours || undefined;
			}
			break;

		case "custom":
		case "Whitecloud":
			if (custom_data) {
				assignBasicFields(baseData, custom_data);
				baseData.aliases = custom_data.aliases || [];
				baseData.tags = custom_data.tags || [];
			}
			break;

		default: {
			// 未知类型,尝试使用任何可用数据
			const anyData = bgm_data || vndb_data || ymgal_data || custom_data;
			if (anyData) {
				assignBasicFields(baseData, anyData);
				baseData.aliases = anyData.aliases || [];
				baseData.tags = anyData.tags || [];
			}
			break;
		}
	}

	// 自定义数据优先覆盖（通用逻辑）
	// 注意：aliases 和 tags 采用追加模式（合并），其他字段采用覆盖模式
	if (custom_data) {
		if (custom_data.image != null) baseData.image = custom_data.image;
		if (custom_data.name != null) baseData.name = custom_data.name;
		if (custom_data.summary != null) baseData.summary = custom_data.summary;
		if (custom_data.developer != null)
			baseData.developer = custom_data.developer;
		if (custom_data.nsfw != null) baseData.nsfw = custom_data.nsfw;
		if (custom_data.date != null) baseData.date = custom_data.date;

		// aliases 和 tags 追加合并（去重）
		if (custom_data.aliases != null && custom_data.aliases.length > 0) {
			const existingAliases = baseData.aliases || [];
			baseData.aliases = Array.from(
				new Set([...existingAliases, ...custom_data.aliases]),
			);
		}
		if (custom_data.tags != null && custom_data.tags.length > 0) {
			const existingTags = baseData.tags || [];
			baseData.tags = Array.from(
				new Set([...existingTags, ...custom_data.tags]),
			);
		}
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
