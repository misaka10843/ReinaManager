import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Grid,
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
import { formatRelativeTime, formatPlayTime } from '@/utils';
import type { GameData } from '@/types';
import { useTranslation } from 'react-i18next';

interface RecentSession {
    session_id: number;
    game_id: number;
    end_time: number;
    gameTitle: string;
    imageUrl: string;
}
interface RecentGame {
    id: number;
    title: string;
    imageUrl: string;
    time: Date;
}
interface ActivityItem {
    id: string;
    type: 'add' | 'play';
    gameId: number;
    gameTitle: string;
    imageUrl: string;
    time: number;
    duration?: number; // 仅游玩记录有
}

// 获取最近游玩数据
async function getGameActivities(games: GameData[]): Promise<{
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
                const item: ActivityItem = {
                    id: `play-${s.session_id || game.id}-${s.end_time}`,
                    type: 'play',
                    gameId: game.id as number,
                    gameTitle: game.name_cn || game.name,
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
                    gameTitle: game.name_cn || game.name,
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

        const item: ActivityItem = {
            id: `add-${game.id}`,
            type: 'add',
            gameId: game.id as number,
            gameTitle: game.name_cn || game.name,
            imageUrl: game.image || '',
            time: timestamp
        };
        addItems.push(item);

        added.push({
            id: game.id as number,
            title: game.name_cn || game.name,
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
        sessions: sessions.slice(0, 4),
        added: added.slice(0, 4),
        activities: allActivities.slice(0, 10)
    };
}

export const Home: React.FC = () => {
    const { games } = useStore();
    const { getTotalPlayTime, getWeekPlayTime, getTodayPlayTime } = useGamePlayStore();
    const [totalTime, setTotalTime] = useState(0);
    const [weekTime, setWeekTime] = useState(0);
    const [todayTime, setTodayTime] = useState(0);
    const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
    const [recentAdded, setRecentAdded] = useState<RecentGame[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const { t } = useTranslation();

    const gamesList = games.map((game) => {
        return {
            title: game.name_cn === "" ? game.name : game.name_cn,
            id: game.id,
            isLocal: game.localpath !== '',
            imageUrl: game.image
        }
    });

    const gamesLocalCount = gamesList.filter(game => {
        return game.isLocal
    }).length; // 获取游戏数量

    const statsCards = [
        { title: t('home.stats.totalGames', '总游戏数'), value: games.length, icon: <GamesIcon /> },
        { title: t('home.stats.localGames', '本地游戏数'), value: gamesLocalCount, icon: <LocalIcon /> },
        { title: t('home.stats.completedGames', '通关游戏数'), value: '0', icon: <CompletedIcon /> },
        { title: t('home.stats.totalPlayTime', '总游戏时长'), value: formatPlayTime(totalTime), icon: <TimeIcon /> },
        { title: t('home.stats.weekPlayTime', '本周游戏时长'), value: formatPlayTime(weekTime), icon: <WeekIcon /> },
        { title: t('home.stats.todayPlayTime', '今日游戏时长'), value: formatPlayTime(todayTime), icon: <TodayIcon /> },
    ];

    useEffect(() => {
        (async () => {
            setTotalTime(await getTotalPlayTime());
            setWeekTime(await getWeekPlayTime());
            setTodayTime(await getTodayPlayTime());

            const result = await getGameActivities(games);
            setRecentSessions(result.sessions);
            setRecentAdded(result.added);
            setActivities(result.activities);
        })();
    }, [games, getTotalPlayTime, getWeekPlayTime, getTodayPlayTime]);

    return (
        <Box className="p-6 flex flex-col gap-4">
            <Typography variant="h4" className="font-bold ">
                {t('home.title', '主页')}
            </Typography>

            {/* 数据统计卡片 */}
            <Grid container spacing={3}>
                {statsCards.map((card) => (
                    <Grid item xs={12} sm={6} md={4} lg={2} key={card.title}>
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
                    </Grid>
                ))}
            </Grid>

            {/* 详细信息卡片 */}
            <Grid container spacing={3}>
                {/* 游戏仓库 */}
                <Grid item xs={12} md={6} lg={3}>
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
                </Grid>

                {/* 动态 */}
                <Grid item xs={12} md={6} lg={3}>
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
                </Grid>

                {/* 最近游玩 */}
                <Grid item xs={12} md={6} lg={3}>
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
                </Grid>

                {/* 最近添加 */}
                <Grid item xs={12} md={6} lg={3}>
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
                </Grid>
            </Grid>
        </Box>
    );
};