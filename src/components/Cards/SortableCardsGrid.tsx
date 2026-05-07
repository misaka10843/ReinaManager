import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
	rectSortingStrategy,
	SortableContext,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useMemo } from "react";
import { CardItem } from "./CardItem";
import type { SortableCardItemProps } from "./types";
import { useCardsController } from "./useCardsController";
import { useDragSort } from "./useDragSort";

interface SortableCardsGridProps {
	gameIds: number[];
	categoryId: number;
}

const SortableCardItem = memo((props: SortableCardItemProps) => {
	const { gameId, disabledSortable, ...restProps } = props;

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: gameId, disabled: disabledSortable });

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
			gameId={gameId}
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
 * 接收纯 ID 数组，子组件 CardItem 通过缓存字典按需获取完整数据。
 */
export const SortableCardsGrid = memo(
	({ gameIds, categoryId }: SortableCardsGridProps) => {
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
								const props = getCardProps(gameId);
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
					{activeId && (
						<CardItem
							gameId={activeId}
							isOverlay
							displayName={getCardProps(activeId).displayName}
						/>
					)}
				</DragOverlay>
			</DndContext>
		);
	},
);

SortableCardsGrid.displayName = "SortableCardsGrid";
