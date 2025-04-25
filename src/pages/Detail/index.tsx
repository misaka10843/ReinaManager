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
import { useGamePlayStore } from '@/store/gamePlayStore';
import { PageContainer } from '@toolpad/core';
import type { GameData } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Box, Stack, Chip, Paper } from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TodayIcon from '@mui/icons-material/Today';
import BackupIcon from '@mui/icons-material/Backup';
import type { GameTimeStats } from '@/types';
import { LineChart } from '@mui/x-charts/LineChart';
import { useLocation } from 'react-router';

/**
 * 图表数据类型定义
 */
interface GameTimeChartData {
    date: string;
    playtime: number;
    [key: string]: string | number;
}

/**
 * InfoBox 组件属性类型
 */
interface InfoBoxProps {
    game: GameData;
}

/**
 * InfoBox 组件
 * 展示游戏统计信息（游玩次数、今日时长、总时长、备份次数）及近7天游玩时长折线图。
 *
 * @param {InfoBoxProps} props 组件属性
 * @returns {JSX.Element} 统计信息卡片与折线图
 */
const InfoBox: React.FC<InfoBoxProps> = ({ game }) => {
    const { t } = useTranslation();
    const { loadGameStats, runningGameIds } = useGamePlayStore();
    const [stats, setStats] = useState<GameTimeStats | null>(null);
    const gameId = game.id as number;

    // 存储上一次游戏运行状态，用于检测变化
    const prevRunningRef = useRef(false);

    /**
     * 异步加载游戏统计数据
     */
    const fetchStats = useCallback(async () => {
        try {
            const gameStats = await loadGameStats(gameId, true); // 强制刷新
            setStats(gameStats);
        } catch (error) {
            console.error('加载游戏统计失败:', error);
        }
    }, [gameId, loadGameStats]);

    // 初始加载数据
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // 监听当前游戏的运行状态变化，关闭后自动刷新统计
    useEffect(() => {
        const isCurrentGameRunning = runningGameIds.has(gameId);
        if (prevRunningRef.current && !isCurrentGameRunning) {
            // 游戏刚刚关闭，延迟一点执行以确保后端数据已更新
            const timer = setTimeout(() => {
                fetchStats();
            }, 500);
            return () => clearTimeout(timer);
        }
        prevRunningRef.current = isCurrentGameRunning;
    }, [runningGameIds, gameId, fetchStats]);

    /**
     * 统计项数据
     */
    const statItems = useMemo(() =>
        [
            {
                color: 'primary',
                icon: <SportsEsportsIcon fontSize="small" />,
                title: t('pages.Detail.playCount'),
                value: stats ? `${stats.sessionCount}` : '0'
            },
            {
                color: 'primary',
                icon: <TodayIcon fontSize="small" />,
                title: t('pages.Detail.todayPlayTime'),
                value: stats ? `${stats.todayPlayTime}` : '0分钟'
            },
            {
                color: 'primary',
                icon: <AccessTimeIcon fontSize="small" />,
                title: t('pages.Detail.totalPlayTime'),
                value: stats ? `${stats.totalPlayTime}` : '0分钟'
            },
            {
                color: 'primary',
                icon: <BackupIcon fontSize="small" />,
                title: t('pages.Detail.backupCount'),
                value: '0' // 备份功能暂未实现，保留原值
            }
        ],
        [stats, t]
    )

    /**
     * 生成近7天的游玩时长数据，补全无数据的日期
     */
    const chartData = useMemo(() => {
        const datePlaytimeMap = new Map<string, number>();
        if (stats?.daily_stats) {
            for (const item of stats.daily_stats) {
                datePlaytimeMap.set(item.date, item.playtime);
            }
        }
        const result: GameTimeChartData[] = [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            result.push({
                date: dateStr,
                playtime: datePlaytimeMap.get(dateStr) || 0
            });
        }
        return result;
    }, [stats?.daily_stats]);

    return (
        <>
            {/* 统计信息卡片 */}
            <Box className="mt-16 mb-12">
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {t('pages.Detail.gameStats')}
                </Typography>
                <div className="grid grid-cols-4 gap-4">
                    {statItems.map((item) => (
                        <Paper
                            key={item.title}
                            elevation={0}
                            className={`
                                p-4 rounded-lg overflow-hidden
                                transition-all duration-200
                                hover:shadow-md hover:scale-[1.02]
                                ${item.color === 'primary' ? 'bg-blue-50/40 border border-blue-100/40' : 'bg-green-50/40 border border-green-100/40'}
                            `}
                        >
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="text-[#1976d2] flex-shrink-0 flex items-center">
                                    {item.icon}
                                </span>
                                <Typography
                                    variant="body2"
                                    className="font-medium text-gray-600 truncate"
                                    title={item.title}
                                >
                                    {item.title}
                                </Typography>
                            </div>
                            <Typography variant="h6" className="font-bold">
                                {item.value}
                            </Typography>
                        </Paper>
                    ))}
                </div>
            </Box>
            {/* 近7天游玩时长折线图 */}
            {
                chartData.length > 0 &&
                <LineChart
                    dataset={chartData}
                    xAxis={[{
                        dataKey: 'date',
                        scaleType: 'point'
                    }]}
                    yAxis={[{
                        min: 0,
                        max: chartData.every(item => item.playtime === 0) ? 10 : undefined,
                        label: t('pages.Detail.playTimeMinutes'),
                        scaleType: 'linear',
                        tickMinStep: 1
                    }]}
                    series={[{ dataKey: 'playtime', color: '#1976d2' }]}
                    height={300}
                    grid={{ vertical: true, horizontal: true }}
                />
            }
        </>
    );
};

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
    const id = Number(useLocation().pathname.split('/').pop());

    // 加载游戏数据
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
    }, [id, getGameById, setSelectedGameId]);

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
                                    <Typography>custom</Typography>
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
                                <Typography>{new Date(game.time).toLocaleDateString()}</Typography>
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
                {/* 统计信息卡片 */}
                <InfoBox game={game} />
                {/* 游戏简介 */}
                <Box className="mt-3">
                    <Typography variant="h6" fontWeight="bold">{t('pages.Detail.introduction')}</Typography>
                    <Typography className="mt-1">{game.summary}</Typography>
                </Box>
            </Box>
        </PageContainer>
    )
}