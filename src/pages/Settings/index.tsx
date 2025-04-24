import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { openurl } from '@/utils';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@toolpad/core';

export const Settings: React.FC = () => {
    const { t } = useTranslation();
    const { bgmToken, setBgmToken } = useStore();
    const [inputToken, setInputToken] = useState('');

    useEffect(() => {
        setInputToken(bgmToken);
    }, [bgmToken]);

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