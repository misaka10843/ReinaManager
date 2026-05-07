import { memo } from "react";
import { CardItem } from "./CardItem";
import { useCardsController } from "./useCardsController";

interface CardsGridProps {
	gameIds: number[];
	categoryId?: number;
}

/**
 * CardsGrid - 普通卡片布局。
 *
 * 接收纯 ID 数组，子组件 CardItem 通过缓存字典按需获取完整数据。
 */
export const CardsGrid = memo(({ gameIds, categoryId }: CardsGridProps) => {
	const { controls, getCardProps } = useCardsController({
		gameIds,
		categoryId,
	});

	return (
		<>
			{controls}
			<div className="flex-1 min-h-0">
				<div
					className={
						"text-center grid lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-9 4xl:grid-cols-10 gap-4"
					}
				>
					{gameIds.map((gameId) => {
						const props = getCardProps(gameId);
						return <CardItem key={gameId} {...props} />;
					})}
				</div>
			</div>
		</>
	);
});

CardsGrid.displayName = "CardsGrid";
