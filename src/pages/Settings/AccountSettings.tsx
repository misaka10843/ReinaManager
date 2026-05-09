import ClearIcon from "@mui/icons-material/Clear";
import { IconButton, InputAdornment, Switch, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputLabel from "@mui/material/InputLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { open as openurl } from "@tauri-apps/plugin-shell";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { BgmTokenSettings } from "@/features/bgm-auth/BgmTokenSettings";
import {
	useAllSettings,
	useUpdateSettings,
	useVndbCurrentUserProfile,
} from "@/hooks/queries/useSettings";
import { snackbar } from "@/providers/snackBar";
import { useStore } from "@/store/appStore";

export { BgmTokenSettings };

export const VndbTokenSettings = () => {
	const { t } = useTranslation();
	const { data: settings } = useAllSettings();
	const vndbToken = settings?.vndb_token ?? "";
	const { data: vndbProfile, isLoading: isVndbProfileLoading } =
		useVndbCurrentUserProfile();
	const updateSettingsMutation = useUpdateSettings();
	const [inputToken, setInputToken] = useState("");

	useEffect(() => {
		setInputToken(vndbToken);
	}, [vndbToken]);

	const handleOpen = () => {
		openurl("https://vndb.org/u/tokens");
	};

	const handleSaveToken = async () => {
		try {
			await updateSettingsMutation.mutateAsync({
				vndbToken: inputToken,
			});
			snackbar.success(
				t(
					"pages.Settings.vndbTokenSettings.saveSuccess",
					"VNDB Token 保存成功",
				),
			);
		} catch (error) {
			console.error(error);
			snackbar.error(
				t("pages.Settings.vndbTokenSettings.saveError", "VNDB Token 保存失败"),
			);
		}
	};

	const handleClearToken = () => {
		setInputToken("");
	};

	return (
		<Box className="mb-8">
			<InputLabel className="font-semibold mb-4">
				{t("pages.Settings.vndbToken", "VNDB Token")}
			</InputLabel>
			{vndbToken && (
				<Box className="mb-4">
					{isVndbProfileLoading ? (
						<Typography variant="caption" color="text.secondary">
							{t(
								"pages.Settings.vndbTokenSettings.loadingProfile",
								"正在获取当前 VNDB 账号信息...",
							)}
						</Typography>
					) : vndbProfile ? (
						<Box>
							<Typography variant="body2" className="font-semibold">
								{vndbProfile.username}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								{t(
									"pages.Settings.vndbTokenSettings.userId",
									"用户 ID: {{id}}",
									{ id: vndbProfile.id },
								)}
							</Typography>
							<Typography
								variant="caption"
								color="text.secondary"
								className="block"
							>
								{t(
									"pages.Settings.vndbTokenSettings.permissions",
									"权限: {{permissions}}",
									{
										permissions: vndbProfile.permissions.join(", ") || "none",
									},
								)}
							</Typography>
						</Box>
					) : (
						<Typography variant="caption" color="text.secondary">
							{t(
								"pages.Settings.vndbTokenSettings.profileUnavailable",
								"当前 VNDB Token 无法获取用户信息，请检查令牌或权限是否有效。",
							)}
						</Typography>
					)}
				</Box>
			)}

			<Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
				<TextField
					autoComplete="off"
					placeholder={t(
						"pages.Settings.vndbTokenPlaceholder",
						"请填写你的 VNDB Token",
					)}
					value={inputToken}
					onChange={(e) => setInputToken(e.target.value)}
					variant="outlined"
					size="medium"
					className="min-w-60"
					slotProps={{
						htmlInput: {
							style: {
								WebkitTextSecurity: "disc",
								textSecurity: "disc",
							},
						},
						input: {
							endAdornment: inputToken && (
								<InputAdornment position="end">
									<IconButton
										onClick={handleClearToken}
										edge="end"
										size="small"
										aria-label={t(
											"pages.Settings.vndbTokenSettings.clearToken",
											"清除令牌",
										)}
									>
										<ClearIcon />
									</IconButton>
								</InputAdornment>
							),
						},
					}}
				/>
				<Button
					variant="contained"
					color="primary"
					onClick={handleSaveToken}
					disabled={updateSettingsMutation.isPending}
					className="px-6 py-2"
				>
					{t("pages.Settings.saveBtn")}
				</Button>
				<Button
					variant="outlined"
					color="primary"
					onClick={handleOpen}
					className="px-6 py-2"
				>
					{t("pages.Settings.getToken")}
				</Button>
			</Stack>
		</Box>
	);
};

export const CollectionSyncSettings = () => {
	const { t } = useTranslation();
	const {
		syncBgmCollection,
		setSyncBgmCollection,
		syncVndbCollection,
		setSyncVndbCollection,
	} = useStore(
		useShallow((s) => ({
			syncBgmCollection: s.syncBgmCollection,
			setSyncBgmCollection: s.setSyncBgmCollection,
			syncVndbCollection: s.syncVndbCollection,
			setSyncVndbCollection: s.setSyncVndbCollection,
		})),
	);

	return (
		<Box className="mb-6">
			<InputLabel className="font-semibold mb-4">
				{t("pages.Settings.collectionSync.title", "收藏状态同步")}
			</InputLabel>
			<Box className="pl-2 space-y-4">
				<Stack direction="row" alignItems="center" className="min-w-60">
					<Box>
						<InputLabel className="font-semibold mb-1">
							{t(
								"pages.Settings.collectionSync.bgmTitle",
								"启用 Bangumi 收藏同步",
							)}
						</InputLabel>
						<Typography variant="caption" color="text.secondary">
							{t(
								"pages.Settings.collectionSync.bgmDescription",
								"添加游戏时尝试读取 BGM 收藏状态，本地修改状态时同步回 BGM。",
							)}
						</Typography>
					</Box>
					<Switch
						checked={syncBgmCollection}
						onChange={(e) => setSyncBgmCollection(e.target.checked)}
						color="primary"
					/>
				</Stack>
				<Stack direction="row" alignItems="center" className="min-w-60">
					<Box>
						<InputLabel className="font-semibold mb-1">
							{t(
								"pages.Settings.collectionSync.vndbTitle",
								"启用 VNDB 收藏同步",
							)}
						</InputLabel>
						<Typography variant="caption" color="text.secondary">
							{t(
								"pages.Settings.collectionSync.vndbDescription",
								"添加游戏时尝试读取 VNDB 收藏状态，本地修改状态时同步回 VNDB。",
							)}
						</Typography>
					</Box>
					<Switch
						checked={syncVndbCollection}
						onChange={(e) => setSyncVndbCollection(e.target.checked)}
						color="primary"
					/>
				</Stack>
			</Box>
		</Box>
	);
};
