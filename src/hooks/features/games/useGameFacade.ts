import { useGameDetail } from "@/hooks/queries/useGames";

/**
 * 按 ID 获取单个游戏的展示数据
 *
 * useGameDetail 缓存中已存储 GameData（由 useHydrateGameCache 写入），
 * 此处直接使用，无需重复转换。
 */
export function useGameById(gameId: number | null) {
	const gameDetailQuery = useGameDetail(gameId);

	return {
		selectedGame: gameDetailQuery.data ?? null,
		isLoadingSelectedGame: gameDetailQuery.isLoading,
	};
}
