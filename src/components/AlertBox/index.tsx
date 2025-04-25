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
import { useTranslation } from 'react-i18next';

/**
 * 通用提示框属性类型
 */
interface AlertBoxProps {
    open: boolean;
    setOpen: (value: boolean) => void;
    title?: string;
    message?: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'primary' | 'error' | 'success' | 'info' | 'warning';
    confirmVariant?: 'text' | 'outlined' | 'contained';
    autoCloseOnConfirm?: boolean;  // 确认后是否自动关闭
}

/**
 * 删除提示框专用属性类型
 */
interface AlertDeleteBoxProps {
    open: boolean;
    setOpen: (value: boolean) => void;
    onConfirm: () => void;
    isLoading?: boolean;  // 添加加载状态
    customMessage?: string; // 自定义删除消息
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
    autoCloseOnConfirm = true
}: AlertBoxProps) {
    const { t } = useTranslation();

    /**
     * 关闭弹窗
     */
    const handleClose = () => {
        setOpen(false);
    };

    /**
     * 确认操作
     */
    const handleConfirm = () => {
        onConfirm();
        if (autoCloseOnConfirm) {
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
                    <DialogContentText id="alert-dialog-description">
                        {message}
                    </DialogContentText>
                </DialogContent>
            )}
            <DialogActions>
                <Button onClick={handleClose}>
                    {cancelText || t('components.AlertBox.cancel')}
                </Button>
                <Button
                    onClick={handleConfirm}
                    color={confirmColor}
                    variant={confirmVariant}
                    autoFocus
                >
                    {confirmText || t('components.AlertBox.confirm')}
                </Button>
            </DialogActions>
        </Dialog>
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
    customMessage
}) => {
    const { t } = useTranslation();

    /**
     * 删除确认操作，不自动关闭弹窗，由父组件控制
     */
    const handleDeleteConfirm = () => {
        onConfirm();
        // 不在这里关闭对话框，等待操作完成后由父组件关闭
    };

    return (
        <Dialog
            open={open}
            onClose={() => !isLoading && setOpen(false)}  // 加载时不允许关闭
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">
                {t('components.AlertBox.deleteGameTitle')}
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    {customMessage || t('components.AlertBox.deleteGameMessage')}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={() => setOpen(false)}
                    disabled={isLoading}
                >
                    {t('components.AlertBox.cancel')}
                </Button>
                <Button
                    onClick={handleDeleteConfirm}
                    color="error"
                    variant="contained"
                    autoFocus
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    {isLoading
                        ? t('components.AlertBox.processing')
                        : t('components.AlertBox.confirmDelete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}