/**
 * @file Edit 页面
 * @description 游戏信息编辑页，负责加载并展示指定游戏的可编辑信息（当前仅展示名称）。
 * @module src/pages/Edit/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - Edit：游戏编辑页面主组件
 *
 * 依赖：
 * - @/store
 * - @/types
 * - react
 * - react-router
 */

import { useStore } from "@/store";
import type { GameData } from "@/types";
import { useEffect, useState } from "react";
// import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

/**
 * Edit 组件
 * 游戏信息编辑页面，加载指定游戏数据并展示（当前仅展示名称）。
 *
 * @component
 * @returns {JSX.Element} 编辑页面
 */
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