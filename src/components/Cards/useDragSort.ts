import {
	type DragEndEvent,
	type DragStartEvent,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdateCategoryGames } from "@/hooks/queries/useCollections";

/**
 * 拖拽排序 Hook - 管理拖拽相关状态和逻辑
 *
 * 操作纯 ID 数组，不再依赖完整 GameData 对象。
 */
export function useDragSort(options: {
	gameIds: number[];
	categoryId?: number;
	enabled: boolean;
}) {
	const { gameIds, categoryId, enabled } = options;
	const updateCategoryGamesMutation = useUpdateCategoryGames();

	const [sortableIds, setSortableIds] = useState(gameIds);
	const [activeId, setActiveId] = useState<number | null>(null);
	const isDraggingRef = useRef(false);

	const ids = enabled ? sortableIds : gameIds;

	// 排序模式保留本地顺序，非排序模式直接使用外部数据，避免删除后慢一帧
	useEffect(() => {
		if (enabled && !isDraggingRef.current) {
			setSortableIds(gameIds);
		}
	}, [enabled, gameIds]);

	// 传感器配置
	const sensors = useSensors(
		useSensor(MouseSensor, {
			activationConstraint: { distance: 10 },
		}),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 5 },
		}),
	);

	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			if (!enabled) return;
			isDraggingRef.current = true;
			setActiveId(event.active.id as number);
		},
		[enabled],
	);

	const handleDragCancel = useCallback(() => {
		isDraggingRef.current = false;
		setActiveId(null);
	}, []);

	const handleDragEnd = useCallback(
		async (event: DragEndEvent) => {
			const { active, over } = event;
			setActiveId(null);

			if (!over || active.id === over.id || !categoryId) {
				isDraggingRef.current = false;
				return;
			}

			const oldIndex = ids.indexOf(active.id as number);
			const newIndex = ids.indexOf(over.id as number);

			if (oldIndex !== -1 && newIndex !== -1) {
				const newIds = arrayMove(ids, oldIndex, newIndex);
				setSortableIds(newIds);

				try {
					await updateCategoryGamesMutation.mutateAsync({
						categoryId,
						gameIds: newIds,
					});
				} catch (error) {
					console.error("排序更新失败:", error);
					setSortableIds(ids); // 回滚
				}
			}

			isDraggingRef.current = false;
		},
		[ids, categoryId, updateCategoryGamesMutation],
	);

	return {
		ids,
		activeId,
		sensors,
		handleDragStart,
		handleDragCancel,
		handleDragEnd,
	};
}
