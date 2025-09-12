import React, { KeyboardEvent } from 'react';
import { LinkProps, useLocation, useNavigate } from 'react-router-dom';
import { saveScrollPosition } from '@/utils';

export const LinkWithScrollSave: React.FC<LinkProps> = (props) => {
    const { to, onClick, children, ...rest } = props as any;
    const location = useLocation();
    const navigate = useNavigate();

    // 保持原有的滚动保存实现：只在导航前调用一次 saveScrollPosition
    const handleClick = (event: React.MouseEvent<any>) => {
        saveScrollPosition(location.pathname);

        if (props.onClick) {
            props.onClick(event);
        }
    };

    const performNavigation = (target: any) => {
        try {
            if (typeof target === 'string' || typeof target === 'object') {
                navigate(target);
            }
        } catch (err) {
            // swallow navigation errors to avoid breaking UI
            console.error('navigation failed', err);
        }
    };

    const handleDivClick = (event: React.MouseEvent<HTMLDivElement>) => {
        handleClick((event as unknown) as React.MouseEvent<HTMLAnchorElement>);
        performNavigation(to);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            // @ts-ignore - reuse handleClick semantics
            handleClick((event as unknown) as React.MouseEvent<HTMLAnchorElement>);
            performNavigation(to);
        }
    };

    // 渲染为非锚点容器，避免嵌套 <a>。不改动滚动的实现逻辑。
    return (
        <div
            role="link"
            tabIndex={0}
            onClick={handleDivClick}
            onKeyDown={handleKeyDown}
            {...(rest as any)}
        >
            {children}
        </div>
    );
};

export default LinkWithScrollSave;