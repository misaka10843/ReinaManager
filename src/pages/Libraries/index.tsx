/**
 * @file Libraries 页面
 * @description 游戏库主页面，作为路由出口容器，承载子路由内容。
 * @module src/pages/Libraries/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - Libraries：游戏库页面主组件
 *
 * 依赖：
 * - react-router
 */

import { Outlet } from "react-router";

/**
 * Libraries 组件
 * 游戏库主页面，作为子路由的容器。
 *
 * @component
 * @returns {JSX.Element} 路由出口容器
 */
export const Libraries = () => {
    return (
        <Outlet />
    )
}