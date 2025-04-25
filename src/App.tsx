/**
 * @file App 入口组件
 * @description 应用主入口，配置全局导航菜单，集成国际化与路由，作为所有页面的顶层容器。
 * @module src/App
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 依赖：
 * - @toolpad/core
 * - @mui/icons-material
 * - react-router
 * - react-i18next
 * - @/store
 * - @/utils/i18n
 * - ./App.css
 */

import './App.css'
import '@/utils/i18n';
import { Outlet } from "react-router";
import type { Navigation } from '@toolpad/core';
import { ReactRouterAppProvider } from '@toolpad/core/react-router'
import HomeIcon from '@mui/icons-material/Home';
import GamesIcon from '@mui/icons-material/Games';
import SettingsIcon from '@mui/icons-material/Settings';
import { useStore } from './store';
import { useTranslation } from 'react-i18next';

/**
 * App 组件
 * 应用主入口，配置全局导航菜单，集成国际化与路由。
 *
 * @component
 * @returns {JSX.Element} 应用主容器
 */
const App: React.FC = () => {
  const { t } = useTranslation();
  const { games } = useStore();
  // 动态生成游戏库子菜单
  const lists = games.map((game) => {
    return {
      title: game.name_cn === "" ? game.name : game.name_cn,
      segment: String(game.id)
    }
  })
  // 全局导航配置
  const NAVIGATION: Navigation = [
    {
      kind: 'header',
      title: t('app.NAVIGATION.menu'),
    },
    {
      title: t('app.NAVIGATION.home'),
      icon: <HomeIcon />,
    },
    {
      segment: 'libraries',
      title: t('app.NAVIGATION.gameLibrary'),
      icon: <GamesIcon />,
      children: [
        ...lists,
      ]
    },
    {
      segment: 'settings',
      title: t('app.NAVIGATION.settings'),
      icon: <SettingsIcon />,
    }
  ];

  return (
    <ReactRouterAppProvider navigation={NAVIGATION}>
      <Outlet />
    </ReactRouterAppProvider>
  )
}

export default App
