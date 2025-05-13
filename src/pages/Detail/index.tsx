/**
 * @file 游戏详情页
 * @description 展示单个游戏的详细信息、统计数据、标签、简介等，包含统计信息卡片和近7天游玩时长折线图，支持国际化。
 * @module src/pages/Detail/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - Detail：游戏详情页面主组件
 *
 * 依赖：
 * - @mui/material
 * - @mui/x-charts/LineChart
 * - @/store
 * - @/store/gamePlayStore
 * - @/types
 * - react-i18next
 * - react-router
 */

import { useStore } from '@/store';
import { PageContainer } from '@toolpad/core';
import type { GameData } from '@/types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Box, Stack, Chip, Tabs, Tab } from '@mui/material';
import { useLocation } from 'react-router';
import { InfoBox } from './InfoBox';
import { Edit } from './Edit';


// Tab面板组件
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel = (props: TabPanelProps) => {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`game-tab-${index}`}
            aria-labelledby={`game-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ pt: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

/**
 * Detail 组件
 * 游戏详情页面主组件，展示游戏图片、基本信息、标签、统计、简介等。
 *
 * @component
 * @returns {JSX.Element} 游戏详情页面
 */
export const Detail: React.FC = () => {
    const { t } = useTranslation();
    const { getGameById, setSelectedGameId } = useStore();
    const [game, setGame] = useState<GameData>();
    const [tabIndex, setTabIndex] = useState(0);
    const id = Number(useLocation().pathname.split('/').pop());
    const games = useStore((state) => state.games);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        0
        setTabIndex(newValue);
    };

    // 加载游戏数据
    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
        getGameById(id)
            .then(data => {
                setGame(data);
                // 设置当前选中的游戏ID，以便LaunchModal可以正确工作
                setSelectedGameId(id);
            })
            .catch(error => {
                console.error('获取游戏数据失败:', error);
            })
    }, [id, getGameById, setSelectedGameId, games]);

    if (!game) return <div>{t('pages.Detail.notFound')}</div>;

    return (
        <PageContainer sx={{ maxWidth: '100% !important' }}>
            <Box className="p-2">
                {/* 顶部区域：图片和基本信息 */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                    {/* 左侧：游戏图片 */}
                    <Box>
                        <img
                            src={game.image}
                            alt={game.name}
                            className="max-h-65 max-w-40 lg:max-w-80 rounded-lg shadow-lg select-none"
                            onDragStart={(event) => event.preventDefault()}
                        />
                    </Box>
                    {/* 右侧：游戏信息 */}
                    <Box className="flex-1">
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            className="flex flex-wrap [&>div]:mr-6 [&>div]:mb-2"
                        >
                            {game.id_type === 'custom' ?
                                <Box>
                                    <Typography variant="subtitle2" fontWeight="bold">{t('pages.Detail.gameDatafrom')}</Typography>
                                    <Typography>Custom</Typography>
                                </Box> :
                                <Box>
                                    <Typography variant="subtitle2" fontWeight="bold">{t('pages.Detail.gameDatafrom')}</Typography>
                                    <Typography>{game.bgm_id ? "Bangumi" : "Vndb"}</Typography>
                                </Box>}
                            <Box>
                                <Typography variant="subtitle2" fontWeight="bold">{t('pages.Detail.gameDeveloper')}</Typography>
                                <Typography>{game.developer || '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" fontWeight="bold">{t('pages.Detail.releaseDate')}</Typography>
                                <Typography>{game.date || '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" fontWeight="bold">{t('pages.Detail.addTime')}</Typography>
                                <Typography>{new Date(game.time as Date).toLocaleDateString()}</Typography>
                            </Box>
                            {game.rank !== 0 && game.rank !== null &&
                                <Box>
                                    <Typography variant="subtitle2" fontWeight="bold">{t('pages.Detail.gameRanking')}</Typography>
                                    <Typography>{game.rank || '-'}</Typography>
                                </Box>}
                            {game.aveage_hours &&
                                <Box>
                                    <Typography variant="subtitle2" fontWeight="bold">{t('pages.Detail.expected_hours')}</Typography>
                                    <Typography>{game.aveage_hours || '-'}h</Typography>
                                </Box>}
                            <Box>
                                <Typography variant="subtitle2" fontWeight="bold">{t('pages.Detail.gameScore')}</Typography>
                                <Typography>{game.score || '-'}</Typography>
                            </Box>
                        </Stack>
                        {/* 标签 */}
                        <Box className="mt-2">
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{t('pages.Detail.gameTags')}</Typography>
                            <Stack direction="row" className="flex-wrap gap-1">
                                {game.tags?.map(tag => (
                                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                                ))}
                            </Stack>
                        </Box>
                    </Box>
                </Stack>


                {/* 添加Tabs组件 */}
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs
                            value={tabIndex}
                            onChange={handleTabChange}
                            aria-label="game detail tabs"
                        >
                            <Tab label={t('pages.Detail.gameStats')} id="game-tab-0" aria-controls="game-tabpanel-0" />
                            <Tab label={t('pages.Detail.introduction')} id="game-tab-1" aria-controls="game-tabpanel-1" />
                            <Tab label="编辑" id="game-tab-2" aria-controls="game-tabpanel-2" />
                        </Tabs>
                    </Box>

                    {/* 统计信息Tab */}
                    <TabPanel value={tabIndex} index={0}>
                        <InfoBox game={game} />
                    </TabPanel>
                    <TabPanel value={tabIndex} index={1}>
                        {/* 游戏简介 */}
                        <Box>
                            <Typography variant="h6" fontWeight="bold">{t('pages.Detail.introduction')}</Typography>
                            <Typography className="mt-1">{game.summary}</Typography>
                        </Box>
                    </TabPanel>
                    <TabPanel value={tabIndex} index={2}>
                        <Edit />
                    </TabPanel>

                </Box>

            </Box>
        </PageContainer>
    )
}