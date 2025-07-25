import { TrayIcon } from '@tauri-apps/api/tray';
import type { TrayIconEvent } from '@tauri-apps/api/tray';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { Menu, MenuItem } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { toggleAutostart } from '@/components/AutoStart'; 


/**
 * 创建并初始化托盘图标
 */
export const initTray = async () => {
    try {
        // 创建退出菜单项
        const quitItem = await MenuItem.new({
            id: 'quit',
            text: 'Quit',
            action: async () => {
                console.log('Exiting application...');
                const window = getCurrentWindow();
                await window.close();
            }
        });

        const autostartItem = await MenuItem.new({
            id: 'autostart',
            text: 'Autostart',
            action: async () => {
                await toggleAutostart();
            }
        });

        // 创建菜单
        const menu = await Menu.new({
            items: [autostartItem,quitItem]
        });

        // 获取默认窗口图标
        const windowIcon = await defaultWindowIcon();

        // 创建托盘图标
        const tray = await TrayIcon.new({
            id: 'main',
            icon: windowIcon ?? undefined,
            tooltip: 'ReinaManager v0.5.5', // 显示软件名和版本号
            menu,
            showMenuOnLeftClick: false, // 左键不显示菜单

            action: async (event: TrayIconEvent) => {
                // 处理托盘图标点击事件
                if (event.type === 'Click' && event.button === 'Left' && event.buttonState === 'Up') {
                    const window = getCurrentWindow();
                    try {
                        await window.show();
                        await window.unminimize();
                        await window.setFocus();

                    } catch (error) {
                        console.error('Failed to toggle window visibility:', error);
                    }
                }
            }
        });

        return tray;
    } catch (error) {
        console.error('Failed to initialize tray icon:', error);
        return null;
    }
};