import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";

interface GameLocalPathDialogProps {
	open: boolean;
	localPath: string;
	isSaving: boolean;
	onClose: () => void;
	onLocalPathChange: (value: string) => void;
	onSelectExecutable: () => void;
	onSave: () => void;
}

export function GameLocalPathDialog({
	open,
	localPath,
	isSaving,
	onClose,
	onLocalPathChange,
	onSelectExecutable,
	onSave,
}: GameLocalPathDialogProps) {
	const { t } = useTranslation();

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>
				{t("components.LaunchModal.setLocalPathTitle", "设置本地路径")}
			</DialogTitle>
			<DialogContent>
				<Box sx={{ display: "flex", gap: 1, mt: 2 }}>
					<TextField
						label={t("components.LaunchModal.localPathLabel", "可执行文件路径")}
						variant="outlined"
						fullWidth
						value={localPath}
						onChange={(e) => onLocalPathChange(e.target.value)}
						disabled={isSaving}
						onKeyDown={(e) => {
							if (e.key === "Enter" && localPath.trim()) {
								onSave();
							}
						}}
					/>
					<IconButton
						onClick={onSelectExecutable}
						disabled={isSaving}
						color="primary"
					>
						<FolderOpenIcon />
					</IconButton>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={isSaving}>
					{t("common.cancel", "取消")}
				</Button>
				<Button
					onClick={onSave}
					variant="contained"
					disabled={!localPath.trim() || isSaving}
				>
					{isSaving
						? t("common.saving", "保存中...")
						: t("common.confirm", "确认")}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
