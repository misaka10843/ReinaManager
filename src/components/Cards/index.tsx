import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardMedia from "@mui/material/CardMedia";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import RightMenu from "@/components/RightMenu";
import { useStore } from "@/store";
import { useGamePlayStore } from "@/store/gamePlayStore";
import type { GameData } from "@/types";
import {
	getGameCover,
	getGameDisplayName,
	isNsfwGame,
	saveScrollPosition,
} from "@/utils";

// CardItem 组件保持不变...
const CardItem = memo(
	({
		card,
		isActive,
		onContextMenu,
		onClick,
		onDoubleClick,
		onLongPress,
		displayName,
		useDelayedClick,
	}: {
		card: GameData;
		isActive: boolean;
		onContextMenu: (e: React.MouseEvent) => void;
		onClick: () => void;
		onDoubleClick: () => void;
		onLongPress: () => void;
		displayName: string;
		useDelayedClick: boolean;
	}) => {
		const { nsfwCoverReplace } = useStore();
		const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(
			null,
		);
		const [longPressTimeout, setLongPressTimeout] =
			useState<NodeJS.Timeout | null>(null);
		const [isLongPressing, setIsLongPressing] = useState(false);
		const [hasLongPressed, setHasLongPressed] = useState(false);

		const tags = card.tags || [];
		const isNsfw = isNsfwGame(tags);

		const handleClick = () => {
			if (hasLongPressed) {
				setHasLongPressed(false);
				return;
			}

			if (useDelayedClick) {
				if (clickTimeout) {
					clearTimeout(clickTimeout);
					setClickTimeout(null);
				}

				const timeout = setTimeout(() => {
					onClick();
					setClickTimeout(null);
				}, 200);

				setClickTimeout(timeout);
			} else {
				onClick();
			}
		};

		const handleDoubleClick = () => {
			if (useDelayedClick) {
				if (clickTimeout) {
					clearTimeout(clickTimeout);
					setClickTimeout(null);
				}
			}
			onDoubleClick();
		};

		const handleMouseDown = () => {
			setHasLongPressed(false);

			if (longPressTimeout) {
				clearTimeout(longPressTimeout);
			}

			const timeout = setTimeout(() => {
				setIsLongPressing(true);
				setHasLongPressed(true);
				onLongPress();
			}, 800);

			setLongPressTimeout(timeout);
		};

		const handleMouseUp = () => {
			if (longPressTimeout) {
				clearTimeout(longPressTimeout);
				setLongPressTimeout(null);
			}
			setIsLongPressing(false);

			setTimeout(() => {
				if (hasLongPressed) {
					setHasLongPressed(false);
				}
			}, 50);
		};

		const handleMouseLeave = () => {
			if (longPressTimeout) {
				clearTimeout(longPressTimeout);
				setLongPressTimeout(null);
			}
			setIsLongPressing(false);
		};

		return (
			<Card
				key={card.id}
				className={`min-w-24 max-w-full transition-all ${isActive ? "scale-y-105" : "scale-y-100"}`}
				onContextMenu={onContextMenu}
			>
				<CardActionArea
					onClick={handleClick}
					onDoubleClick={handleDoubleClick}
					onMouseDown={handleMouseDown}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					className={`
                    duration-100 
                    hover:shadow-lg hover:scale-105 
                    active:shadow-sm active:scale-95 
                    ${isLongPressing ? "ring-2 ring-blue-500 shadow-lg" : ""}
                `}
				>
					<CardMedia
						component="img"
						className="h-auto aspect-[3/4]"
						image={
							nsfwCoverReplace && isNsfw
								? "/images/NR18.png"
								: getGameCover(card)
						}
						alt="Card Image"
						draggable="false"
						loading="lazy"
					/>
					<div
						className={`p-1 h-8 text-base truncate ${isActive ? "!font-bold text-blue-500" : ""}`}
					>
						{displayName}
					</div>
				</CardActionArea>
			</Card>
		);
	},
);

const Cards = () => {
	const selectedGameId = useStore((s) => s.selectedGameId);
	const setSelectedGameId = useStore((s) => s.setSelectedGameId);
	const cardClickMode = useStore((s) => s.cardClickMode);
	const doubleClickLaunch = useStore((s) => s.doubleClickLaunch);
	const longPressLaunch = useStore((s) => s.longPressLaunch);
	const games = useStore((s) => s.games);
	const { launchGame } = useGamePlayStore();
	const navigate = useNavigate();
	const { i18n } = useTranslation();
	const [menuPosition, setMenuPosition] = useState<{
		mouseX: number;
		mouseY: number;
		cardId: number | null;
	} | null>(null);

	// 使用 useMemo 缓存渲染项，减少不必要的重渲染
	const handleCardClick = useCallback(
		(cardId?: number, _card?: GameData) => {
			if (cardId == null) return;

			if (cardClickMode === "navigate") {
				setSelectedGameId(cardId);
				saveScrollPosition(window.location.pathname);
				navigate(`/libraries/${cardId}`);
			} else {
				setSelectedGameId(cardId);
			}
		},
		[cardClickMode, navigate, setSelectedGameId],
	);

	const handleCardDoubleClick = useCallback(
		async (cardId?: number, card?: GameData) => {
			if (cardId == null || !card) return;
			if (doubleClickLaunch && card.localpath) {
				setSelectedGameId(cardId);
				try {
					await launchGame(card.localpath, cardId);
				} catch (error) {
					console.error("启动游戏失败:", error);
				}
			}
		},
		[doubleClickLaunch, launchGame, setSelectedGameId],
	);

	const handleCardLongPress = useCallback(
		async (cardId?: number, card?: GameData) => {
			if (cardId == null || !card) return;
			if (longPressLaunch && card.localpath) {
				setSelectedGameId(cardId);
				try {
					await launchGame(card.localpath, cardId);
				} catch (error) {
					console.error("长按启动游戏失败:", error);
				}
			}
		},
		[longPressLaunch, launchGame, setSelectedGameId],
	);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent, cardId?: number) => {
			if (!cardId) return;
			setMenuPosition({
				mouseX: event.clientX,
				mouseY: event.clientY,
				cardId,
			});
			setSelectedGameId(cardId);
		},
		[setSelectedGameId],
	);

	const cardItems = useMemo(() => {
		return games.map((card) => {
			const displayName = getGameDisplayName(card, i18n.language);

			return (
				<CardItem
					key={card.id}
					card={card}
					isActive={selectedGameId === card.id}
					onContextMenu={(e) => handleContextMenu(e, card.id)}
					onClick={() => handleCardClick(card.id, card)}
					onDoubleClick={() => handleCardDoubleClick(card.id, card)}
					onLongPress={() => handleCardLongPress(card.id, card)}
					displayName={displayName}
					useDelayedClick={cardClickMode === "navigate" && doubleClickLaunch}
				/>
			);
		});
	}, [
		games,
		selectedGameId,
		i18n.language,
		cardClickMode,
		doubleClickLaunch,
		handleCardClick,
		handleCardDoubleClick,
		handleCardLongPress,
		handleContextMenu,
	]);

	// Handlers are declared above with useCallback to ensure stable references

	return (
		<div className="flex-1 text-center grid grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 p-4">
			<RightMenu
				id={menuPosition?.cardId}
				isopen={Boolean(menuPosition)}
				anchorPosition={
					menuPosition
						? { top: menuPosition.mouseY, left: menuPosition.mouseX }
						: undefined
				}
				setAnchorEl={(value) => {
					if (!value) setMenuPosition(null);
				}}
			/>

			{/* 使用缓存的卡片列表 */}
			{cardItems}
		</div>
	);
};

export default Cards;
