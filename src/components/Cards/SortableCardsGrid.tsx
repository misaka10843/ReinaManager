import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	type SortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	memo,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import type { GridStateSnapshot } from "react-virtuoso";
import type { GameData } from "@/types";
import { GameCardItem } from "./CardItem";
import type { GameCardItemProps, SortableCardItemProps } from "./types";
import type { useDragSort } from "./useDragSort";
import { VirtualCardsGridContent } from "./VirtualCardsGrid";

interface SortableCardsGridProps {
	dragSort: ReturnType<typeof useDragSort>;
	displayById: Map<number, GameData>;
	getCardProps: GameCardItemProps["getCardProps"];
	closeContextMenu: () => void;
	scrollRestoreKey: string;
	restoreScroll?: boolean;
}

interface GridLayout extends GridStateSnapshot {
	columns: number;
}

type LandingRect = Pick<DOMRect, "left" | "top" | "width" | "height">;

interface CardLanding {
	gameId: number;
	from: LandingRect;
	to: LandingRect;
}

// 与 arrayMove 的插入语义一致；拖动中每张卡片只算下标，避免反复复制完整数组。
function getMovedIndex(index: number, activeIndex: number, overIndex: number) {
	if (activeIndex < 0 || overIndex < 0) return index;
	if (index === activeIndex) return overIndex;
	if (activeIndex < overIndex && index > activeIndex && index <= overIndex) {
		return index - 1;
	}
	if (activeIndex > overIndex && index >= overIndex && index < activeIndex) {
		return index + 1;
	}
	return index;
}

const autoScroll = {
	canScroll: (element: Element) => element.tagName === "MAIN",
	interval: 16,
	acceleration: 16,
};

const SortableCardItem = memo((props: SortableCardItemProps) => {
	const { game, index, getCardProps, disabledSortable, isLanding } = props;
	const getNewIndex = useCallback(
		({ activeIndex, overIndex }: { activeIndex: number; overIndex: number }) =>
			getMovedIndex(index, activeIndex, overIndex),
		[index],
	);

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: game.id, disabled: disabledSortable, getNewIndex });

	const style = useMemo(
		() => ({
			transform: CSS.Transform.toString(transform),
			transition,
			zIndex: isDragging ? 1000 : ("auto" as const),
		}),
		[transform, transition, isDragging],
	);

	return (
		<div
			ref={setNodeRef}
			data-game-id={game.id}
			style={style}
			// 浮层落位结束后才交接给真实卡片，离屏源节点无需一直挂载。
			className={`relative min-w-0 ${isDragging || isLanding ? "opacity-0" : ""}`}
			{...(!disabledSortable ? attributes : {})}
			{...(!disabledSortable ? listeners : {})}
		>
			<GameCardItem
				game={game}
				getCardProps={getCardProps}
				isDragging={isDragging || isLanding}
			/>
		</div>
	);
});

SortableCardItem.displayName = "SortableCardItem";

/**
 * SortableCardsGrid - 虚拟化拖拽卡片布局。
 *
 * 接收 ID 数组和展示索引，渲染时按 ID 取 GameData。
 */
export const SortableCardsGrid = memo(
	({
		dragSort,
		displayById,
		getCardProps,
		closeContextMenu,
		scrollRestoreKey,
		restoreScroll = true,
	}: SortableCardsGridProps) => {
		const layoutRef = useRef<GridLayout | null>(null);
		const overlayRef = useRef<HTMLDivElement>(null);
		const landingRef = useRef<HTMLDivElement>(null);
		const [landing, setLanding] = useState<CardLanding | null>(null);
		const {
			ids,
			activeId,
			sensors,
			handleDragStart,
			handleDragCancel,
			handleDragEnd,
			isSaving,
		} = dragSort;
		const isDragSortEnabled = !isSaving;
		const handleGridStateChanged = useCallback(
			(state: GridStateSnapshot, columns: number) => {
				layoutRef.current = { ...state, columns };
			},
			[],
		);
		const sortingStrategy = useCallback<SortingStrategy>(
			({ index, activeIndex, overIndex }) => {
				const layout = layoutRef.current;
				if (!layout || layout.item.width === 0 || layout.item.height === 0) {
					return null;
				}
				const nextIndex = getMovedIndex(index, activeIndex, overIndex);
				const { columns, item, gap } = layout;
				// 规则网格的位置由全局下标决定，离屏卡片没有 DOM 也能正确让位。
				return {
					x:
						((nextIndex % columns) - (index % columns)) *
						(item.width + gap.column),
					y:
						(Math.floor(nextIndex / columns) - Math.floor(index / columns)) *
						(item.height + gap.row),
					scaleX: 1,
					scaleY: 1,
				};
			},
			[],
		);
		useLayoutEffect(() => {
			const node = landingRef.current;
			if (!landing || !node) return;
			const { from, to } = landing;
			const animation = node.animate(
				[
					{ transform: "translate(0, 0) scale(1)" },
					{
						transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
					},
				],
				{ duration: 200, easing: "ease", fill: "forwards" },
			);
			void animation.finished.then(
				() => setLanding((current) => (current === landing ? null : current)),
				() => {},
			);
			return () => animation.cancel();
		}, [landing]);
		const handleGridDragStart = useCallback(
			(event: DragStartEvent) => {
				setLanding(null);
				closeContextMenu();
				handleDragStart(event);
			},
			[closeContextMenu, handleDragStart],
		);
		const handleGridDragEnd = useCallback(
			(event: DragEndEvent) => {
				const from = overlayRef.current?.getBoundingClientRect();
				if (from && from.width > 0 && from.height > 0 && event.over) {
					const { left, top, width, height } = event.over.rect;
					// 当前落点仍在虚拟窗口内，以它的槽位落下，不查找已经卸载的源节点。
					setLanding({
						gameId: event.active.id as number,
						from: {
							left: from.left,
							top: from.top,
							width: from.width,
							height: from.height,
						},
						to: { left, top, width, height },
					});
				}
				void handleDragEnd(event);
			},
			[handleDragEnd],
		);
		const renderCard = useCallback(
			(game: GameData, index: number) => (
				<SortableCardItem
					game={game}
					index={index}
					getCardProps={getCardProps}
					disabledSortable={!isDragSortEnabled}
					isLanding={landing?.gameId === game.id}
				/>
			),
			[getCardProps, isDragSortEnabled, landing?.gameId],
		);
		const activeGame =
			activeId === null ? undefined : displayById.get(activeId);
		const landingGame = landing ? displayById.get(landing.gameId) : undefined;

		return (
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				autoScroll={autoScroll}
				onDragStart={isDragSortEnabled ? handleGridDragStart : undefined}
				onDragCancel={handleDragCancel}
				onDragEnd={isDragSortEnabled ? handleGridDragEnd : undefined}
			>
				<SortableContext items={ids} strategy={sortingStrategy}>
					<VirtualCardsGridContent
						// 虚拟窗口重排由列表负责，浏览器的锚点补偿会把落点推走一整行。
						className="[overflow-anchor:none]"
						gameIds={ids}
						displayById={displayById}
						getCardProps={getCardProps}
						scrollRestoreKey={scrollRestoreKey}
						restoreScroll={restoreScroll}
						renderCard={renderCard}
						onGridStateChanged={handleGridStateChanged}
						bufferRows={2}
					/>
				</SortableContext>
				{/* 预览只负责显示，不抢占落点卡片的悬停状态。 */}
				{createPortal(
					<DragOverlay className="pointer-events-none" dropAnimation={null}>
						{activeGame && (
							<div ref={overlayRef}>
								<GameCardItem
									game={activeGame}
									getCardProps={getCardProps}
									isOverlay
								/>
							</div>
						)}
					</DragOverlay>,
					document.body,
				)}
				{landing &&
					landingGame &&
					createPortal(
						<div
							ref={landingRef}
							className="fixed pointer-events-none z-1000 origin-top-left"
							style={{
								left: landing.from.left,
								top: landing.from.top,
								width: landing.from.width,
								height: landing.from.height,
							}}
						>
							<GameCardItem
								game={landingGame}
								getCardProps={getCardProps}
								isOverlay
							/>
						</div>,
						document.body,
					)}
			</DndContext>
		);
	},
);

SortableCardsGrid.displayName = "SortableCardsGrid";
