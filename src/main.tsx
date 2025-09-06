/**
 * @file main.tsx
 * @description 应用入口文件，初始化全局状态，设置全局事件监听，挂载根组件。
 * @author ReinaManager
 * @copyright AGPL-3.0
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { routers } from '@/routes'
import './index.css'
import 'virtual:uno.css'
import { initializeStores } from './store';
import { initTray } from '@/components/Tray'
import WindowsHandler from '@/components/Window'
import { isTauri } from '@tauri-apps/api/core'
import { initResourceDirPath } from '@/utils'

// 禁止拖拽、右键菜单和部分快捷键，提升桌面体验
document.addEventListener("drop", (e) => e.preventDefault());
document.addEventListener("dragover", (e) => e.preventDefault(),);
document.addEventListener('contextmenu', (e) => e.preventDefault())
document.addEventListener('keydown', (e) => {
  if (['F3', 'F5', 'F7'].includes(e.key.toUpperCase())) {
    e.preventDefault()
  }

  if (e.ctrlKey && ['r', 'u', 'p', 'l', 'j', 'g', 'f', 's', 'a'].includes(e.key.toLowerCase())) {
    e.preventDefault()
  }
})

// 初始化全局状态后，挂载 React 应用
initializeStores().then(async () => {
  await initTray()

  // 初始化资源目录路径缓存
  if (isTauri()) {
    await initResourceDirPath()
  }

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      {isTauri() && <WindowsHandler />}
      <RouterProvider router={routers} />
    </StrictMode>
  )
})
