import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
	rectSortingStrategy,
	SortableContext,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useMemo } from "react";
import type { GameData } from "@/types";
import { GameCardItem } from "./CardItem";
import type { SortableCardItemProps } from "./types";
import { useCardsController } from "./useCardsController";
import { useDragSort } from "./useDragSort";

interface SortableCardsGridProps {
	gameIds: number[];
	dragSortEnabled: boolean;
	displayById: Map<number, GameData>;
	categoryId: number;
}

const SortableCardItem = memo((props: SortableCardItemProps) => {
	const { game, getCardProps, disabledSortable } = props;

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: game.id, disabled: disabledSortable });

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
			style={style}
			// 落下动画会恢复内联 opacity；用类隐藏源卡片，避免覆盖下一次拖拽的状态。
			className={`relative min-w-0 ${isDragging ? "opacity-0" : ""}`}
			{...(!disabledSortable ? attributes : {})}
			{...(!disabledSortable ? listeners : {})}
		>
			<GameCardItem game={game} getCardProps={getCardProps} />
		</div>
	);
});

SortableCardItem.displayName = "SortableCardItem";

/**
 * SortableCardsGrid - 拖拽卡片布局。
 *
 * 接收 ID 数组和展示索引，渲染时按 ID 取 GameData。
 */
export const SortableCardsGrid = memo(
	({
		gameIds,
		displayById,
		categoryId,
		dragSortEnabled,
	}: SortableCardsGridProps) => {
		const { controls, getCardProps, showBatchControls } = useCardsController({
			gameIds,
			categoryId,
			enableSortFieldOverlay: true,
		});
		const {
			ids,
			activeId,
			sensors,
			handleDragStart,
			handleDragCancel,
			handleDragEnd,
			isSaving,
		} = useDragSort({
			gameIds,
			categoryId,
			enabled: dragSortEnabled && !showBatchControls,
		});
		const canDragSort = dragSortEnabled && !showBatchControls;
		const isDragSortEnabled = canDragSort && !isSaving;

		return (
			<DndContext
				// 搜索、筛选或批量模式切换时取消拖拽；保存状态变化保留卡片节点。
				key={canDragSort ? "sortable" : "readonly"}
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={isDragSortEnabled ? handleDragStart : undefined}
				onDragCancel={handleDragCancel}
				onDragEnd={isDragSortEnabled ? handleDragEnd : undefined}
			>
				<SortableContext items={ids} strategy={rectSortingStrategy}>
					{controls}
					<div className="flex-1 min-h-0">
						<div
							className={
								"text-center grid lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-9 4xl:grid-cols-10 gap-4"
							}
						>
							{ids.map((gameId) => {
								const game = displayById.get(gameId);
								if (!game) return null;
								return (
									<SortableCardItem
										key={gameId}
										game={game}
										getCardProps={getCardProps}
										disabledSortable={!isDragSortEnabled}
									/>
								);
							})}
						</div>
					</div>
				</SortableContext>
				<DragOverlay>
					{activeId &&
						(() => {
							const activeGame = displayById.get(activeId);
							if (!activeGame) return null;
							return (
								<GameCardItem
									game={activeGame}
									getCardProps={getCardProps}
									isOverlay
								/>
							);
						})()}
				</DragOverlay>
			</DndContext>
		);
	},
);

SortableCardsGrid.displayName = "SortableCardsGrid";
