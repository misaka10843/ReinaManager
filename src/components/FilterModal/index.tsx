/**
 * @file FilterModal 组件
 * @description 游戏筛选弹窗组件，支持按全部、本地、网络三种类型筛选游戏，集成国际化，适用于游戏库筛选功能。
 * @module src/components/FilterModal/index
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - FilterModal：游戏筛选弹窗组件
 *
 * 依赖：
 * - @mui/material
 * - @mui/icons-material
 * - @/store
 * - react-i18next
 */

import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useStore } from '@/store';
import { useTranslation } from 'react-i18next';

export type GameFilterType = 'all' | 'local' | 'online' | 'clear';

/**
 * FilterModal 组件用于筛选游戏类型。
 * 支持全部、本地、网络三种类型筛选，弹窗形式，集成国际化。
 *
 * @component
 * @returns {JSX.Element} 游戏筛选弹窗
 */
export const FilterModal: React.FC = () => {
    const { t } = useTranslation();
    const { gameFilterType, setGameFilterType } = useStore();

    const [open, setOpen] = useState(false);
    const [filterValue, setFilterValue] = useState<GameFilterType>(gameFilterType || 'all');

    /**
     * 打开筛选弹窗
     */
    const handleOpen = () => setOpen(true);

    /**
     * 关闭筛选弹窗
     */
    const handleClose = () => setOpen(false);

    /**
     * 切换筛选类型
     * @param event React.ChangeEvent<HTMLInputElement>
     */
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFilterValue(event.target.value as GameFilterType);
    };

    /**
     * 应用筛选条件
     */
    const handleApply = () => {
        setGameFilterType(filterValue);
        handleClose();
    };

    return (
        <>
            <Button
                startIcon={<FilterListIcon />}
                onClick={handleOpen}
            >
                {t('components.FilterModal.filter')}
            </Button>

            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>{t('components.FilterModal.filterTitle')}</DialogTitle>
                <DialogContent>
                    <FormControl component="fieldset">
                        <RadioGroup value={filterValue} onChange={handleChange}>
                            <FormControlLabel
                                value="all"
                                control={<Radio />}
                                label={t('components.FilterModal.allGames')}
                            />
                            <FormControlLabel
                                value="local"
                                control={<Radio />}
                                label={t('components.FilterModal.localGames')}
                            />
                            <FormControlLabel
                                value="online"
                                control={<Radio />}
                                label={t('components.FilterModal.onlineGames')}
                            />
                            <FormControlLabel
                                value="clear"
                                control={<Radio />}
                                label={t('components.FilterModal.clearGames')}
                            />
                        </RadioGroup>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>
                        {t('components.FilterModal.cancel')}
                    </Button>
                    <Button onClick={handleApply} color="primary">
                        {t('components.FilterModal.apply')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}