import HomeIcon from '@mui/icons-material/Home';
import GamesIcon from '@mui/icons-material/Games';
import SettingsIcon from '@mui/icons-material/Settings';
import { Home } from '@/pages/Home/';
import { Settings } from '@/pages/Settings';
import { Libraries } from '@/pages/Libraries';
import { Detail } from '@/pages/Detail';
import { Category } from '@/pages/Category';
import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router-dom';
import Layout from '@/components/Layout';
import App from '@/App';
import { isTauri } from '@tauri-apps/api/core';
import React from 'react';

export interface AppRoute {
    // 路由路径
    path: string;
    // 页面组件
    component: React.ComponentType;
    // 页面标题 (用于导航菜单, 建议使用 i18n key)
    title: string;
    // 导航菜单图标
    icon?: React.ReactNode;
    // 是否在导航菜单中隐藏
    hideInMenu?: boolean;
    // 子路由
    children?: AppRoute[];
    // 是否为索引路由 (index route)
    index?: boolean;
    // 用于导航匹配的特殊 pattern (对应 @toolpad/core 的 pattern 属性)
    navPattern?: string;
}

// 统一的路由配置数组
export const appRoutes: AppRoute[] = [
    {
        path: '',
        title: 'app.NAVIGATION.home', // 使用 i18n key
        component: Home,
        icon: <HomeIcon />,
    },
    {
        path: 'libraries',
        title: 'app.NAVIGATION.gameLibrary',
        icon: <GamesIcon />,
        navPattern: 'libraries/:id',
        component: Libraries,
    },
    {
        path: 'libraries/:id',
        title: 'Game Detail',
        component: Detail,
        hideInMenu: true, // 详情页，不在侧边栏显示
    },
    {
        path: 'category',
        title: 'app.NAVIGATION.category',
        component: Category,
    },
    {
        path: 'settings',
        title: 'app.NAVIGATION.settings',
        component: Settings,
        icon: <SettingsIcon />,
    },
];

const buildRouterObjects = (routes: AppRoute[]): RouteObject[] => {
    return routes.map((route) => {
        // 如果是索引路由 (Index Route)
        if (route.index) {
            return {
                index: true,
                element: React.createElement(route.component),
                // 索引路由不能有 path 或 children
            };
        }

        // 否则，是非索引路由 (Path Route)
        return {
            path: route.path,
            element: React.createElement(route.component),
            children: route.children ? buildRouterObjects(route.children) : undefined,
            // 非索引路由的 index 属性不能为 true
        };
    });
};

// 顶层路由配置
const routeConfig: RouteObject[] = [
    {
        Component: App,
        children: [
            {
                path: '/',
                Component: Layout,
                children: buildRouterObjects(appRoutes), // 直接使用转换后的配置
            },
        ],
    },
];

/**
 * routers 路由对象
 * 根据是否为 Tauri 环境选择 BrowserRouter 或 HashRouter
 */
export const routers = (isTauri() ? createBrowserRouter : createHashRouter)(routeConfig);