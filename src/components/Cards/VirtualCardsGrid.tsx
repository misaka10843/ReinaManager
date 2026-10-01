import { memo, useEffect, useState } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { useVirtuosoGridRestore } from "@/hooks/common/useScrollRestore";
import type { GameData } from "@/types";
import { GameCardItem } from "./CardItem";
import type { GameCardItemProps } from "./types";
import { useCardsController } from "./useCardsController";

const BREAKPOINTS = [
	{ min: 2560, cols: 10 },
	{ min: 1920, cols: 9 },
	{ min: 1536, cols: 8 },
	{ min: 1280, cols: 7 },
	{ min: 1024, cols: 6 },
] as const;

const VIRTUAL_CARDS_GRID_CLASS =
	"grid gap-4 pb-4 [grid-template-columns:repeat(var(--virtual-cards-grid-columns),minmax(0,1fr))]";

function getColumnCount(): number {
	const width = window.innerWidth;
	for (const bp of BREAKPOINTS) {
		if (width >= bp.min) return bp.cols;
	}
	return 3;
}

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
	}: VirtualCardsGridContentProps) => {
		const [shouldRestoreScroll] = useState(restoreScroll);
		const [columns, setColumns] = useState(() => getColumnCount());

		useEffect(() => {
			const onResize = () => setColumns(getColumnCount());
			window.addEventListener("resize", onResize);
			return () => window.removeEventListener("resize", onResize);
		}, []);

		const {
			restoreProps,
			scrollParent,
			stateChanged,
			wrapperRef: virtuosoWrapperRef,
		} = useVirtuosoGridRestore({
			columns,
			itemCount: gameIds.length,
			scrollKey: scrollRestoreKey,
			restoreScroll: shouldRestoreScroll,
		});

		return (
			<div ref={virtuosoWrapperRef} className="flex-1 min-h-0">
				{scrollParent && (
					<VirtuosoGrid
						key={scrollRestoreKey ?? "no-scroll-restore"}
						customScrollParent={scrollParent}
						data={gameIds}
						computeItemKey={(index, gameId) =>
							gameId === undefined ? `missing-game-${index}` : `game-${gameId}`
						}
						listClassName={VIRTUAL_CARDS_GRID_CLASS}
						itemClassName="min-w-0"
						increaseViewportBy={{ top: 600, bottom: 1200 }}
						stateChanged={stateChanged}
						{...restoreProps}
						style={
							{
								"--virtual-cards-grid-columns": columns,
							} as React.CSSProperties
						}
						itemContent={(_, gameId) => {
							if (gameId === undefined) return null;
							const game = displayById.get(gameId);
							if (!game) return null;
							return <GameCardItem game={game} getCardProps={getCardProps} />;
						}}
					/>
				)}
			</div>
		);
	},
);

VirtualCardsGridContent.displayName = "VirtualCardsGridContent";
