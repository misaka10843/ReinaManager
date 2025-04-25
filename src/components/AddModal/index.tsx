/**
 * @file AddModal 组件
 * @description 用于添加新游戏条目的弹窗组件，支持通过 Bangumi/VNDB API 自动获取信息或自定义添加本地游戏，包含错误提示、加载状态、国际化等功能。
 * @module src/components/AddModal/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - AddModal：添加游戏的弹窗组件
 *
 * 依赖：
 * - @mui/material
 * - @tauri-apps/plugin-dialog
 * - @tauri-apps/api/core
 * - @/api/bgm
 * - @/api/vndb
 * - @/store
 * - @/utils
 * - react-i18next
 */

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import AddIcon from '@mui/icons-material/Add';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import { useModal } from '@/components/Toolbar';
import { useEffect, useState } from 'react';
import { fetchFromBgm } from '@/api/bgm';
import { fetchFromVNDB } from '@/api/vndb';
import Alert from '@mui/material/Alert';
import { useStore } from '@/store/';
import { open } from '@tauri-apps/plugin-dialog';
import CircularProgress from '@mui/material/CircularProgress';
import { isTauri } from '@tauri-apps/api/core';
import Switch from '@mui/material/Switch';
import { time_now } from '@/utils';
import { useTranslation } from 'react-i18next';
import { getGamePlatformId } from '@/utils';

/**
 * AddModal 组件用于添加新游戏条目。
 *
 * 主要功能：
 * - 支持通过 Bangumi 或 VNDB API 自动获取游戏信息。
 * - 支持自定义模式，允许用户手动选择本地可执行文件并填写名称。
 * - 支持错误提示、加载状态、国际化等功能。
 *
 * @component
 * @returns {JSX.Element} 添加游戏的弹窗组件
 */
const AddModal: React.FC = () => {
    const { t } = useTranslation();
    const { bgmToken, addGame, games } = useStore();
    const { isopen, handleOpen, handleClose } = useModal();
    const [formText, setFormText] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [path, setPath] = useState('');
    const [customMode, setCustomMode] = useState(false);
    const [isVNDB, setIsVNDB] = useState(false);

    /**
     * 当路径变化时，自动提取文件夹名作为游戏名。
     */
    useEffect(() => {
        if (path) {
            const folderName = extractFolderName(path);
            setFormText(folderName);
        }
    }, [path]);

    /**
     * 提交表单，处理添加游戏的逻辑。
     * - 自定义模式下直接添加本地游戏。
     * - 其他模式下通过 API 获取游戏信息并添加。
     */
    const handleSubmit = async () => {
        if (loading) return;
        if (customMode && !path) {
            setError(t('components.AddModal.noExecutableSelected'));
            setTimeout(() => {
                setError('');
            }, 5000);
            return;
        }
        if (customMode) {
            await addGame({ id_type: 'custom', localpath: path, name: formText, name_cn: '', image: "/images/default.png", time: time_now() });
            setFormText('');
            setPath('');
            handleClose();
            return;
        }
        try {
            setLoading(true);

            // 根据 isVNDB 状态选择数据源
            const res = isVNDB ? (await fetchFromVNDB(formText)) : (await fetchFromBgm(formText, bgmToken));

            // 错误处理
            if (typeof res === 'string') {
                setError(res);
                setTimeout(() => {
                    setError('');
                }, 5000);
                return null;
            }
            // 检查是否已存在相同游戏
            if (games.find((game) => getGamePlatformId(game) === getGamePlatformId(res) || (game.name === res.name || game.date === res.date))) {
                setError(t('components.AddModal.gameExists'));
                setTimeout(() => {
                    setError('');
                }, 5000);
                return null;
            }
            // 添加新游戏
            const gameWithPath = { ...res, localpath: path };
            await addGame(gameWithPath);
            setFormText('');
            setPath('');
            handleClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    /**
     * 打开文件选择对话框，选择本地可执行文件路径。
     * @returns {Promise<string | null>} 选择的文件路径或 null
     */
    const handleDirectory = async () => {
        const path = await open({
            multiple: false,
            directory: false,
            filters: [{
                name: t('components.AddModal.executable'),
                extensions: ["exe"]
            }]
        });
        if (path === null) return null;
        return path
    }

    /**
     * 从文件路径中提取文件夹名称。
     * @param path 文件路径
     * @returns 文件夹名称
     */
    const extractFolderName = (path: string): string => {
        const parts = path.split('\\');
        return parts.length > 1 ? parts[parts.length - 2] : '';
    };

    return (
        <>
            {/* 添加游戏按钮，点击后弹窗打开 */}
            <Button onClick={handleOpen} startIcon={<AddIcon />}>{t('components.AddModal.addGame')}</Button>
            <Dialog
                open={isopen}
                onClose={(_, reason) => {
                    // 加载时防止关闭弹窗
                    if (reason !== 'backdropClick' && !loading) {
                        handleClose();
                    }
                }}
                closeAfterTransition={false}
                aria-labelledby="addgame-dialog-title"
            >
                {/* 错误提示 */}
                {error && <Alert severity="error">{error}</Alert>}
                <DialogTitle>{t('components.AddModal.addGame')}</DialogTitle>
                <DialogContent>
                    {/* 选择本地可执行文件 */}
                    <Button className='w-md' variant='contained' onClick={async () => {
                        const result = await handleDirectory();
                        if (result)
                            setPath(result);
                    }} startIcon={<FileOpenIcon />} disabled={!isTauri()} >{t('components.AddModal.selectLauncher')}</Button>
                    <p>
                        <input className='w-md' type="text" value={path}
                            placeholder={t('components.AddModal.selectExecutable')} readOnly />
                    </p>
                    {/* 自定义模式和 VNDB 切换 */}
                    <div>
                        <Switch checked={customMode} onChange={() => {
                            setCustomMode(!customMode)
                        }} />
                        <span>{t('components.AddModal.enableCustomMode')}</span>
                        <div>
                            <Switch checked={isVNDB} onChange={() => {
                                setIsVNDB(!isVNDB)
                            }} />
                            <span>{t('components.AddModal.enableVNDB')}</span>
                        </div>
                    </div>
                    {/* 游戏名称输入框 */}
                    <TextField
                        required
                        margin="dense"
                        id="name"
                        name="game-name"
                        label={t('components.AddModal.gameName')}
                        type="text"
                        fullWidth
                        variant="standard"
                        autoComplete="off"
                        value={formText}
                        onChange={(event) => setFormText(event.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    {/* 取消按钮 */}
                    <Button variant="outlined" onClick={() => {
                        setFormText('');
                        setPath('');
                        handleClose();
                    }} disabled={loading} >{t('components.AddModal.cancel')}</Button>
                    {/* 确认按钮 */}
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={formText === '' || loading}
                        startIcon={loading ? <CircularProgress size={20} /> : null}
                    >
                        {loading ? t('components.AddModal.processing') : t('components.AddModal.confirm')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default AddModal;
