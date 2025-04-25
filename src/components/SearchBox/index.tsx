/**
 * @file SearchBox 组件
 * @description 游戏库顶部搜索框组件，支持输入关键字实时搜索，集成防抖、清空、国际化等功能。
 * @module src/components/SearchBox/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - SearchBox：游戏搜索输入框组件
 *
 * 依赖：
 * - @mui/material
 * - @mui/icons-material
 * - @/store
 * - react-i18next
 */

import { useState, useEffect, useCallback } from 'react';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ClearIcon from '@mui/icons-material/Clear';
import { useStore } from '@/store';
import { useTranslation } from 'react-i18next';

/**
 * 防抖 Hook，用于延迟返回输入值，减少频繁触发搜索。
 * @template T
 * @param {T} value 输入值
 * @param {number} delay 延迟时间（毫秒）
 * @returns {T} 防抖后的值
 */
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * SearchBox 组件
 * 用于输入关键字实时搜索游戏，支持防抖、清空、国际化。
 *
 * @component
 * @returns {JSX.Element} 搜索输入框
 */
export const SearchBox = () => {
    const { t } = useTranslation();
    const { searchKeyword, searchGames } = useStore();
    const [keyword, setKeyword] = useState(searchKeyword);

    // 对输入值应用防抖
    const debouncedKeyword = useDebounce(keyword, 300);

    /**
     * 执行搜索
     * @param {string} term 搜索关键字
     */
    const performSearch = useCallback((term: string) => {
        searchGames(term);
    }, [searchGames]);

    // 同步全局状态
    useEffect(() => {
        setKeyword(searchKeyword);
    }, [searchKeyword]);

    // 当防抖后的关键字变化时，执行搜索
    useEffect(() => {
        performSearch(debouncedKeyword);
    }, [debouncedKeyword, performSearch]);

    /**
     * 处理输入变化
     * @param {React.ChangeEvent<HTMLInputElement>} e 输入事件
     */
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setKeyword(e.target.value);
        // 搜索会通过上面的 useEffect 自动触发
    };

    /**
     * 清除搜索内容
     */
    const handleClear = () => {
        setKeyword('');
        // 清除后立即搜索，不用等待防抖
        performSearch('');
    };

    return (
        <>
            <TextField
                label={t('components.SearchBox.search')}
                variant="outlined"
                size="small"
                value={keyword}
                onChange={handleInputChange}
                aria-label={t('components.SearchBox.searchGame')}
                placeholder={t('components.SearchBox.inputGameName')}
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment position="end">
                                {keyword && (
                                    <IconButton
                                        onClick={handleClear}
                                        edge="end"
                                        size="small"
                                        aria-label={t('components.SearchBox.clearSearch')}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </InputAdornment>
                        ),
                    },
                }}
            />
        </>
    );
}