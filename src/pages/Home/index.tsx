/**
 * @file Home 页面
 * @description 应用首页，展示游戏统计信息、动态、最近游玩、最近添加等内容，支持国际化。
 * @module src/pages/Home/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - Home：主页主组件
 *
 * 依赖：
 * - @mui/material
 * - @mui/icons-material
 * - @/store
 * - @/store/gamePlayStore
 * - @/utils/gameStats
 * - @/utils
 * - @/types
 * - react-i18next
 * - react-router
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Divider
} from '@mui/material';
import {
    SportsEsports as GamesIcon,
    Storage as LocalIcon,
    EmojiEvents as CompletedIcon,
    AccessTime as TimeIcon,
    DateRange as WeekIcon,
    Today as TodayIcon,
    Gamepad as RecentlyPlayedIcon,
    AddCircle as RecentlyAddedIcon,
    Inventory as RepositoryIcon,
    Notifications as ActivityIcon
} from '@mui/icons-material';
import { useStore } from '@/store';
import { Link } from 'react-router';
import { useGamePlayStore } from '@/store/gamePlayStore';
import { getGameSessions } from '@/utils/gameStats';
import { formatRelativeTime, formatPlayTime, getGameDisplayName } from '@/utils';
import type { GameData } from '@/types';
import { useTranslation } from 'react-i18next';

/**
 * 最近游玩会话类型
 */
interface RecentSession {
    session_id: number;
    game_id: number;
    end_time: number;
    gameTitle: string;
    imageUrl: string;
}
/**
 * 最近添加游戏类型
 */
interface RecentGame {
    id: number;
    title: string;
    imageUrl: string;
    time: Date;
}
/**
 * 动态项类型
 */
interface ActivityItem {
    id: string;
    type: 'add' | 'play';
    gameId: number;
    gameTitle: string;
    imageUrl: string;
    time: number;
    duration?: number; // 仅游玩记录有
}

/**
 * 获取最近游玩、最近添加、动态数据
 * @param games 游戏列表
 * @param language 当前语言
 * @returns 包含 sessions、added、activities 的对象
 */
async function getGameActivities(games: GameData[], language: string): Promise<{
    sessions: RecentSession[];
    added: RecentGame[];
    activities: ActivityItem[];
}> {
    // 处理游玩记录
    const playItems: ActivityItem[] = [];
    const sessions: RecentSession[] = [];

    await Promise.all(
        games.filter(game => game.id).map(async (game) => {
            if (!game.id) return;
            const gameSessions = await getGameSessions(game.id, 10, 0);

            for (const s of gameSessions.filter(s => typeof s.end_time === 'number')) {
                const gameTitle = getGameDisplayName(game, language);
                const item: ActivityItem = {
                    id: `play-${s.session_id || game.id}-${s.end_time}`,
                    type: 'play',
                    gameId: game.id as number,
                    gameTitle,
                    imageUrl: game.image || '',
                    time: s.end_time as number,
                    duration: s.duration
                };
                playItems.push(item);

                // 用于最近游玩区域
                sessions.push({
                    session_id: s.session_id as number,
                    game_id: game.id as number,
                    end_time: s.end_time as number,
                    gameTitle,
                    imageUrl: game.image || '',
                });
            }
        })
    );

    // 处理添加记录
    const addItems: ActivityItem[] = [];
    const added: RecentGame[] = [];

    const filteredGames = games.filter(game => typeof game.id === 'number' && game.time);
    for (const game of filteredGames) {
        // 先处理 Date 对象，确保时间正确
        const addedDate = new Date();
        if (typeof game.time === 'object' && game.time instanceof Date) {
            addedDate.setTime(game.time.getTime());
        } else if (typeof game.time === 'number') {
            // 检查时间戳是秒还是毫秒
            const multiplier = game.time > 10000000000 ? 1 : 1000;
            addedDate.setTime(game.time * multiplier);
        } else if (typeof game.time === 'string') {
            addedDate.setTime(new Date(game.time).getTime());
        }

        // 使用处理好的 Date 获取时间戳（确保为秒级）
        const timestamp = Math.floor(addedDate.getTime() / 1000);
        const gameTitle = getGameDisplayName(game, language);

        const item: ActivityItem = {
            id: `add-${game.id}`,
            type: 'add',
            gameId: game.id as number,
            gameTitle,
            imageUrl: game.image || '',
            time: timestamp
        };
        addItems.push(item);

        added.push({
            id: game.id as number,
            title: gameTitle,
            imageUrl: game.image || '',
            time: addedDate
        });
    }

    // 合并所有动态，按时间排序
    const allActivities = [...playItems, ...addItems].sort((a, b) => b.time - a.time);

    // 排序最近游玩和最近添加
    sessions.sort((a, b) => b.end_time - a.end_time);
    added.sort((a, b) => {
        if (a.time && b.time) return b.time.getTime() - a.time.getTime();
        return 0;
    });

    return {
        sessions: sessions.slice(0, 5),
        added: added.slice(0, 5),
        activities: allActivities.slice(0, 10)
    };
}

export const Home: React.FC = () => {
    const { allGames } = useStore();
    const { getTotalPlayTime, getWeekPlayTime, getTodayPlayTime } = useGamePlayStore();
    const [totalTime, setTotalTime] = useState(0);
    const [weekTime, setWeekTime] = useState(0);
    const [todayTime, setTodayTime] = useState(0);
    const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
    const [recentAdded, setRecentAdded] = useState<RecentGame[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const { t, i18n } = useTranslation();

    // 用 useMemo 缓存 gamesList，避免每次渲染都新建数组
    const gamesList = useMemo(() => allGames.map((game) => ({
        title: getGameDisplayName(game, i18n.language),
        id: game.id,
        isLocal: game.localpath !== '',
        imageUrl: game.image
    })), [allGames, i18n.language]);

    const gamesLocalCount = useMemo(() => gamesList.filter(game => game.isLocal).length, [gamesList]);

    // 计算通关游戏数
    const completedGamesCount = useMemo(() => {
        return allGames.filter(game => game.clear === 1).length;
    }, [allGames]);
    // 用 useCallback 保证函数引用稳定
    const getTotalPlayTimeStable = useCallback(() => getTotalPlayTime(), [getTotalPlayTime]);
    const getWeekPlayTimeStable = useCallback(() => getWeekPlayTime(), [getWeekPlayTime]);
    const getTodayPlayTimeStable = useCallback(() => getTodayPlayTime(), [getTodayPlayTime]);

    const statsCards = useMemo(() => [
        { title: t('home.stats.totalGames', '总游戏数'), value: allGames.length, icon: <GamesIcon /> },
        { title: t('home.stats.localGames', '本地游戏数'), value: gamesLocalCount, icon: <LocalIcon /> },
        { title: t('home.stats.completedGames', '通关游戏数'), value: completedGamesCount, icon: <CompletedIcon /> },
        { title: t('home.stats.totalPlayTime', '总游戏时长'), value: formatPlayTime(totalTime), icon: <TimeIcon /> },
        { title: t('home.stats.weekPlayTime', '本周游戏时长'), value: formatPlayTime(weekTime), icon: <WeekIcon /> },
        { title: t('home.stats.todayPlayTime', '今日游戏时长'), value: formatPlayTime(todayTime), icon: <TodayIcon /> },
    ], [t, allGames.length, gamesLocalCount, completedGamesCount, totalTime, weekTime, todayTime]);

    useEffect(() => {
        (async () => {
            setTotalTime(await getTotalPlayTimeStable());
            setWeekTime(await getWeekPlayTimeStable());
            setTodayTime(await getTodayPlayTimeStable());
            const result = await getGameActivities(allGames, i18n.language);
            setRecentSessions(result.sessions);
            setRecentAdded(result.added);
            setActivities(result.activities);
        })();
    }, [allGames, getTotalPlayTimeStable, getWeekPlayTimeStable, getTodayPlayTimeStable, i18n.language]);

    return (
        <Box className="p-6 flex flex-col gap-4">
            <Typography variant="h4" className="font-bold ">
                {t('home.title', '主页')}
            </Typography>

            {/* 数据统计卡片 */}
            <Box className="grid grid-cols-12 gap-6">
                {statsCards.map((card) => (
                    <Box key={card.title} className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-2">
                        <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
                            <CardContent className="flex flex-col items-center text-center">
                                {card.icon}
                                <Typography variant="h6" className="font-bold mb-1">
                                    {card.value}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {card.title}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                ))}
            </Box>

            {/* 详细信息卡片 */}
            <Box className="grid grid-cols-12 gap-6">
                {/* 游戏仓库 */}
                <Box className="col-span-12 md:col-span-6 lg:col-span-3">
                    <Card className="h-full shadow-md">
                        <CardContent>
                            <Box
                                component={Link}
                                to="/libraries"
                                className="flex items-center mb-3 text-inherit decoration-none hover:scale-105 hover:shadow-lg cursor-pointer">
                                <RepositoryIcon className="mr-2 text-amber-500" />
                                <Typography variant="h6" className="font-bold">
                                    {t('home.repository', '游戏仓库')}
                                </Typography>
                            </Box>
                            <Box className="grid grid-cols-1 gap-2 max-h-44vh overflow-y-auto pr-1">
                                {gamesList.map((category) => (
                                    <Card key={category.id}
                                        variant="outlined"
                                        component={Link}
                                        to={`/libraries/${category.id}`}
                                        sx={{
                                            p: 1,
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            textDecoration: 'none',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                boxShadow: 2
                                            }
                                        }}
                                    >
                                        <Typography variant="body2">{category.title}</Typography>
                                    </Card>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Box>

                {/* 动态 */}
                <Box className="col-span-12 md:col-span-6 lg:col-span-3">
                    <Card className="h-full shadow-md">
                        <CardContent>
                            <Box className="flex items-center mb-3">
                                <ActivityIcon className="mr-2 text-purple-500" />
                                <Typography variant="h6" className="font-bold">
                                    {t('home.activityTitle', '动态')}
                                </Typography>
                            </Box>
                            <List className="max-h-44vh overflow-y-auto pr-1">
                                {activities.map((activity, idx) => (
                                    <React.Fragment key={activity.id}>
                                        <ListItem className="px-0 text-inherit" component={Link} to={`/libraries/${activity.gameId}`}>
                                            <ListItemAvatar>
                                                <Avatar variant="rounded" src={activity.imageUrl} />
                                            </ListItemAvatar>
                                            <Box>
                                                <Typography variant="body1">
                                                    {activity.type === 'add'
                                                        ? t('home.activity.added', { title: activity.gameTitle })
                                                        : t('home.activity.played', { title: activity.gameTitle })}

                                                </Typography>

                                                <Typography variant="body2" color="text.secondary">
                                                    {activity.type === 'add'
                                                        ? t('home.activity.addedAt', { time: formatRelativeTime(activity.time) })
                                                        : t('home.activity.playedAtTime', { time: formatRelativeTime(activity.time) })}
                                                </Typography>

                                                {activity.type === 'play' && activity.duration !== undefined && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('home.activity.duration', { duration: formatPlayTime(activity.duration) })}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </ListItem>
                                        {idx !== activities.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Box>

                {/* 最近游玩 */}
                <Box className="col-span-12 md:col-span-6 lg:col-span-3">
                    <Card className="h-full shadow-md">
                        <CardContent>
                            <Box className="flex items-center mb-3">
                                <RecentlyPlayedIcon className="mr-2 text-blue-500" />
                                <Typography variant="h6" className="font-bold">
                                    {t('home.recentlyPlayed', '最近游玩')}
                                </Typography>
                            </Box>
                            <List className="max-h-44vh overflow-y-auto pr-1">
                                {recentSessions.map((session, idx) => (
                                    <React.Fragment key={session.session_id}>
                                        <ListItem className="px-0 text-inherit" component={Link} to={`/libraries/${session.game_id}`}>
                                            <ListItemAvatar>
                                                <Avatar variant="rounded" src={session.imageUrl} />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={session.gameTitle}
                                                secondary={t('home.lastPlayed', { time: formatRelativeTime(session.end_time) })}
                                            />
                                        </ListItem>
                                        {idx !== recentSessions.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Box>

                {/* 最近添加 */}
                <Box className="col-span-12 md:col-span-6 lg:col-span-3">
                    <Card className="h-full shadow-md">
                        <CardContent>
                            <Box className="flex items-center mb-3">
                                <RecentlyAddedIcon className="mr-2 text-green-500" />
                                <Typography variant="h6" className="font-bold">
                                    {t('home.recentlyAdded', '最近添加')}
                                </Typography>
                            </Box>
                            <List className="max-h-44vh overflow-y-auto pr-1">
                                {recentAdded.map((game, idx) => (
                                    <React.Fragment key={game.id}>
                                        <ListItem className="px-0 text-inherit" component={Link} to={`/libraries/${game.id}`}>
                                            <ListItemAvatar>
                                                <Avatar variant="rounded" src={game.imageUrl} />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={game.title}
                                                secondary={t('home.addedAt', { time: game.time ? formatRelativeTime(game.time) : '' })}
                                            />
                                        </ListItem>
                                        {idx !== recentAdded.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        </Box>
    );
};