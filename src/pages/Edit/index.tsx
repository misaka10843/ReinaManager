import { useStore } from "@/store";
import type { GameData } from "@/types";
import { useEffect, useState } from "react";
// import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

export const Edit = () => {
    // const { t } = useTranslation();
    const { getGameById } = useStore();
    const [game, setGame] = useState<GameData>();
    const id = Number(useLocation().pathname.split('/').pop());

    // 加载游戏数据
    useEffect(() => {
        getGameById(id)
            .then(data => {
                setGame(data);
            })
            .catch(error => {
                console.error('获取游戏数据失败:', error);
            })
    }, [id, getGameById]);
    return (
        <h1>{game?.name}</h1>
    );
}