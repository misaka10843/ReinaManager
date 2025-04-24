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

// 图表数据类型定义
interface GameTimeChartData {
    date: string;
    playtime: number;
    [key: string]: string | number;
}

interface InfoBoxProps {
    game: GameData;
}
// 封装的统计信息组件 - 简化为演示结构，等待重构
const InfoBox: React.FC<InfoBoxProps> = ({ game }) => {
    const { t } = useTranslation();
    const { loadGameStats, runningGameIds } = useGamePlayStore();
    const [stats, setStats] = useState<GameTimeStats | null>(null);
    const gameId = game.id as number;

    // 存储上一次游戏运行状态，用于检测变化
    const prevRunningRef = useRef(false);

    // 定义并保存 fetchStats 函数
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

    // 监听当前游戏的运行状态变化
    useEffect(() => {
        // 检查当前游戏是否正在运行
        const isCurrentGameRunning = runningGameIds.has(gameId);

        // 如果游戏从运行状态变为非运行状态，刷新统计
        if (prevRunningRef.current && !isCurrentGameRunning) {
            // 游戏刚刚关闭，延迟一点执行以确保后端数据已更新
            const timer = setTimeout(() => {
                fetchStats();// 静默更新d
            }, 500);
            return () => clearTimeout(timer); // 清理定时器
        }

        // 更新状态引用
        prevRunningRef.current = isCurrentGameRunning;
    }, [runningGameIds, gameId, fetchStats]);
    // 统计项数据
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

    // 生成过去7天的补全数据
    const chartData = useMemo(() => {
        // 创建一个日期到游戏时间的映射
        const datePlaytimeMap = new Map<string, number>();

        // 只有当存在daily_stats时才填充数据
        if (stats?.daily_stats) {
            for (const item of stats.daily_stats) {
                datePlaytimeMap.set(item.date, item.playtime);
            }
        }

        // 生成过去7天的日期数组，包括今天
        const result: GameTimeChartData[] = [];

        // 获取当前日期，使用本地时间而非UTC
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 从6天前到今天（总共7天）
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);

            // 使用本地日期格式化，避免时区转换问题
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // 如果这一天有数据则使用数据，否则设为0
            result.push({
                date: dateStr,
                playtime: datePlaytimeMap.get(dateStr) || 0
            });
        }

        return result;
    }, [stats?.daily_stats]);

    return (
        <>
            <Box className="mt-16 mb-12">
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {t('pages.Detail.gameStats')}
                </Typography>

                <div className="grid grid-cols-4 gap-4">
                    {statItems.map((item) => {
                        return (
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
                        );
                    })}
                </div>
            </Box>
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
                        // 确保绘图区域从0开始
                        scaleType: 'linear',
                        tickMinStep: 1 // 确保刻度间隔至少为1
                    }]}
                    series={[{ dataKey: 'playtime', color: '#1976d2' }]}
                    height={300}
                    grid={{ vertical: true, horizontal: true }}
                />
            }
        </>
    );
};

// 游戏详情页面
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