/**
 * @file 合集服务
 * @description 封装所有合集相关的后端调用
 */

import type { Category, Group, GroupWithCategories } from "@/types/collection";
import { BaseService } from "./base";

export interface Collection {
	id: number;
	name: string;
	parent_id?: number | null;
	sort_order: number;
	icon?: string | null;
	created_at?: number;
	updated_at?: number;
}

export interface GameCollectionLink {
	id: number;
	game_id: number;
	collection_id: number;
	sort_order: number;
	created_at?: number;
}

class CollectionService extends BaseService {
	/**
	 * 创建合集
	 */
	async createCollection(
		name: string,
		parentId: number | null = null,
		sortOrder: number = 0,
		icon: string | null = null,
	): Promise<Collection> {
		return this.invoke<Collection>("create_collection", {
			name,
			parentId,
			sortOrder,
			icon,
		});
	}

	/**
	 * 根据 ID 查询合集
	 */
	async getCollectionById(id: number): Promise<Collection | null> {
		return this.invoke<Collection | null>("find_collection_by_id", { id });
	}

	/**
	 * 获取所有合集
	 */
	async getAllCollections(): Promise<Collection[]> {
		return this.invoke<Collection[]>("find_all_collections");
	}

	/**
	 * 获取根合集
	 */
	async getRootCollections(): Promise<Collection[]> {
		return this.invoke<Collection[]>("find_root_collections");
	}

	/**
	 * 获取子合集
	 */
	async getChildCollections(parentId: number): Promise<Collection[]> {
		return this.invoke<Collection[]>("find_child_collections", { parentId });
	}

	/**
	 * 更新合集
	 */
	async updateCollection(
		id: number,
		name?: string,
		parentId?: number | null,
		sortOrder?: number,
		icon?: string | null,
	): Promise<Collection> {
		return this.invoke<Collection>("update_collection", {
			id,
			name: name || null,
			parentId: parentId !== undefined ? parentId : null,
			sortOrder: sortOrder || null,
			icon: icon !== undefined ? icon : null,
		});
	}

	/**
	 * 删除合集
	 */
	async deleteCollection(id: number): Promise<number> {
		return this.invoke<number>("delete_collection", { id });
	}

	/**
	 * 检查合集是否存在
	 */
	async collectionExists(id: number): Promise<boolean> {
		return this.invoke<boolean>("collection_exists", { id });
	}

	/**
	 * 将游戏添加到合集
	 */
	async addGameToCollection(
		gameId: number,
		collectionId: number,
		sortOrder: number = 0,
	): Promise<GameCollectionLink> {
		return this.invoke<GameCollectionLink>("add_game_to_collection", {
			gameId,
			collectionId,
			sortOrder,
		});
	}

	/**
	 * 从合集中移除游戏
	 */
	async removeGameFromCollection(
		gameId: number,
		collectionId: number,
	): Promise<number> {
		return this.invoke<number>("remove_game_from_collection", {
			gameId,
			collectionId,
		});
	}

	/**
	 * 获取合集中的所有游戏 ID
	 */
	async getGamesInCollection(collectionId: number): Promise<number[]> {
		return this.invoke<number[]>("get_games_in_collection", { collectionId });
	}

	/**
	 * 获取合集中的游戏数量
	 */
	async countGamesInCollection(collectionId: number): Promise<number> {
		return this.invoke<number>("count_games_in_collection", { collectionId });
	}

	/**
	 * 批量添加游戏到合集
	 */
	async addGamesToCollection(
		gameIds: number[],
		collectionId: number,
	): Promise<void> {
		return this.invoke<void>("add_games_to_collection", {
			gameIds,
			collectionId,
		});
	}

	/**
	 * 批量从合集中移除游戏
	 */
	async removeGamesFromCollection(
		gameIds: number[],
		collectionId: number,
	): Promise<number> {
		return this.invoke<number>("remove_games_from_collection", {
			gameIds,
			collectionId,
		});
	}

	/**
	 * 检查游戏是否在合集中
	 */
	async isGameInCollection(
		gameId: number,
		collectionId: number,
	): Promise<boolean> {
		return this.invoke<boolean>("is_game_in_collection", {
			gameId,
			collectionId,
		});
	}

	// ==================== 前端友好的组合 API ====================

	/**
	 * 获取分组中的游戏总数
	 */
	async countGamesInGroup(groupId: number): Promise<number> {
		return this.invoke<number>("count_games_in_group", { groupId });
	}

	/**
	 * 获取完整的分组-分类树（一次性返回所有数据）
	 */
	async getCollectionTree(): Promise<GroupWithCategories[]> {
		return this.invoke<GroupWithCategories[]>("get_collection_tree");
	}

	/**
	 * 获取所有分组（不含分类）
	 */
	async getGroups(): Promise<Group[]> {
		return this.invoke<Group[]>("find_root_collections");
	}

	/**
	 * 获取指定分组的分类列表（带游戏数量）
	 */
	async getCategoriesWithCount(groupId: number): Promise<Category[]> {
		return this.invoke<Category[]>("get_categories_with_count", { groupId });
	}
}

// 导出单例
export const collectionService = new CollectionService();
