import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SortableCardsGrid, VirtualCardsGrid } from "@/components/Cards";
import { GameListStateView } from "@/components/GameListStateView";
import {
	getActiveGameFilterCount,
	useGameListFacade,
	useGameListPreferences,
} from "@/hooks/features/games/useGameListFacade";
import { useStore } from "@/store/appStore";
import type { GameIndex } from "@/utils/game/gameIndex";

interface DeveloperGamesViewProps {
	sourceGameIds: number[];
	scrollRestoreKey: string;
}

function DeveloperGamesView({
	sourceGameIds,
	scrollRestoreKey,
}: DeveloperGamesViewProps) {
	const { t } = useTranslation();
	const gameList = useGameListFacade({
		scopeGameIds: sourceGameIds,
		applyNsfwFilter: false,
	});
	const emptyMessage =
		sourceGameIds.length === 0
			? t("pages.Collection.noGamesInCategory", "当前分类下暂无游戏")
			: t("pages.Collection.noMatchingGames", "没有找到符合条件的游戏");

	return (
		<GameListStateView
			loading={gameList.isLoading}
			error={gameList.isError ? gameList.error : null}
			empty={gameList.gameIds.length === 0}
			emptyMessage={emptyMessage}
		>
			<VirtualCardsGrid
				gameIds={gameList.gameIds}
				displayById={gameList.displayById}
				scrollRestoreKey={scrollRestoreKey}
				enableBatchMode
				enableSortFieldOverlay
			/>
		</GameListStateView>
	);
}

interface CollectionGamesViewProps {
	realCategoryId: number | null;
	gameIds: number[];
	displayById: GameIndex["displayById"];
	loading: boolean;
	error: unknown;
	scrollRestoreKey: string;
}

export function CollectionGamesView({
	realCategoryId,
	gameIds,
	displayById,
	loading,
	error,
	scrollRestoreKey,
}: CollectionGamesViewProps) {
	if (realCategoryId === null) {
		return (
			<DeveloperGamesView
				sourceGameIds={gameIds}
				scrollRestoreKey={scrollRestoreKey}
			/>
		);
	}

	return (
		<RealCategoryGamesView
			key={realCategoryId}
			realCategoryId={realCategoryId}
			gameIds={gameIds}
			displayById={displayById}
			loading={loading}
			error={error}
			scrollRestoreKey={scrollRestoreKey}
		/>
	);
}

function RealCategoryGamesView({
	realCategoryId,
	gameIds,
	loading,
	error,
}: CollectionGamesViewProps & { realCategoryId: number }) {
	const { t } = useTranslation();
	const preferences = useGameListPreferences("collection");
	const search = useStore((s) => s.collectionGameSearch);
	const gameList = useGameListFacade({
		scopeGameIds: gameIds,
		applyNsfwFilter: false,
		preferencesScope: "collection",
	});
	const hasFilters =
		search.trim().length > 0 || getActiveGameFilterCount(preferences) > 0;
	const isManualSort = preferences.sortOption === "manual";
	const canDragSort = isManualSort && !hasFilters && !gameList.isSearchPending;
	const viewKey = JSON.stringify([
		search,
		preferences.gameFilterType,
		preferences.playStatusFilter,
		preferences.tagFilters,
		preferences.sortOption,
		preferences.sortOrder,
	]);
	const previousViewKey = useRef(viewKey);
	useEffect(() => {
		if (previousViewKey.current !== viewKey) {
			previousViewKey.current = viewKey;
			document.querySelector<HTMLElement>("main")?.scrollTo({ top: 0 });
		}
	}, [viewKey]);

	return (
		<GameListStateView
			loading={loading || gameList.isLoading}
			error={error ?? (gameList.isError ? gameList.error : null)}
			empty={gameList.gameIds.length === 0}
			emptyMessage={
				gameIds.length === 0
					? t("pages.Collection.noGamesInCategory", "当前分类下暂无游戏")
					: t("pages.Collection.noMatchingGames", "没有找到符合条件的游戏")
			}
		>
			<SortableCardsGrid
				gameIds={gameList.gameIds}
				displayById={gameList.displayById}
				categoryId={realCategoryId}
				dragSortEnabled={canDragSort}
			/>
		</GameListStateView>
	);
}
