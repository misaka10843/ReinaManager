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
import { openurl, openDatabaseBackupFolder } from '@/utils';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@toolpad/core';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { isEnabled } from '@tauri-apps/plugin-autostart';
import { toggleAutostart } from '@/components/AutoStart';
import { Switch, FormControlLabel, RadioGroup, Radio, Checkbox, CircularProgress, Alert } from '@mui/material';
import { backupDatabase } from '@/utils/database';
import BackupIcon from '@mui/icons-material/Backup';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { isTauri } from '@tauri-apps/api/core';


/**
 * LanguageSelect 组件
 * 语言选择下拉框，支持中、英、日多语言切换。
 *
 * @component
 * @returns {JSX.Element} 语言选择器
 */
const LanguageSelect = () => {
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
        <Box className="min-w-30 mb-6">
            <InputLabel
                id="language-select-label"
                className="mb-2 font-semibold"
            >
                {t('pages.Settings.language')}
            </InputLabel>
            <Select
                labelId="language-select-label"
                id="language-select"
                value={language}
                onChange={handleChange}
                className="w-60"
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

const AutoStartSettings = () => {
    const { t } = useTranslation();
    const [autoStart, setAutoStart] = useState(false);

    useEffect(() => {
        const checkAutoStart = async () => {
            setAutoStart(await isEnabled());
        };
        checkAutoStart();
    }, []);

    return (
        <Box className="mb-6">
            <Stack direction="row" alignItems="center" className="min-w-60">
                <Box>
                    <InputLabel className="font-semibold mb-1">
                        {t('pages.Settings.autoStart')}
                    </InputLabel>
                </Box>
                <Switch
                    checked={autoStart}
                    onChange={() => {
                        setAutoStart(!autoStart);
                        toggleAutostart();
                    }}
                    color="primary"
                />
            </Stack>
        </Box>
    );
}

const CloseBtnSettings = () => {
    const { t } = useTranslation();
    const { skipCloseRemind, defaultCloseAction, setSkipCloseRemind, setDefaultCloseAction } = useStore();
    return (
        <Box className="mb-6">
            <InputLabel className="font-semibold mb-4">
                {t('pages.Settings.closeSettings')}
            </InputLabel>
            <Box className="pl-2">
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={skipCloseRemind}
                            onChange={e => setSkipCloseRemind(e.target.checked)}
                            color="primary"
                        />
                    }
                    label={t('pages.Settings.skipCloseRemind')}
                    className="mb-2"
                />
                <RadioGroup
                    value={defaultCloseAction}
                    onChange={e => setDefaultCloseAction(e.target.value as 'hide' | 'close')}
                    className="pl-4"
                >
                    <FormControlLabel
                        value="hide"
                        control={<Radio color="primary" />}
                        label={t('pages.Settings.closeToTray')}
                        disabled={!skipCloseRemind}
                        className={!skipCloseRemind ? "opacity-50 transition-opacity duration-200" : ""}
                    />
                    <FormControlLabel
                        value="close"
                        control={<Radio color="primary" />}
                        label={t('pages.Settings.closeApp')}
                        disabled={!skipCloseRemind}
                        className={!skipCloseRemind ? "opacity-50 transition-opacity duration-200" : ""}
                    />
                </RadioGroup>
            </Box>
        </Box>
    );
}

const DatabaseBackupSettings = () => {
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleBackupDatabase = async () => {
        setIsBackingUp(true);
        setBackupStatus(null);

        try {
            const backupPath = await backupDatabase();
            setBackupStatus({
                type: 'success',
                message: `数据库备份成功: ${backupPath}`
            });

            // 3秒后清除状态消息
            setTimeout(() => setBackupStatus(null), 3000);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '备份失败';
            setBackupStatus({
                type: 'error',
                message: `数据库备份失败: ${errorMessage}`
            });
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleOpenBackupFolder = async () => {
        try {
            await openDatabaseBackupFolder();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '打开文件夹失败';
            setBackupStatus({
                type: 'error',
                message: `打开备份文件夹失败: ${errorMessage}`
            });
        }
    };

    return (
        <Box className="mb-6">
            <InputLabel className="font-semibold mb-4">
                数据库备份
            </InputLabel>

            {/* 状态提示 */}
            {backupStatus && (
                <Alert
                    severity={backupStatus.type}
                    className="mb-4"
                    onClose={() => setBackupStatus(null)}
                >
                    {backupStatus.message}
                </Alert>
            )}

            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleBackupDatabase}
                    disabled={isBackingUp || !isTauri()}
                    startIcon={isBackingUp ? <CircularProgress size={16} color="inherit" /> : <BackupIcon />}
                    className="px-6 py-2"
                >
                    {isBackingUp ? '备份中...' : '备份数据库'}
                </Button>

                <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleOpenBackupFolder}
                    startIcon={<FolderOpenIcon />}
                    className="px-6 py-2"
                    disabled={!isTauri()}
                >
                    打开备份文件夹
                </Button>
            </Stack>
        </Box>
    );
}


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
        <PageContainer className="max-w-full">
            <Box className="py-4">
                {/* BGM Token 设置 */}
                <Box className="mb-8">
                    <InputLabel className="font-semibold mb-4">
                        {t('pages.Settings.bgmToken')}
                    </InputLabel>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <TextField
                            type="password"
                            placeholder={t('pages.Settings.tokenPlaceholder')}
                            value={inputToken}
                            onChange={(e) => setInputToken(e.target.value)}
                            variant="outlined"
                            size="medium"
                            className="min-w-60"
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => setBgmToken(inputToken)}
                            className="px-6 py-2"
                        >
                            {t('pages.Settings.saveBtn')}
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={handleOpen}
                            className="px-6 py-2"
                        >
                            {t('pages.Settings.getToken')}
                        </Button>
                    </Stack>
                </Box>

                {/* 语言设置 */}
                <LanguageSelect />

                {/* 自启动设置 */}
                <AutoStartSettings />

                {/* 关闭按钮设置 */}
                <CloseBtnSettings />

                {/* 数据库备份设置 */}
                <DatabaseBackupSettings />
            </Box>
        </PageContainer>
    );
};

