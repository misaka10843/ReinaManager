import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getVirtualCategoryGameIds } from "@/hooks/common/useVirtualCollections";
import {
	LOCAL_DATA_GC_TIME,
	LOCAL_DATA_STALE_TIME,
} from "@/providers/queryClient";
import { collectionService } from "@/services/invoke";
import type { GameIndex } from "@/utils/gameIndex";

export const collectionKeys = {
	all: ["collections"] as const,
	groups: () => [...collectionKeys.all, "groups"] as const,
	categories: (groupId: string) =>
		[...collectionKeys.all, "categories", groupId] as const,
	games: (categoryId: number) =>
		[...collectionKeys.all, "games", categoryId] as const,
	gameCategories: (gameId: number) =>
		[...collectionKeys.all, "gameCategories", gameId] as const,
	groupCounts: (groupIds: number[]) =>
		[...collectionKeys.all, "groupCounts", groupIds] as const,
};

const localCollectionQueryOptions = {
	staleTime: LOCAL_DATA_STALE_TIME,
	gcTime: LOCAL_DATA_GC_TIME,
};

function useGroups() {
	return useQuery({
		queryKey: collectionKeys.groups(),
		queryFn: () => collectionService.getGroups(),
		...localCollectionQueryOptions,
	});
}

function useGroupGameCounts(groupIds: number[]) {
	return useQuery({
		queryKey: collectionKeys.groupCounts(groupIds),
		queryFn: () => collectionService.batchCountGamesInGroups(groupIds),
		enabled: groupIds.length > 0,
		...localCollectionQueryOptions,
	});
}

function useCategories(groupId: string | null) {
	const isEnabled = Boolean(groupId) && !groupId?.startsWith("default_");

	return useQuery({
		queryKey: collectionKeys.categories(groupId ?? "none"),
		queryFn: async () => {
			if (!groupId || groupId.startsWith("default_")) {
				return [];
			}

			const groupIdNum = Number.parseInt(groupId, 10);
			if (Number.isNaN(groupIdNum)) {
				return [];
			}

			return collectionService.getCategoriesWithCount(groupIdNum);
		},
		enabled: isEnabled,
		...localCollectionQueryOptions,
	});
}

function useCategoryGameIds(categoryId: number | null) {
	return useQuery({
		queryKey: collectionKeys.games(categoryId ?? 0),
		queryFn: async () => {
			if (!categoryId || categoryId < 0) {
				return [];
			}

			return collectionService.getGamesInCollection(categoryId);
		},
		enabled: categoryId !== null && categoryId > 0,
		...localCollectionQueryOptions,
	});
}

function useGameCategoryIds(gameId: number | null) {
	return useQuery({
		queryKey: collectionKeys.gameCategories(gameId ?? 0),
		queryFn: async () => {
			if (!gameId) {
				return [];
			}

			return collectionService.getGameCollectionIds(gameId);
		},
		enabled: gameId !== null && gameId > 0,
		...localCollectionQueryOptions,
	});
}

/**
 * 从收藏分类中获取游戏 ID 列表
 *
 * 支持虚拟分类（负数 ID）和真实分类（正数 ID）。
 * 返回原始 ID 列表，不做 NSFW 过滤（收藏夹显示全部内容）。
 */
function useCategoryGames(
	categoryId: number | null,
	gameIndex: Pick<GameIndex, "developerGameIdsByCategoryId">,
) {
	const categoryGameIdsQuery = useCategoryGameIds(categoryId);

	const data = useMemo((): number[] => {
		if (categoryId === null) {
			return [];
		}

		if (categoryId < 0) {
			// 虚拟分类：直接从 GameIndex 中读取预构建 ID 列表
			return getVirtualCategoryGameIds(categoryId, gameIndex);
		}

		// 真实分类：直接返回 ID 列表
		return categoryGameIdsQuery.data ?? [];
	}, [categoryGameIdsQuery.data, categoryId, gameIndex]);

	return {
		data,
		isLoading:
			categoryId !== null && categoryId > 0 && categoryGameIdsQuery.isLoading,
		isError:
			categoryId !== null && categoryId > 0 && categoryGameIdsQuery.isError,
		error: categoryGameIdsQuery.error,
	};
}

function useCreateGroup() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ name }: { name: string }) =>
			collectionService.createCollection(name, null, 0),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: collectionKeys.groups() });
		},
	});
}

function useDeleteGroup() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (groupId: number) =>
			collectionService.deleteCollection(groupId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: collectionKeys.groups() });
			queryClient.invalidateQueries({ queryKey: collectionKeys.all });
		},
	});
}

function useRenameGroup() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ groupId, newName }: { groupId: number; newName: string }) =>
			collectionService.updateCollection(groupId, newName),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: collectionKeys.groups() });
		},
	});
}

function useCreateCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ name, groupId }: { name: string; groupId: number }) =>
			collectionService.createCollection(name, groupId, 0),
		onSuccess: (_, { groupId }) => {
			queryClient.invalidateQueries({
				queryKey: collectionKeys.categories(groupId.toString()),
			});
		},
	});
}

function useDeleteCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			categoryId,
			groupId: _groupId,
		}: {
			categoryId: number;
			groupId?: string | null;
		}) => collectionService.deleteCollection(categoryId),
		onSuccess: (_, { categoryId, groupId }) => {
			queryClient.invalidateQueries({
				queryKey: collectionKeys.games(categoryId),
				exact: true,
			});
			if (groupId) {
				queryClient.invalidateQueries({
					queryKey: collectionKeys.categories(groupId),
				});
			} else {
				queryClient.invalidateQueries({ queryKey: collectionKeys.all });
			}
		},
	});
}

function useRenameCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			categoryId,
			newName,
		}: {
			categoryId: number;
			newName: string;
		}) => collectionService.updateCollection(categoryId, newName),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: collectionKeys.all });
		},
	});
}

function useAddGamesToCategories() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			gameIds,
			categoryIds,
		}: {
			gameIds: number[];
			categoryIds: number[];
		}) => collectionService.addGamesToCollections(gameIds, categoryIds),
		onSuccess: (_, { gameIds, categoryIds }) => {
			for (const categoryId of categoryIds) {
				queryClient.invalidateQueries({
					queryKey: collectionKeys.games(categoryId),
					exact: true,
				});
			}
			for (const gameId of gameIds) {
				queryClient.invalidateQueries({
					queryKey: collectionKeys.gameCategories(gameId),
					exact: true,
				});
			}
			queryClient.invalidateQueries({ queryKey: collectionKeys.all });
		},
	});
}

function useSetGameCategories() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			gameId,
			categoryIds,
		}: {
			gameId: number;
			categoryIds: number[];
		}) => collectionService.setGameCollections(gameId, categoryIds),
		onSuccess: (_, { gameId }) => {
			queryClient.invalidateQueries({
				queryKey: collectionKeys.gameCategories(gameId),
				exact: true,
			});
			queryClient.invalidateQueries({ queryKey: collectionKeys.all });
		},
	});
}

function useRemoveGamesFromCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			categoryId,
			gameIds,
		}: {
			categoryId: number;
			gameIds: number[];
		}) => collectionService.removeGamesFromCollection(gameIds, categoryId),
		onSuccess: (_, { categoryId, gameIds }) => {
			queryClient.invalidateQueries({
				queryKey: collectionKeys.games(categoryId),
				exact: true,
			});
			for (const gameId of gameIds) {
				queryClient.invalidateQueries({
					queryKey: collectionKeys.gameCategories(gameId),
					exact: true,
				});
			}
			queryClient.invalidateQueries({ queryKey: collectionKeys.all });
		},
	});
}

function useUpdateCategoryGames() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			categoryId,
			gameIds,
		}: {
			categoryId: number;
			gameIds: number[];
		}) => collectionService.updateCategoryGames(gameIds, categoryId),
		onMutate: async ({ categoryId, gameIds }) => {
			await queryClient.cancelQueries({
				queryKey: collectionKeys.games(categoryId),
			});
			const previousGameIds = queryClient.getQueryData<number[]>(
				collectionKeys.games(categoryId),
			);
			queryClient.setQueryData(collectionKeys.games(categoryId), gameIds);
			return { previousGameIds };
		},
		onError: (_error, { categoryId }, context) => {
			if (context?.previousGameIds) {
				queryClient.setQueryData(
					collectionKeys.games(categoryId),
					context.previousGameIds,
				);
			}
		},
		onSuccess: (_, { categoryId }) => {
			queryClient.invalidateQueries({
				queryKey: collectionKeys.games(categoryId),
				exact: true,
			});
			queryClient.invalidateQueries({ queryKey: collectionKeys.all });
		},
	});
}

export {
	useAddGamesToCategories,
	useCategories,
	useCategoryGameIds,
	useCategoryGames,
	useCreateCategory,
	useCreateGroup,
	useDeleteCategory,
	useDeleteGroup,
	useGameCategoryIds,
	useGroupGameCounts,
	useGroups,
	useRemoveGamesFromCategory,
	useRenameCategory,
	useRenameGroup,
	useSetGameCategories,
	useUpdateCategoryGames,
};
