import { useState } from 'react';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardActionArea from '@mui/material/CardActionArea';
import RightMenu from '@/components/RightMenu';
import { useStore } from '@/store';

const Cards = () => {
    const { selectedGameId, setSelectedGameId } = useStore();
    const [menuPosition, setMenuPosition] = useState<{
        mouseX: number;
        mouseY: number;
        cardId: number | null;
    } | null>(null);

    const { games } = useStore();

    const handleContextMenu = (event: React.MouseEvent, cardId: number | undefined) => {
        if (!cardId) return;
        setMenuPosition({
            mouseX: event.clientX,
            mouseY: event.clientY,
            cardId
        });
        setSelectedGameId(cardId);
    };

    return (
        <div className="flex-1 text-center grid grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 p-4">
            <RightMenu id={menuPosition?.cardId} isopen={Boolean(menuPosition)}
                anchorPosition={
                    menuPosition
                        ? { top: menuPosition.mouseY, left: menuPosition.mouseX }
                        : undefined
                }
                setAnchorEl={(value) => {
                    if (!value) setMenuPosition(null);
                }} />
            {games.map((card) => {
                const isActive = selectedGameId === card.id; // 判断当前卡片是否被选中
                return (
                    <Card
                        key={card.id}
                        className={`min-w-24 max-w-full ${isActive ? 'scale-y-105' : ''}`}
                        onContextMenu={(e) => handleContextMenu(e, card.id)}
                    >
                        <CardActionArea
                            onClick={() => setSelectedGameId(card.id)}
                            className={`
                             duration-100 
                            hover:shadow-lg hover:scale-105 
                            active:shadow-sm active:scale-95 
                            `}
                        >
                            <CardMedia
                                component="img"
                                className="h-auto aspect-[3/4]"
                                image={card.image}
                                alt="Card Image"
                                draggable="false"
                            />
                            <div className={`p-1 h-8 text-base  truncate ${isActive ? '!font-bold text-blue-500' : ''}`}>{card.name_cn === "" ? card.name : card.name_cn}</div>
                        </CardActionArea>
                    </Card>
                )
            })}
        </div>
    );
};

export default Cards;