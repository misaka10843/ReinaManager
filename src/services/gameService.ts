/**
 * @file 游戏数据服务
 * @description 封装所有游戏相关的后端调用
 */

import type {
	BgmData,
	FullGameData,
	OtherData,
	RawGameData,
	VndbData,
} from "@/types";
import { BaseService } from "./base";
import type { GameType, SortOption, SortOrder } from "./types";

class GameService extends BaseService {
	/**
	 * 插入游戏数据（包含关联数据）
	 */
	async insertGame(
		game: RawGameData,
		bgm?: BgmData | null,
		vndb?: VndbData | null,
		other?: OtherData | null,
	): Promise<number> {
		return this.invoke<number>("insert_game_with_related", {
			game,
			bgm: bgm || null,
			vndb: vndb || null,
			other: other || null,
		});
	}

	/**
	 * 根据 ID 查询完整游戏数据（包含关联数据）
	 */
	async getGameById(id: number): Promise<FullGameData | null> {
		return this.invoke<FullGameData | null>("find_full_game_by_id", { id });
	}

	/**
	 * 获取完整游戏数据（包含关联），支持按类型筛选和排序
	 */
	async getFullGames(
		gameType: GameType = "all",
		sortOption: SortOption = "addtime",
		sortOrder: SortOrder = "asc",
	): Promise<FullGameData[]> {
		return this.invoke<FullGameData[]>("find_full_games", {
			gameType,
			sortOption,
			sortOrder,
		});
	}

	/**
	 * 批量更新游戏数据（包含关联数据）
	 */
	async updateGameWithRelated(
		gameId: number,
		updates: Partial<FullGameData>,
	): Promise<void> {
		return this.invoke<void>("update_game_with_related", {
			gameId,
			updates,
		});
	}

	/**
	 * 删除游戏
	 */
	async deleteGame(id: number): Promise<number> {
		return this.invoke<number>("delete_game", { id });
	}

	/**
	 * 删除指定游戏的 BGM 关联数据
	 */
	async deleteBgmData(gameId: number): Promise<number> {
		return this.invoke<number>("delete_bgm_data", { gameId });
	}

	/**
	 * 删除指定游戏的 VNDB 关联数据
	 */
	async deleteVndbData(gameId: number): Promise<number> {
		return this.invoke<number>("delete_vndb_data", { gameId });
	}

	/**
	 * 删除指定游戏的 Other 关联数据
	 */
	async deleteOtherData(gameId: number): Promise<number> {
		return this.invoke<number>("delete_other_data", { gameId });
	}

	/**
	 * 批量删除游戏
	 */
	async deleteGames(ids: number[]): Promise<number> {
		return this.invoke<number>("delete_games_batch", { ids });
	}

	/**
	 * 获取游戏总数
	 */
	async countGames(): Promise<number> {
		return this.invoke<number>("count_games");
	}

	/**
	 * 检查 BGM ID 是否已存在
	 */
	async gameExistsByBgmId(bgmId: string): Promise<boolean> {
		return this.invoke<boolean>("game_exists_by_bgm_id", { bgmId });
	}

	/**
	 * 检查 VNDB ID 是否已存在
	 */
	async gameExistsByVndbId(vndbId: string): Promise<boolean> {
		return this.invoke<boolean>("game_exists_by_vndb_id", { vndbId });
	}

	/**
	 * 获取所有游戏的 BGM ID 列表
	 * @returns 返回 [{ id, bgm_id }, ...] 的数组，只包含有 BGM ID 的游戏
	 */
	async getAllBgmIds(): Promise<Array<[number, string]>> {
		return this.invoke<Array<[number, string]>>("get_all_bgm_ids", {});
	}

	/**
	 * 获取所有游戏的 VNDB ID 列表
	 * @returns 返回 [{ id, vndb_id }, ...] 的数组，只包含有 VNDB ID 的游戏
	 */
	async getAllVndbIds(): Promise<Array<[number, string]>> {
		return this.invoke<Array<[number, string]>>("get_all_vndb_ids", {});
	}

	/**
	 * 批量更新数据（支持游戏基础数据和关联数据的统一接口）
	 *
	 * 使用单个事务处理所有更新操作，支持同时更新游戏基础数据和关联数据。
	 * 性能远优于逐个更新。
	 *
	 * @param gamesUpdates 游戏基础数据更新列表（可选）
	 * @param bgmUpdates BGM 数据更新列表（可选）
	 * @param vndbUpdates VNDB 数据更新列表（可选）
	 * @param otherUpdates Other 数据更新列表（可选）
	 * @returns 返回成功更新的游戏数量（仅计算 games 表的更新数）
	 *
	 * @example
	 * // 仅更新游戏基础数据
	 * await gameService.updateBatch(
	 *   [[1, { clear: 1, custom_name: "新名称" }]],
	 *   undefined,
	 *   undefined,
	 *   undefined
	 * );
	 *
	 * // 同时更新游戏和关联数据
	 * await gameService.updateBatch(
	 *   [[1, { bgm_id: "12345" }]],
	 *   [[1, { score: 85 }]],
	 *   [[2, { score: 90 }]],
	 *   undefined
	 * );
	 */
	async updateBatch(
		gamesUpdates?: Array<[number, Partial<RawGameData>]>,
		bgmUpdates?: Array<[number, BgmData]>,
		vndbUpdates?: Array<[number, VndbData]>,
		otherUpdates?: Array<[number, OtherData]>,
	): Promise<number> {
		return this.invoke<number>("update_batch", {
			gamesUpdates: gamesUpdates || null,
			bgmUpdates: bgmUpdates || null,
			vndbUpdates: vndbUpdates || null,
			otherUpdates: otherUpdates || null,
		});
	}
}

// 导出单例
export const gameService = new GameService();
