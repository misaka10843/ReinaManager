import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useScrollStore } from '@/store/scrollStore';

const SCROLL_CONTAINER_SELECTOR = 'main';

// 这个 Hook 负责恢复滚动，但会等待容器内容高度稳定或足够大后再设置 scrollTop，
// 避免在内容还在渲染期间直接设置导致的“弹条/抖动”效果。
export function useScrollRestore(scrollPath: string, isLoading?: boolean) {
    const location = useLocation();
    const { scrollPositions } = useScrollStore();

    useEffect(() => {
        if (window.history.scrollRestoration) {
            window.history.scrollRestoration = 'manual';
        }
    }, []);

    useEffect(() => {
        if (isLoading) return;

        const container = document.querySelector<HTMLElement>(SCROLL_CONTAINER_SELECTOR);
        if (!container) return;

        const target = location.pathname === scrollPath ? (scrollPositions[scrollPath] || 0) : 0;

        // 快速路径：目标为 0，直接滚到顶部（无需等待）
        if (!target) {
            container.scrollTop = 0;
            return;
        }

        let ro: ResizeObserver | null = null;
        let settled = false;
        // 如果内容高度已经足够，可以立即恢复
        const tryRestore = () => {
            // 当容器可滚动区域足够覆盖目标位置时，恢复位置
            if (container.scrollHeight >= target + container.clientHeight) {
                // 禁用潜在的平滑滚动，立即设置位置，避免出现动画
                const prev = container.style.scrollBehavior;
                container.style.scrollBehavior = 'auto';
                // clamp to avoid overflow
                container.scrollTop = Math.min(target, container.scrollHeight - container.clientHeight);
                container.style.scrollBehavior = prev;
                settled = true;
                return true;
            }
            return false;
        };

        // 如果能立即恢复则退出
        if (tryRestore()) return;

        // 否则监听尺寸变化，直到高度足够或超时
        try {
            ro = new ResizeObserver(() => {
                if (settled) return;
                if (tryRestore()) {
                    if (ro) {
                        ro.disconnect();
                        ro = null;
                    }
                }
            });
            ro.observe(container);
        } catch (err) {
            // ResizeObserver 不可用时，回退到定时器方式
        }

        // 最多等待 1500ms，然后无条件设置（防止无限等待）
        const fallback = window.setTimeout(() => {
            if (!settled) {
                const prev = container.style.scrollBehavior;
                container.style.scrollBehavior = 'auto';
                container.scrollTop = Math.min(target, Math.max(0, container.scrollHeight - container.clientHeight, target));
                container.style.scrollBehavior = prev;
                settled = true;
            }
            if (ro) {
                ro.disconnect();
                ro = null;
            }
        }, 1500);

        return () => {
            if (ro) ro.disconnect();
            window.clearTimeout(fallback);
        };

    }, [location.pathname, scrollPath, isLoading]);
}