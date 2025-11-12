/**
 * @file useVirtualCategories Hook
 * @description 虚拟分类生成器，包含开发商分类和游戏状态分类，使用缓存优化性能
 * @module src/hooks/useVirtualCategories
 * @author ReinaManager
 * @copyright AGPL-3.0
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GameData } from "@/types";
import type { Category } from "@/types/collection";
import { PLAY_STATUS_LABELS, PlayStatus } from "@/types/collection";

/**
 * 生成开发商分类
 * 支持多开发商拆分（如 "Makura/Frontwing" 会被拆分为两个分类）
 * 使用 useMemo 缓存结果，仅在 allGames 变化时重新计算
 */
export function useDeveloperCategories(allGames: GameData[]): Category[] {
	const { t } = useTranslation();

	return useMemo(() => {
		const developerMap = new Map<string, Set<number>>();

		for (const game of allGames) {
			// 只处理有有效 ID 的游戏
			if (!game.id || typeof game.id !== "number") continue;

			// 从展开的 GameData 中获取开发商信息
			const developerStr = game.developer || t("category.unknownDeveloper");

			// 使用 / 拆分多个开发商
			const developers = developerStr
				.split("/")
				.map((dev) => dev.trim())
				.filter((dev) => dev.length > 0);

			// 如果拆分后为空，使用未知开发商
			if (developers.length === 0) {
				developers.push(t("category.unknownDeveloper"));
			}

			// 为每个开发商添加游戏
			for (const developer of developers) {
				if (!developerMap.has(developer)) {
					developerMap.set(developer, new Set());
				}
				const devSet = developerMap.get(developer);
				if (devSet) {
					devSet.add(game.id);
				}
			}
		}

		return Array.from(developerMap.entries())
			.sort((a, b) => b[1].size - a[1].size) // 按游戏数量降序
			.map(([name, gameIds], index) => ({
				id: -(index + 101), // 开发商分类从 -101 开始
				name,
				sort_order: 0,
				game_count: gameIds.size,
			}));
	}, [allGames, t]);
}

/**
 * 生成游戏状态分类
 * 基于 games.clear 字段，兼容 0/1 和未来的 1-5 枚举
 * 使用 useMemo 缓存结果
 */
export function usePlayStatusCategories(allGames: GameData[]): Category[] {
	return useMemo(() => {
		const statusMap = new Map<PlayStatus, number>();

		// 初始化所有状态为0
		statusMap.set(PlayStatus.WISH, 0);
		statusMap.set(PlayStatus.PLAYING, 0);
		statusMap.set(PlayStatus.PLAYED, 0);
		statusMap.set(PlayStatus.ON_HOLD, 0);
		statusMap.set(PlayStatus.DROPPED, 0);

		// 统计每个状态的游戏数量
		for (const game of allGames) {
			// 兼容当前的 1/0 状态：0=想玩(1), 1=玩过(3)
			// 未来 clear 字段直接存储 1-5
			const clearValue = game.clear || 0;
			let playStatus: PlayStatus;

			if (clearValue === 0) {
				playStatus = PlayStatus.WISH; // 未通关 -> 想玩
			} else if (clearValue === 1) {
				playStatus = PlayStatus.PLAYED; // 已通关 -> 玩过
			} else {
				playStatus = clearValue as PlayStatus; // 未来的 2-5 状态
			}

			statusMap.set(playStatus, (statusMap.get(playStatus) || 0) + 1);
		}

		// 转换为分类列表
		return Array.from(statusMap.entries()).map(([status, count]) => ({
			id: -status, // 游戏状态分类：WISH=-1, PLAYING=-2, PLAYED=-3, ON_HOLD=-4, DROPPED=-5
			name: PLAY_STATUS_LABELS[status],
			sort_order: status,
			game_count: count,
		}));
	}, [allGames]);
}

/**
 * 获取虚拟分类下的游戏列表
 * 根据分类ID类型分发到不同的筛选逻辑
 */
export function getVirtualCategoryGames(
	categoryId: number,
	categoryName: string | null,
	allGames: GameData[],
	t: (key: string) => string,
): GameData[] {
	// 游戏状态分类（-1 到 -5）
	if (categoryId >= -5 && categoryId < 0) {
		const playStatus = Math.abs(categoryId); // 转换为 PlayStatus 值 (1-5)
		return allGames.filter((game) => {
			const clearValue = game.clear || 0;
			// 兼容当前的 0/1 状态
			if (clearValue === 0) {
				return playStatus === 1; // WISH
			}
			if (clearValue === 1) {
				return playStatus === 3; // PLAYED
			}
			// 未来直接匹配 1-5 状态
			return clearValue === playStatus;
		});
	}

	// 开发商分类（负数ID <= -101）
	if (categoryId < -100 && categoryName) {
		return allGames.filter((game) => {
			// 统一处理开发商名称：空值映射为"未知开发商"翻译
			const gameDeveloperStr = game.developer || t("category.unknownDeveloper");

			// 拆分游戏的多个开发商
			const developers = gameDeveloperStr
				.split("/")
				.map((dev) => dev.trim())
				.filter((dev) => dev.length > 0);

			// 如果没有开发商，使用未知开发商
			if (developers.length === 0) {
				developers.push(t("category.unknownDeveloper"));
			}

			// 检查当前分类的开发商是否在游戏的开发商列表中
			return developers.includes(categoryName);
		});
	}

	return [];
}

/**
 * 判断是否为虚拟分类
 */
export function isVirtualCategory(categoryId: number): boolean {
	return categoryId < 0;
}

/**
 * 判断是否为开发商分类
 */
export function isDeveloperCategory(categoryId: number): boolean {
	return categoryId <= -101;
}

/**
 * 判断是否为游戏状态分类
 */
export function isPlayStatusCategory(categoryId: number): boolean {
	return categoryId >= -5 && categoryId < 0;
}
