import { memo, type ReactNode, useCallback, useState } from "react";
import { type GridStateSnapshot, VirtuosoGrid } from "react-virtuoso";
import { useVirtuosoGridRestore } from "@/hooks/common/useScrollRestore";
import type { GameData } from "@/types";
import { GameCardItem } from "./CardItem";
import { CARDS_GRID_CLASS, useCardsGridLayout } from "./CardsGridLayout";
import type { GameCardItemProps } from "./types";
import { useCardsController } from "./useCardsController";

interface VirtualCardsGridProps {
	gameIds: number[];
	displayById: Map<number, GameData>;
	scrollRestoreKey?: string | null;
	enableBatchMode?: boolean;
	enableSortFieldOverlay?: boolean;
}

interface VirtualCardsGridContentProps
	extends Pick<
		VirtualCardsGridProps,
		"gameIds" | "displayById" | "scrollRestoreKey"
	> {
	getCardProps: GameCardItemProps["getCardProps"];
	/** 仅在挂载时使用；切换搜索、筛选或排序后忽略旧滚动快照。 */
	restoreScroll?: boolean;
	className?: string;
	renderCard?: (game: GameData, index: number) => ReactNode;
	onGridStateChanged?: (state: GridStateSnapshot, columns: number) => void;
	/** 拖拽时按实测行高缓冲，避免宽窗口下又挂载完整列表。 */
	bufferRows?: number;
}

/**
 * VirtualCardsGrid - 虚拟化游戏卡片网格
 *
 * 滚动恢复：
 * - 保存：scroll 事件中缓存 main.scrollTop - wrapper 相对偏移（列表内坐标），
 *         unmount 时写入通用滚动缓存（ref 值，避免 react-router 重置 DOM 的时序问题）
 * - 恢复：优先使用 VirtuosoGrid 状态快照，缺失时恢复列表内像素位置
 */
export const VirtualCardsGrid = memo(
	({
		gameIds,
		displayById,
		scrollRestoreKey = "libraries",
		enableBatchMode = false,
		enableSortFieldOverlay = false,
	}: VirtualCardsGridProps) => {
		const { controls, getCardProps } = useCardsController({
			gameIds,
			enableBatchMode,
			enableSortFieldOverlay,
		});
		return (
			<>
				{controls}
				<VirtualCardsGridContent
					key={scrollRestoreKey ?? "no-scroll-restore"}
					gameIds={gameIds}
					displayById={displayById}
					getCardProps={getCardProps}
					scrollRestoreKey={scrollRestoreKey}
				/>
			</>
		);
	},
);

VirtualCardsGrid.displayName = "VirtualCardsGrid";

/** 复用虚拟网格渲染，交互状态由调用方持有。 */
export const VirtualCardsGridContent = memo(
	({
		gameIds,
		displayById,
		getCardProps,
		scrollRestoreKey,
		restoreScroll = true,
		className,
		renderCard,
		onGridStateChanged,
		bufferRows,
	}: VirtualCardsGridContentProps) => {
		const [shouldRestoreScroll] = useState(restoreScroll);
		const [rowHeight, setRowHeight] = useState(0);
		const { columns, gridRef, gridStyle } = useCardsGridLayout();

		const {
			restoreProps,
			scrollParent,
			stateChanged,
			wrapperRef: virtuosoWrapperRef,
		} = useVirtuosoGridRestore({
			columns: columns ?? 1,
			itemCount: gameIds.length,
			scrollKey: scrollRestoreKey,
			restoreScroll: shouldRestoreScroll,
		});
		const handleStateChanged = useCallback(
			(state: GridStateSnapshot) => {
				stateChanged(state);
				if (columns !== null) onGridStateChanged?.(state, columns);
				if (bufferRows !== undefined) {
					setRowHeight(state.item.height + state.gap.row);
				}
			},
			[stateChanged, columns, onGridStateChanged, bufferRows],
		);

		return (
			<div
				ref={gridRef}
				className={`flex-1 min-h-0 min-w-0 ${className ?? ""}`}
			>
				<div ref={virtuosoWrapperRef}>
					{scrollParent && columns !== null && (
						<VirtuosoGrid
							key={scrollRestoreKey ?? "no-scroll-restore"}
							customScrollParent={scrollParent}
							data={gameIds}
							computeItemKey={(index, gameId) =>
								gameId === undefined
									? `missing-game-${index}`
									: `game-${gameId}`
							}
							listClassName={`${CARDS_GRID_CLASS} pb-4`}
							itemClassName="min-w-0"
							increaseViewportBy={
								bufferRows === undefined
									? { top: 600, bottom: 1200 }
									: rowHeight * bufferRows
							}
							stateChanged={handleStateChanged}
							{...restoreProps}
							style={gridStyle}
							itemContent={(index, gameId) => {
								if (gameId === undefined) return null;
								const game = displayById.get(gameId);
								if (!game) return null;
								if (renderCard) return renderCard(game, index);
								return <GameCardItem game={game} getCardProps={getCardProps} />;
							}}
						/>
					)}
				</div>
			</div>
		);
	},
);

VirtualCardsGridContent.displayName = "VirtualCardsGridContent";
