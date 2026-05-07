/**
 * @file 游戏数据查询层
 * @description 使用 React Query 管理游戏列表、详情和增删改操作
 */

import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import i18next from "i18next";
import type { GameType, SortOption, SortOrder } from "@/services/invoke";
import { gameService } from "@/services/invoke";
import type {
	BatchOperationResult,
	GameData,
	InsertGameParams,
	UpdateGameParams,
} from "@/types";
import { getDisplayGameData } from "@/utils/dataTransform";

const listRelevantUpdateFields = new Set<keyof UpdateGameParams>([
	"bgm_id",
	"vndb_id",
	"ymgal_id",
	"kun_id",
	"id_type",
	"date",
	"localpath",
	"clear",
	"bgm_data",
	"vndb_data",
	"ymgal_data",
	"kun_data",
	"custom_data",
]);

function shouldInvalidateGameLists(updates: UpdateGameParams): boolean {
	return Object.keys(updates).some((field) =>
		listRelevantUpdateFields.has(field as keyof UpdateGameParams),
	);
}

export const gameKeys = {
	all: ["games"] as const,
	idLists: () => [...gameKeys.all, "idList"] as const,
	idList: (params: {
		gameType: GameType;
		sortOption: SortOption;
		sortOrder: SortOrder;
	}) => [...gameKeys.idLists(), params] as const,
	details: () => [...gameKeys.all, "detail"] as const,
	detail: (id: number) => [...gameKeys.details(), id] as const,
	vndbIds: () => [...gameKeys.all, "vndbIds"] as const,
	bgmIds: () => [...gameKeys.all, "bgmIds"] as const,
};

function useAllGames() {
	return useQuery({
		queryKey: gameKeys.all,
		queryFn: () => gameService.getAllGames("all"),
	});
}

/**
 * 查询单个游戏详情，返回展平后的 GameData
 *
 * 内部自动执行 FullGameData → GameData 转换，
 * 缓存中存储 GameData，避免下游重复转换。
 */
function useGameDetail(gameId: number | null) {
	return useQuery({
		queryKey: gameKeys.detail(gameId ?? 0),
		queryFn: async () => {
			if (gameId === null) return null;
			const fullData = await gameService.getGameById(gameId);
			return fullData ? getDisplayGameData(fullData) : null;
		},
		enabled: gameId !== null,
		placeholderData: keepPreviousData,
	});
}

/**
 * 查询排序/筛选后的游戏 ID 列表（轻量 IPC）
 *
 * 与 useAllGames（返回全量 FullGameData）不同：
 * 本函数通过后端 find_game_ids 命令只获取 ID 数组，
 * 前端已缓存完整数据，切换排序/筛选时 IPC 传输量从数 MB 降到数 KB。
 */
function useGameIdList(
	gameType: GameType,
	sortOption: SortOption,
	sortOrder: SortOrder,
) {
	return useQuery({
		queryKey: gameKeys.idList({ gameType, sortOption, sortOrder }),
		queryFn: () =>
			gameService.getGameIds(gameType, sortOption, sortOrder, i18next.language),
		placeholderData: keepPreviousData,
	});
}

function useAllVndbIds() {
	return useQuery({
		queryKey: gameKeys.vndbIds(),
		queryFn: () => gameService.getAllVndbIds(),
	});
}

function useAllBgmIds() {
	return useQuery({
		queryKey: gameKeys.bgmIds(),
		queryFn: () => gameService.getAllBgmIds(),
	});
}

function useAddGame() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (gameParams: InsertGameParams) =>
			gameService.insertGame(gameParams),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: gameKeys.all,
				exact: true,
			});
			await queryClient.invalidateQueries({ queryKey: gameKeys.idLists() });
			await queryClient.invalidateQueries({ queryKey: ["collections"] });
		},
	});
}

function useBatchAddGames() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (games: InsertGameParams[]): Promise<BatchOperationResult> =>
			gameService.insertGamesBatch(games),
		onSuccess: (result) => {
			if (result.success === 0) {
				return;
			}
			queryClient.invalidateQueries({
				queryKey: gameKeys.all,
				exact: true,
			});
			queryClient.invalidateQueries({ queryKey: gameKeys.idLists() });
			queryClient.invalidateQueries({ queryKey: ["collections"] });
		},
	});
}

function useDeleteGame() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (gameId: number) => gameService.deleteGame(gameId),
		onSuccess: (_, gameId) => {
			// 乐观更新：立即从缓存中移除已删除的游戏
			queryClient.removeQueries({
				queryKey: gameKeys.detail(gameId),
				exact: true,
			});
			queryClient.invalidateQueries({ queryKey: gameKeys.all, exact: true });
			queryClient.invalidateQueries({ queryKey: gameKeys.idLists() });
			queryClient.invalidateQueries({ queryKey: ["collections"] });
			queryClient.invalidateQueries({ queryKey: ["stats"] });
		},
	});
}

function useDeleteGames() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (gameIds: number[]) => gameService.deleteGames(gameIds),
		onSuccess: (_, gameIds) => {
			// 乐观更新：立即从缓存中移除已删除的游戏
			for (const gameId of gameIds) {
				queryClient.removeQueries({
					queryKey: gameKeys.detail(gameId),
					exact: true,
				});
			}
			queryClient.invalidateQueries({ queryKey: gameKeys.all, exact: true });
			queryClient.invalidateQueries({ queryKey: gameKeys.idLists() });
			queryClient.invalidateQueries({ queryKey: ["collections"] });
			queryClient.invalidateQueries({ queryKey: ["stats"] });
		},
	});
}

function useUpdateGame() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			gameId,
			updates,
		}: {
			gameId: number;
			updates: UpdateGameParams;
		}) => gameService.updateGame(gameId, updates),
		onSuccess: (updatedFullGame, { gameId, updates }) => {
			// 更新 detail 缓存（存储 GameData）
			queryClient.setQueryData(
				gameKeys.detail(gameId),
				getDisplayGameData(updatedFullGame),
			);

			if (shouldInvalidateGameLists(updates)) {
				queryClient.invalidateQueries({ queryKey: gameKeys.idLists() });
				queryClient.invalidateQueries({
					queryKey: gameKeys.all,
					exact: true,
				});
			}
		},
	});
}

function useBatchUpdateGames() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (updates: Array<[number, UpdateGameParams]>) =>
			gameService.updateBatch(updates),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: gameKeys.all,
				exact: true,
			});
		},
	});
}

/**
 * 从 React Query 缓存中读取单个游戏的 GameData
 *
 * 与 useGameDetail 不同：不创建 useQuery 订阅，以 O(1) 直接从缓存读取。
 * 适用于回调、事件处理等非渲染场景。
 */
function useGameByIdFromCache(gameId: number): GameData | undefined {
	const queryClient = useQueryClient();
	return queryClient.getQueryData<GameData>(gameKeys.detail(gameId));
}

export {
	useAddGame,
	useAllBgmIds,
	useAllGames,
	useAllVndbIds,
	useBatchAddGames,
	useBatchUpdateGames,
	useDeleteGame,
	useDeleteGames,
	useGameByIdFromCache,
	useGameDetail,
	useGameIdList,
	useUpdateGame,
};
