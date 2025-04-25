/**
 * @file 路由配置
 * @description 定义应用的主路由结构，支持菜单分组、嵌套路由、动态路由与 index 路由，适配 Tauri 环境。
 * @module src/routes/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - routes：菜单分组与页面配置
 * - routers：react-router 路由对象
 *
 * 依赖：
 * - @mui/icons-material
 * - @/pages/Home
 * - @/pages/Settings
 * - @/components/Cards
 * - @/pages/Libraries
 * - @/pages/Detail
 * - @/pages/Edit
 * - @/components/Layout
 * - @/App
 * - react-router
 * - @tauri-apps/api/core
 */

import HomeIcon from '@mui/icons-material/Home';
import GamesIcon from '@mui/icons-material/Games';
import SettingsIcon from '@mui/icons-material/Settings';
import { Home } from '@/pages/Home/';
import { Settings } from '@/pages/Settings';
import Card from '@/components/Cards';
import { Libraries } from '@/pages/Libraries';
import { Detail } from '@/pages/Detail';
import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router';
import React from 'react';
import Layout from '@/components/Layout';
import App from '@/App';
import { Edit } from '@/pages/Edit';
import { isTauri } from '@tauri-apps/api/core';

/**
 * 路由配置项类型
 */
export interface RouteConfig {
    title: string;
    path?: string;
    component?: React.ComponentType;
    icon?: React.ReactNode;
    index?: boolean;
    children?: RouteConfig[];
}

/**
 * 路由分组类型
 */
export interface RouteGroup {
    groupTitle: string;
    items: RouteConfig[];
}

// 统一的路由配置，包含菜单分组与页面结构
export const routes: RouteGroup[] = [
    {
        groupTitle: 'menu',
        items: [
            {
                title: 'home',
                path: '',
                component: Home,
                icon: <HomeIcon />,
            },
            {
                title: 'game library ',
                path: 'libraries',
                component: Libraries,
                icon: <GamesIcon />,
                children: [
                    // 默认子路由使用 index
                    { title: 'default', index: true, component: Card },
                    { title: 'detail', path: ':id', component: Detail },
                ]
            },
            {
                title: 'edit',
                path: 'edit',
                children: [
                    { title: 'edit', path: ':id', component: Edit },
                ]
            },
            {
                title: 'settings',
                path: 'settings',
                component: Settings,
                icon: <SettingsIcon />,
            },
        ],
    },
];

/**
 * 根据路由配置生成 react-router 路由定义，支持 index 路由
 * @param {RouteGroup[]} routes 路由分组配置
 * @returns {RouteObject[]} 路由对象数组
 */
const generateRoutes = (routes: RouteGroup[]): RouteObject[] => {
    return routes.flatMap(group =>
        group.items.map(route => ({
            path: route.path,
            element: route.component ? React.createElement(route.component) : undefined,
            children: route.children
                ? route.children.map(child => ({
                    // 如果为 index 路由，不传 path
                    index: child.index || false,
                    path: child.index ? undefined : child.path,
                    element: child.component ? React.createElement(child.component) : undefined,
                }))
                : undefined,
        }))
    );
};

// 顶层路由配置，包含 App、Layout 及所有页面
const routeConfig = [
    {
        Component: App,
        children: [
            {
                path: '/',
                Component: Layout,
                children: generateRoutes(routes),
            },
        ],
    },
];

/**
 * routers 路由对象
 * 根据是否为 Tauri 环境选择 BrowserRouter 或 HashRouter
 */
export const routers = (isTauri() ? createBrowserRouter : createHashRouter)(routeConfig);
