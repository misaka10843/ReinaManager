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
import { ViewUpdateGameBox } from "@/components/AlertBox";
import { snackbar } from "@/components/Snackbar";
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


    // 确认更新游戏数据（从数据源）
    const handleConfirmGameUpdate = () => {
        if (gameData && typeof gameData !== 'string') {
            updateGame(id, gameData);
            setOpenViewBox(false);
            snackbar.success('游戏信息已更新');
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
        }
    };

    // 处理游戏信息保存
    const handleGameInfoSave = async (data: Partial<GameData>) => {
        if (!selectedGame) return;

        try {
            // 使用统一的updateGame函数，一次性更新所有字段
            await updateGame(id, data);
            snackbar.success(t('pages.Detail.Edit.updateSuccess', '游戏信息已成功更新'));
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : t('pages.Detail.Edit.unknownError', '未知错误');
            snackbar.error(errorMsg);
            throw error; // 让子组件处理错误显示
        }
    };

    return (
        <Box sx={{ p: 3 }}>

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
                        />
                    </CardContent>
                </Card>
            </Stack>
        </Box>
    );
};
