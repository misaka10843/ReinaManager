import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LoginIcon from "@mui/icons-material/Login";
import {
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Avatar,
	Chip,
	IconButton,
	InputAdornment,
	Typography,
} from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputLabel from "@mui/material/InputLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import { getBgmAvatarUrl } from "@/api/bgm";
import type { BgmAuth } from "@/types";
import { useBgmAuthController } from "./useBgmAuthController";

type BgmAccountActionsProps = {
	showCompleteButton: boolean;
	isCompletingAuth: boolean;
	onCompleteAuth: () => void;
	onLogout: () => void;
};

const BgmAccountActions = ({
	showCompleteButton,
	isCompletingAuth,
	onCompleteAuth,
	onLogout,
}: BgmAccountActionsProps) => {
	const { t } = useTranslation();

	return (
		<Stack direction="row" spacing={1} alignItems="center">
			{showCompleteButton && (
				<Button
					variant="outlined"
					size="small"
					onClick={onCompleteAuth}
					disabled={isCompletingAuth}
				>
					{isCompletingAuth
						? t(
								"pages.Settings.bgmTokenSettings.queryingTokenStatus",
								"正在查询 Token 状态...",
							)
						: t(
								"pages.Settings.bgmTokenSettings.queryTokenStatus",
								"查询 Token 状态",
							)}
				</Button>
			)}
			<Button variant="outlined" color="error" size="small" onClick={onLogout}>
				{t("pages.Settings.bgmTokenSettings.logout", "退出登录")}
			</Button>
		</Stack>
	);
};

type BgmAccountSummaryProps = {
	bgmAuth?: BgmAuth | null;
	isCompletingAuth: boolean;
	onCompleteAuth: () => void;
	onLogout: () => void;
};

const BgmAccountSummary = ({
	bgmAuth,
	isCompletingAuth,
	onCompleteAuth,
	onLogout,
}: BgmAccountSummaryProps) => {
	const { t } = useTranslation();
	if (!bgmAuth?.access_token) return null;

	const isOAuth = Boolean(bgmAuth.refresh_token);
	const expiresAt = bgmAuth.expires_at ?? null;
	const expiresDate = expiresAt
		? new Date(expiresAt * 1000).toLocaleString()
		: null;
	const isExpired = expiresAt ? Date.now() / 1000 >= expiresAt : false;
	const username = bgmAuth.username ?? "";
	const displayName = bgmAuth.nickname || username;
	const shouldShowCompleteButton =
		!isOAuth && (bgmAuth.expires_at == null || !bgmAuth.username);
	const actions = (
		<BgmAccountActions
			showCompleteButton={shouldShowCompleteButton}
			isCompletingAuth={isCompletingAuth}
			onCompleteAuth={onCompleteAuth}
			onLogout={onLogout}
		/>
	);

	return (
		<Box className="mb-4">
			{username ? (
				<Stack direction="row" spacing={2} alignItems="flex-start">
					<Avatar
						src={getBgmAvatarUrl(username)}
						alt={displayName}
						sx={{ width: 56, height: 56 }}
					/>
					<Box className="flex-1 min-w-0">
						<Stack
							direction="row"
							spacing={1}
							alignItems="center"
							flexWrap="wrap"
						>
							<Typography variant="body1" className="font-semibold">
								{displayName}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								@{username}
							</Typography>
							<Chip
								label={isOAuth ? "OAuth" : "Access Token"}
								size="small"
								color={isOAuth ? "success" : "default"}
								variant="outlined"
							/>
						</Stack>
						<Typography
							variant="caption"
							color={isExpired ? "error.main" : "text.secondary"}
							className="block mt-1"
						>
							{expiresDate
								? t(
										"pages.Settings.bgmTokenSettings.tokenExpiresAt",
										"Token 有效期至: {{date}}",
										{ date: expiresDate },
									)
								: t(
										"pages.Settings.bgmTokenSettings.tokenExpiryUnknown",
										"Token 有效期未知",
									)}
						</Typography>
					</Box>
					{actions}
				</Stack>
			) : (
				<Stack spacing={1} alignItems="flex-start">
					<Typography variant="caption" color="text.secondary">
						{t(
							"pages.Settings.bgmTokenSettings.profileUnavailable",
							"暂无用户信息，请尝试下方按钮以获取用户信息。",
						)}
					</Typography>
					{actions}
				</Stack>
			)}
		</Box>
	);
};

type BgmOAuthLoginButtonProps = {
	isLoading: boolean;
	onLogin: () => void;
};

const BgmOAuthLoginButton = ({
	isLoading,
	onLogin,
}: BgmOAuthLoginButtonProps) => {
	const { t } = useTranslation();

	return (
		<Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
			<Button
				variant="contained"
				color="primary"
				startIcon={<LoginIcon />}
				onClick={onLogin}
				disabled={isLoading}
			>
				{isLoading
					? t(
							"pages.Settings.bgmTokenSettings.oauthWaiting",
							"请在浏览器中完成授权...",
						)
					: t("pages.Settings.bgmTokenSettings.oauthLogin", "OAuth 快捷登录")}
			</Button>
		</Stack>
	);
};

type BgmTokenLoginPanelProps = {
	inputToken: string;
	isSavingToken: boolean;
	onInputTokenChange: (value: string) => void;
	onSaveToken: () => void;
	onClearToken: () => void;
	onOpenTokenPage: () => void;
};

const BgmTokenLoginPanel = ({
	inputToken,
	isSavingToken,
	onInputTokenChange,
	onSaveToken,
	onClearToken,
	onOpenTokenPage,
}: BgmTokenLoginPanelProps) => {
	const { t } = useTranslation();

	return (
		<Accordion className="w-full">
			<AccordionSummary expandIcon={<ExpandMoreIcon />}>
				<Typography variant="body2">
					{t("pages.Settings.bgmTokenSettings.tokenLogin", "Access Token 登录")}
				</Typography>
			</AccordionSummary>
			<AccordionDetails>
				<Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
					<TextField
						autoComplete="off"
						placeholder={t("pages.Settings.tokenPlaceholder")}
						value={inputToken}
						onChange={(e) => onInputTokenChange(e.target.value)}
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
											onClick={onClearToken}
											edge="end"
											size="small"
											aria-label={t(
												"pages.Settings.bgmTokenSettings.clearToken",
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
						onClick={onSaveToken}
						disabled={isSavingToken}
						className="px-6 py-2"
					>
						{isSavingToken
							? t(
									"pages.Settings.bgmTokenSettings.queryingTokenStatus",
									"正在查询 Token 状态...",
								)
							: t("pages.Settings.bgmTokenSettings.saveToken", "保存")}
					</Button>
					<Button
						variant="outlined"
						color="primary"
						onClick={onOpenTokenPage}
						className="px-6 py-2"
					>
						{t("pages.Settings.getToken")}
					</Button>
				</Stack>
			</AccordionDetails>
		</Accordion>
	);
};

export const BgmTokenSettings = () => {
	const { t } = useTranslation();
	const {
		bgmAuth,
		inputToken,
		isOAuthLoading,
		isCompletingAuth,
		isSavingToken,
		setInputToken,
		handleOpenTokenPage,
		handleSaveToken,
		handleClearToken,
		handleOAuthLogin,
		handleCompleteAuth,
		handleLogout,
	} = useBgmAuthController();

	return (
		<Box className="mb-8">
			<InputLabel className="font-semibold mb-4">
				{t("pages.Settings.bgmToken")}
			</InputLabel>
			<Box className="pl-2 space-y-6">
				<Box>
					<InputLabel className="font-semibold mb-2">
						{t("pages.Settings.bgmTokenSettings.userInfo", "用户信息")}
					</InputLabel>
					<BgmAccountSummary
						bgmAuth={bgmAuth}
						isCompletingAuth={isCompletingAuth}
						onCompleteAuth={handleCompleteAuth}
						onLogout={handleLogout}
					/>
					{!bgmAuth?.access_token && (
						<Typography variant="caption" color="text.secondary">
							{t(
								"pages.Settings.bgmTokenSettings.profileUnavailable",
								"暂无用户信息，请尝试下方按钮以获取用户信息。",
							)}
						</Typography>
					)}
				</Box>

				<Stack spacing={2}>
					<Box>
						<InputLabel className="font-semibold mb-2">
							{t("pages.Settings.bgmTokenSettings.loginMethods", "登录方式")}
						</InputLabel>
						<Typography variant="caption" color="text.secondary">
							{t(
								"pages.Settings.bgmTokenSettings.loginMethodsHint",
								"请任选一种登录方式，推荐 OAuth 快捷登录。",
							)}
						</Typography>
					</Box>
					<BgmOAuthLoginButton
						isLoading={isOAuthLoading}
						onLogin={handleOAuthLogin}
					/>
					<BgmTokenLoginPanel
						inputToken={inputToken}
						isSavingToken={isSavingToken}
						onInputTokenChange={setInputToken}
						onSaveToken={handleSaveToken}
						onClearToken={handleClearToken}
						onOpenTokenPage={handleOpenTokenPage}
					/>
				</Stack>
			</Box>
		</Box>
	);
};
