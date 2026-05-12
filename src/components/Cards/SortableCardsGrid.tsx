import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
	rectSortingStrategy,
	SortableContext,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useMemo } from "react";
import type { GameData } from "@/types";
import { CardItem } from "./CardItem";
import type { SortableCardItemProps } from "./types";
import { useCardsController } from "./useCardsController";
import { useDragSort } from "./useDragSort";

interface SortableCardsGridProps {
	gameIds: number[];
	displayById: Map<number, GameData>;
	categoryId: number;
}

const SortableCardItem = memo((props: SortableCardItemProps) => {
	const { game, disabledSortable, ...restProps } = props;

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
			opacity: isDragging ? 0 : 1,
			zIndex: isDragging ? 1000 : ("auto" as const),
		}),
		[transform, transition, isDragging],
	);

	return (
		<CardItem
			ref={setNodeRef}
			style={style}
			game={game}
			{...restProps}
			{...(!disabledSortable ? attributes : {})}
			{...(!disabledSortable ? listeners : {})}
		/>
	);
});

SortableCardItem.displayName = "SortableCardItem";

/**
 * SortableCardsGrid - 拖拽卡片布局。
 *
 * 接收 ID 数组和展示索引，渲染时按 ID 取 GameData。
 */
export const SortableCardsGrid = memo(
	({ gameIds, displayById, categoryId }: SortableCardsGridProps) => {
		const {
			ids,
			activeId,
			sensors,
			handleDragStart,
			handleDragCancel,
			handleDragEnd,
		} = useDragSort({
			gameIds,
			categoryId,
			enabled: true,
		});
		const { controls, getCardProps, longPressLaunch, showBatchControls } =
			useCardsController({
				gameIds: ids,
				categoryId,
			});
		const isDragSortEnabled = !longPressLaunch && !showBatchControls;

		return (
			<DndContext
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
								const props = getCardProps(game);
								return (
									<SortableCardItem
										key={gameId}
										{...props}
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
							return <CardItem {...getCardProps(activeGame)} isOverlay />;
						})()}
				</DragOverlay>
			</DndContext>
		);
	},
);

SortableCardsGrid.displayName = "SortableCardsGrid";
