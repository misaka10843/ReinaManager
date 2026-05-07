import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useRemoveGamesFromCategory } from "@/hooks/queries/useCollections";
import { gameKeys } from "@/hooks/queries/useGames";
import { snackbar } from "@/providers/snackBar";
import { useStore } from "@/store/appStore";
import { useGamePlayStore } from "@/store/gamePlayStore";
import type { GameData } from "@/types";
import { getGameDisplayName, saveScrollPosition } from "@/utils/appUtils";
import { getUserErrorMessage } from "@/utils/errors";
import { CardsBatchBar } from "./CardsBatchBar";
import { RightMenuHost } from "./RightMenuHost";
import type { RightMenuHostHandle, SortableCardItemProps } from "./types";

interface UseCardsControllerOptions {
	gameIds: number[];
	categoryId?: number;
}

/**
 * 从缓存字典中读取游戏展示数据（非 hook，可在回调中使用）
 */
function getGameFromCache(
	queryClient: ReturnType<typeof useQueryClient>,
	gameId: number,
): GameData | undefined {
	return (
		queryClient.getQueryData<GameData>(gameKeys.detail(gameId)) ?? undefined
	);
}

export function useCardsController({
	gameIds,
	categoryId,
}: UseCardsControllerOptions) {
	const { i18n, t } = useTranslation();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const path = useLocation().pathname;
	const isLibraries = path === "/libraries";
	const isCollectionCategory = typeof categoryId === "number" && categoryId > 0;
	const canUseBatchMode = isLibraries || isCollectionCategory;
	const rightMenuRef = useRef<RightMenuHostHandle>(null);

	const {
		setSelectedGameId,
		cardClickMode,
		doubleClickLaunch,
		longPressLaunch,
	} = useStore(
		useShallow((s) => ({
			setSelectedGameId: s.setSelectedGameId,
			cardClickMode: s.cardClickMode,
			doubleClickLaunch: s.doubleClickLaunch,
			longPressLaunch: s.longPressLaunch,
		})),
	);
	const launchGame = useGamePlayStore((s) => s.launchGame);
	const [batchMode, setBatchMode] = useState(false);
	const [selectedBatchGameIds, setSelectedBatchGameIds] = useState<number[]>(
		[],
	);
	const selectedBatchGameIdSet = useMemo(
		() => new Set(selectedBatchGameIds),
		[selectedBatchGameIds],
	);
	const showBatchControls = canUseBatchMode && batchMode;
	const removeGamesFromCategoryMutation = useRemoveGamesFromCategory();

	const toggleBatchGame = useCallback((gameId: number) => {
		setSelectedBatchGameIds((prev) =>
			prev.includes(gameId)
				? prev.filter((id) => id !== gameId)
				: [...prev, gameId],
		);
	}, []);

	const handleCardClick = useCallback(
		(cardId: number) => {
			if (showBatchControls) {
				toggleBatchGame(cardId);
				return;
			}

			if (cardClickMode === "navigate") {
				setSelectedGameId(cardId);
				saveScrollPosition(window.location.pathname);
				navigate(`/libraries/${cardId}`);
			} else {
				setSelectedGameId(cardId);
			}
		},
		[
			cardClickMode,
			navigate,
			setSelectedGameId,
			showBatchControls,
			toggleBatchGame,
		],
	);

	const handleCardDoubleClick = useCallback(
		async (cardId: number) => {
			if (showBatchControls) return;

			if (doubleClickLaunch) {
				const cached = getGameFromCache(queryClient, cardId);
				if (!cached?.localpath) return;

				setSelectedGameId(cardId);
				try {
					const result = await launchGame(cardId);
					if (!result.success) {
						snackbar.error(result.message);
					}
				} catch (error) {
					snackbar.error(getUserErrorMessage(error, i18n.t.bind(i18n)));
				}
			}
		},
		[
			doubleClickLaunch,
			launchGame,
			queryClient,
			setSelectedGameId,
			showBatchControls,
			i18n,
		],
	);

	const handleCardLongPress = useCallback(
		async (cardId: number) => {
			if (showBatchControls) return;

			if (longPressLaunch) {
				const cached = getGameFromCache(queryClient, cardId);
				if (!cached?.localpath) return;

				setSelectedGameId(cardId);
				try {
					const result = await launchGame(cardId);
					if (!result.success) {
						snackbar.error(result.message);
					}
				} catch (error) {
					snackbar.error(getUserErrorMessage(error, i18n.t.bind(i18n)));
				}
			}
		},
		[
			longPressLaunch,
			launchGame,
			queryClient,
			setSelectedGameId,
			showBatchControls,
			i18n,
		],
	);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent, cardId: number) => {
			if (showBatchControls) {
				event.preventDefault();
				return;
			}

			rightMenuRef.current?.open(cardId, event.clientX, event.clientY);
			setSelectedGameId(cardId);
		},
		[setSelectedGameId, showBatchControls],
	);

	const handleRemoveFromCategory = useCallback(
		async (targetGameIds: number[]) => {
			if (!isCollectionCategory || !categoryId) return;

			const targetGameIdSet = new Set(targetGameIds);
			await removeGamesFromCategoryMutation.mutateAsync({
				categoryId,
				gameIds: targetGameIds,
			});

			setSelectedBatchGameIds((prev) =>
				prev.filter((selectedId) => !targetGameIdSet.has(selectedId)),
			);
		},
		[categoryId, isCollectionCategory, removeGamesFromCategoryMutation],
	);

	const handleRemoveSingleFromCategory = useCallback(
		async (cardId: number) => {
			try {
				await handleRemoveFromCategory([cardId]);
				snackbar.success(
					t("components.Cards.removeFromCategorySuccess", {
						defaultValue: "已从当前分类移除",
					}),
				);
			} catch (error) {
				console.error("移出分类失败:", error);
				snackbar.error(
					t("components.Cards.removeFromCategoryFailed", {
						defaultValue: "移出分类失败",
					}),
				);
			}
		},
		[handleRemoveFromCategory, t],
	);

	const getCardProps = useCallback(
		(gameId: number): SortableCardItemProps => {
			const game = getGameFromCache(queryClient, gameId);
			return {
				gameId,
				displayName: game ? getGameDisplayName(game) : "",
				batch: showBatchControls
					? { selected: selectedBatchGameIdSet.has(gameId) }
					: undefined,
				removeAction:
					isCollectionCategory && !showBatchControls
						? {
								title: t("components.Cards.removeFromCategory", "移出当前分类"),
								onRemove: () => handleRemoveSingleFromCategory(gameId),
							}
						: undefined,
				interaction: {
					useDelayedClick:
						!showBatchControls &&
						cardClickMode === "navigate" &&
						doubleClickLaunch,
					onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, gameId),
					onClick: () => handleCardClick(gameId),
					onDoubleClick: () => handleCardDoubleClick(gameId),
					onLongPress: () => handleCardLongPress(gameId),
				},
			};
		},
		[
			cardClickMode,
			doubleClickLaunch,
			handleContextMenu,
			handleCardClick,
			handleCardDoubleClick,
			handleCardLongPress,
			handleRemoveSingleFromCategory,
			isCollectionCategory,
			queryClient,
			selectedBatchGameIdSet,
			showBatchControls,
			t,
		],
	);

	const controls = (
		<>
			{canUseBatchMode && (
				<CardsBatchBar
					batchMode={batchMode}
					selectedBatchGameIds={selectedBatchGameIds}
					gameIds={gameIds}
					categoryId={categoryId}
					onBatchModeChange={setBatchMode}
					onSelectionChange={setSelectedBatchGameIds}
					onSelectionClear={() => setSelectedBatchGameIds([])}
					onDeleteSuccess={() => setSelectedGameId(null)}
					onRemoveFromCategory={handleRemoveFromCategory}
				/>
			)}
			<RightMenuHost ref={rightMenuRef} />
		</>
	);

	return {
		controls,
		getCardProps,
		longPressLaunch,
		showBatchControls,
	};
}
