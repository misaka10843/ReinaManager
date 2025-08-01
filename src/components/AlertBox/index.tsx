/**
 * @file AlertBox 组件
 * @description 通用弹窗提示组件，支持普通确认/取消弹窗和带加载状态的删除确认弹窗，适用于全局提示、删除确认等场景，支持国际化。
 * @module src/components/AlertBox/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - AlertBox：通用提示框组件
 * - AlertDeleteBox：带加载状态的删除确认弹窗
 *
 * 依赖：
 * - @mui/material
 * - react-i18next
 */

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { GameData } from '@/types';

/**
 * 通用提示框属性类型
 */
interface AlertBoxProps {
    open: boolean;
    setOpen: (value: boolean) => void;
    title?: string;
    message?: ReactNode; // 修改类型以支持 JSX 元素
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'primary' | 'error' | 'success' | 'info' | 'warning';
    confirmVariant?: 'text' | 'outlined' | 'contained';
    autoCloseOnConfirm?: boolean;  // 确认后是否自动关闭
    isLoading?: boolean; // 新增属性：加载状态
    customMessage?: string; // 新增属性：自定义消息
}

/**
 * 删除提示框专用属性类型
 */
interface AlertDeleteBoxProps {
    open: boolean;
    setOpen: (value: boolean) => void;
    onConfirm: () => void;
    isLoading?: boolean;  // 添加加载状态
    message?: string; // 自定义删除消息
    title?: string; // 自定义删除标题
}

/**
 * 状态提示组件属性类型
 */
interface StatusAlertProps {
    error?: string | null;
    success?: string | string[] | null;
    warning?: string | null;
    gameNotFound?: boolean;
    sx?: object;
}

// 定义 ViewUpdateGameBoxProps 接口
interface ViewUpdateGameBoxProps {
    game: GameData | string | null;
    open: boolean;
    setOpen: (value: boolean) => void;
    onConfirm: () => void;
}

/**
 * 通用提示框组件
 *
 * @param {AlertBoxProps} props 组件属性
 * @returns {JSX.Element} 通用弹窗
 */
export function AlertBox({
    open,
    setOpen,
    title,
    message,
    onConfirm,
    confirmText,
    cancelText,
    confirmColor = 'primary',
    confirmVariant = 'text',
    autoCloseOnConfirm = true,
    isLoading = false
}: AlertBoxProps) {
    const { t } = useTranslation();

    /**
     * 关闭弹窗
     */
    const handleClose = () => {
        if (!isLoading) {
            setOpen(false);
        }
    };

    /**
     * 确认操作
     */
    const handleConfirm = () => {
        onConfirm();
        if (autoCloseOnConfirm && !isLoading) {
            setOpen(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            {title && (
                <DialogTitle id="alert-dialog-title">
                    {title}
                </DialogTitle>
            )}
            {message && (
                <DialogContent>
                    <DialogContentText component="div" id="alert-dialog-description">
                        {message}
                    </DialogContentText>
                </DialogContent>
            )}
            <DialogActions>
                <Button onClick={handleClose} disabled={isLoading}>
                    {cancelText || t('components.AlertBox.cancel')}
                </Button>
                <Button
                    onClick={handleConfirm}
                    color={confirmColor}
                    variant={confirmVariant}
                    autoFocus
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    {isLoading
                        ? t('components.AlertBox.processing')
                        : (confirmText || t('components.AlertBox.confirm'))}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/**
 * 状态提示组件
 * 用于显示错误、成功、警告等状态信息
 *
 * @param {StatusAlertProps} props 组件属性
 * @returns {JSX.Element | null} 状态提示组件
 */
export function StatusAlert({
    error,
    success,
    warning,
    gameNotFound = false,
    sx
}: StatusAlertProps) {
    const { t } = useTranslation();

    return (
        <Box sx={sx}>
            {/* 错误提示 */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    <AlertTitle>{t('components.AlertBox.error', '错误')}</AlertTitle>
                    {error}
                </Alert>
            )}

            {/* 成功提示 */}
            {success && (
                Array.isArray(success) ? (
                    success.map((msg) => (
                        <Alert key={msg} severity="success" sx={{ mb: 2 }}>
                            <AlertTitle>{t('components.AlertBox.success', '成功')}</AlertTitle>
                            {msg}
                        </Alert>
                    ))
                ) : (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        <AlertTitle>{t('components.AlertBox.success', '成功')}</AlertTitle>
                        {success}
                    </Alert>
                )
            )}

            {/* 警告提示 */}
            {warning && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    <AlertTitle>{t('components.AlertBox.warning', '警告')}</AlertTitle>
                    {warning}
                </Alert>
            )}

            {/* 未找到游戏提示 */}
            {gameNotFound && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    <AlertTitle>{t('components.AlertBox.warning', '警告')}</AlertTitle>
                    {t('components.AlertBox.gameNotFound', '未找到游戏数据')}
                </Alert>
            )}
        </Box>
    );
}

/**
 * 删除提示框组件，带加载状态
 *
 * @param {AlertDeleteBoxProps} props 组件属性
 * @returns {JSX.Element} 删除确认弹窗
 */
export const AlertDeleteBox: React.FC<AlertDeleteBoxProps> = ({
    open,
    setOpen,
    onConfirm,
    isLoading = false,
    message,
    title
}) => {
    const { t } = useTranslation();

    return (
        <AlertBox
            open={open}
            setOpen={setOpen}
            title={title || t('components.AlertBox.deleteGameTitle')}
            message={message || t('components.AlertBox.deleteGameMessage')}
            onConfirm={onConfirm}
            confirmText={t('components.AlertBox.confirmDelete')}
            cancelText={t('components.AlertBox.cancel')}
            confirmColor="error"
            confirmVariant="contained"
            autoCloseOnConfirm={false} // 不自动关闭，由父组件控制
            isLoading={isLoading} // 传递加载状态
        />
    );
}

/**
 * 更新游戏信息提示框组件
 *
 * @param {Object} props 组件属性
 * @param {{ name: string; image: string }} props.game 游戏信息
 * @param {boolean} props.open 控制弹窗打开状态
 * @param {(value: boolean) => void} props.setOpen 设置弹窗打开状态的函数
 * @param {() => void} props.onConfirm 确认操作函数
 * @returns {JSX.Element} 更新游戏信息弹窗
 */
export const ViewUpdateGameBox: React.FC<ViewUpdateGameBoxProps> = ({
    game,
    open,
    setOpen,
    onConfirm
}) => {
    const { t } = useTranslation();

    return (
        <AlertBox
            open={open}
            setOpen={setOpen}
            title={t('components.AlertBox.confirmUpdateTitle')}
            message={
                (game && typeof game !== 'string') ?
                    <>
                        <p>{t('components.AlertBox.gameName')}: {game.name}</p>
                        <img src={game.image} alt={game.name} style={{ maxWidth: '100%', maxHeight: '200px' }} />
                    </>
                    :
                    <p>{t('components.AlertBox.noData')}</p>
            }
            onConfirm={onConfirm}
            confirmText={t('components.AlertBox.confirm')}
            cancelText={t('components.AlertBox.cancel')}
            confirmColor="primary"
            confirmVariant="contained"
        />
    );
};