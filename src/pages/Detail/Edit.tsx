import { useStore } from "@/store";
import { useState } from "react";
import { useLocation } from "react-router";
import {
    Box,
    Stack,
    Card,
    CardContent,
    Typography
} from "@mui/material";
import type { GameData } from "@/types";
import { ViewUpdateGameBox, StatusAlert } from "@/components/AlertBox";
import { useTranslation } from 'react-i18next';
import { DataSourceUpdate } from './DataSourceUpdate';
import { GameInfoEdit } from './GameInfoEdit';

/**
 * Edit 组件
 * 游戏信息编辑页面主组件，管理子组件之间的状态和交互
 *
 * @component
 * @returns {JSX.Element} 编辑页面
 */
export const Edit = (): JSX.Element => {
    const { bgmToken, updateGame, selectedGame } = useStore();
    const id = Number(useLocation().pathname.split('/').pop());
    const { t } = useTranslation();

    // UI 状态
    const [gameData, setGameData] = useState<GameData | string | null>(null);
    const [openViewBox, setOpenViewBox] = useState(false);

    // 分部分的状态管理
    const [dataSourceError, setDataSourceError] = useState<string | null>(null);
    const [dataSourceSuccess, setDataSourceSuccess] = useState<string | null>(null);
    const [gameInfoError, setGameInfoError] = useState<string | null>(null);
    const [gameInfoSuccess, setGameInfoSuccess] = useState<string | null>(null);

    // 确认更新游戏数据（从数据源）
    const handleConfirmGameUpdate = () => {
        if (gameData && typeof gameData !== 'string') {
            updateGame(id, gameData);
            setOpenViewBox(false);
            setDataSourceSuccess('游戏信息已更新');
            setTimeout(() => setDataSourceSuccess(null), 3000);
        }
    };
    // 处理数据源获取的数据
    const handleDataSourceFetched = (result: GameData | string) => {
        if (result && typeof result !== 'string') {
            const updatedResult = {
                ...result
            }
            setGameData(updatedResult);
            setOpenViewBox(true);
            setDataSourceError(null);
            setDataSourceSuccess('数据获取成功，请确认更新');
            setTimeout(() => setDataSourceSuccess(null), 3000);
        } else {
            const errorMsg = typeof result === 'string' ? result : t('pages.Detail.Edit.fetchFailed', '获取数据失败');
            setDataSourceError(errorMsg);
            setDataSourceSuccess(null);
        }
    };

    // 处理游戏信息保存
    const handleGameInfoSave = async (data: Partial<GameData>) => {
        if (!selectedGame) return;

        try {
            // 使用统一的updateGame函数，一次性更新所有字段
            await updateGame(id, data);

            setGameInfoSuccess(t('pages.Detail.Edit.updateSuccess', '游戏信息已成功更新'));
            setGameInfoError(null);
            setTimeout(() => setGameInfoSuccess(null), 3000);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : t('pages.Detail.Edit.unknownError', '未知错误');
            setGameInfoError(errorMsg);
            setGameInfoSuccess(null);
            throw error; // 让子组件处理错误显示
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* 全局状态提示区域 - 只显示游戏未找到等全局错误 */}
            {!selectedGame && (
                <StatusAlert
                    gameNotFound={true}
                />
            )}

            {/* 游戏更新确认弹窗 */}
            <ViewUpdateGameBox
                open={openViewBox}
                setOpen={setOpenViewBox}
                onConfirm={handleConfirmGameUpdate}
                game={gameData}
            />

            <Stack spacing={4}>
                {/* 第一部分：数据源更新 */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            {t('pages.Detail.Edit.dataSourceUpdate', '数据源更新')}
                        </Typography>
                        <DataSourceUpdate
                            bgmToken={bgmToken}
                            selectedGame={selectedGame}
                            onDataFetched={handleDataSourceFetched}
                            onError={setDataSourceError}
                            error={dataSourceError}
                            success={dataSourceSuccess}
                        />
                    </CardContent>
                </Card>

                {/* 第二部分：游戏资料编辑 */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            {t('pages.Detail.Edit.gameInfoEdit', '游戏资料编辑')}
                        </Typography>
                        <GameInfoEdit
                            selectedGame={selectedGame}
                            onSave={handleGameInfoSave}
                            onError={setGameInfoError}
                            error={gameInfoError}
                            success={gameInfoSuccess}
                        />
                    </CardContent>
                </Card>
            </Stack>
        </Box>
    );
};
