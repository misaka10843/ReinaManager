import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox, FormControlLabel } from '@mui/material';
import { useStore } from '@/store';

const WindowCloseHandler: React.FC = () => {
    const { setSkipCloseRemind } = useStore();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const w = getCurrentWindow();
        let unlisten = () => { };
        // 拦截关闭
        // @ts-ignore: onCloseRequested API provides preventDefault
        w.onCloseRequested((event) => {
            // @ts-ignore
            event.preventDefault();
            // 获取最新的状态值，避免闭包陷阱
            const currentSkipRemind = useStore.getState().skipCloseRemind;
            const currentDefaultAction = useStore.getState().defaultCloseAction;

            if (currentSkipRemind) {
                if (currentDefaultAction === 'hide') {
                    w.hide();
                } else {
                    w.destroy();
                }
            } else {
                setOpen(true);
            }
        }).then(fn => { unlisten = fn });
        return () => { unlisten(); };
    }, []); // 移除依赖项，避免重复注册监听器

    const handleCancel = () => {
        setSkipCloseRemind(false);
        setOpen(false);
    };
    const handleHide = () => {
        setOpen(false);
        getCurrentWindow().hide();
    };
    const handleExit = () => {
        setOpen(false);
        getCurrentWindow().destroy();
    };

    return (
        <Dialog open={open} onClose={handleCancel}>
            <DialogTitle>{t('components.Window.closeDialog.title')}</DialogTitle>
            <DialogContent>
                <div>{t('components.Window.closeDialog.message')}</div>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={useStore.getState().skipCloseRemind}
                            onChange={e => {
                                setSkipCloseRemind(e.target.checked);
                            }}
                            color="primary"
                        />
                    }
                    label={t('components.Window.closeDialog.dontRemind')}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleHide}>{t('components.Window.closeDialog.minimizeToTray')}</Button>
                <Button onClick={handleExit} color="primary">{t('components.Window.closeDialog.exitApp')}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default WindowCloseHandler;
