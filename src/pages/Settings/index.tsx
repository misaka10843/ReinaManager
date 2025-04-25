/**
 * @file Settings 页面
 * @description 应用设置页，支持 Bangumi Token 设置、语言切换等功能。
 * @module src/pages/Settings/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - Settings：设置页面主组件
 * - LanguageSelect：语言选择组件
 *
 * 依赖：
 * - @mui/material
 * - @toolpad/core
 * - @/store
 * - @/utils
 * - react-i18next
 */

import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { openurl } from '@/utils';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@toolpad/core';

/**
 * Settings 组件
 * 应用设置页面，支持 Bangumi Token 设置与保存、获取 Token 链接、语言切换等功能。
 *
 * @component
 * @returns {JSX.Element} 设置页面
 */
export const Settings: React.FC = () => {
    const { t } = useTranslation();
    const { bgmToken, setBgmToken } = useStore();
    const [inputToken, setInputToken] = useState('');

    useEffect(() => {
        setInputToken(bgmToken);
    }, [bgmToken]);

    /**
     * 打开 Bangumi Token 获取页面
     */
    const handleOpen = () => {
        openurl("https://next.bgm.tv/demo/access-token/create");
    }
    return (
        <PageContainer sx={{ maxWidth: '100% !important' }}>
            <div className=" space-y-4">
                <div className="space-y-2">
                    <span>{t('pages.Settings.bgmToken')}</span>
                    <input
                        type="password"
                        placeholder={t('pages.Settings.tokenPlaceholder')}
                        value={inputToken}
                        onChange={(e) => setInputToken(e.target.value)}
                    />
                    <button type="button" onClick={() => setBgmToken(inputToken)}>
                        {t('pages.Settings.saveBtn')}
                    </button>
                    <span className="text-blue-400 hover:cursor-pointer" onClick={handleOpen}>
                        {t('pages.Settings.getToken')}
                    </span>
                </div>
                <LanguageSelect />
                <div>
                </div>
            </div>
        </PageContainer>
    );
};

/**
 * LanguageSelect 组件
 * 语言选择下拉框，支持中、英、日多语言切换。
 *
 * @component
 * @returns {JSX.Element} 语言选择器
 */
export const LanguageSelect = () => {
    const { t, i18n } = useTranslation(); // 使用i18n实例和翻译函数
    const [language, setLanguage] = useState(i18n.language); // 使用当前语言初始化状态

    // 语言名称映射
    const languageNames = {
        "zh-CN": "简体中文(zh-CN)",
        "zh-TW": "繁体中文(zh-TW)",
        "en-US": "English(en-US)",
        "ja-JP": "日本語(ja-JP)",
    };

    // 当i18n.language变化时更新state
    useEffect(() => {
        setLanguage(i18n.language);
    }, [i18n.language]);

    /**
     * 处理语言切换
     * @param {SelectChangeEvent} event
     */
    const handleChange = (event: SelectChangeEvent) => {
        const newLang = event.target.value;
        setLanguage(newLang);
        i18n.changeLanguage(newLang); // 切换语言
    };

    return (
        <Box sx={{ minWidth: 120 }}>
            <InputLabel id="language-select-label">{t('pages.Settings.language')}</InputLabel>
            <Select
                labelId="language-select-label"
                id="language-select"
                value={language}
                label={t('pages.Settings.language')}
                onChange={handleChange}
                sx={{ width: 180 }} // 设置合适的固定宽度
                renderValue={(value) => languageNames[value as keyof typeof languageNames]}
            >
                <MenuItem value="zh-CN">简体中文(zh-CN)</MenuItem>
                <MenuItem value="zh-TW">繁体中文(zh-TW)</MenuItem>
                <MenuItem value="en-US">English(en-US)</MenuItem>
                <MenuItem value="ja-JP">日本語(ja-JP)</MenuItem>
            </Select>
        </Box>
    );
}