import { listen } from "@tauri-apps/api/event";
import { open as openurl } from "@tauri-apps/plugin-shell";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildManualBgmAuth, completeBgmAuth } from "@/api/bgm";
import { useAllSettings, useUpdateSettings } from "@/hooks/queries/useSettings";
import { snackbar } from "@/providers/snackBar";
import { settingsService } from "@/services/invoke";
import { logoutBgmAuth } from "@/utils/bgmAuthSession";
import { toError } from "@/utils/errors";

export function useBgmAuthController() {
	const { t } = useTranslation();
	const { data: settings } = useAllSettings();
	const bgmAuth = settings?.bgm_auth;
	const bgmToken = bgmAuth?.access_token ?? "";
	const updateSettingsMutation = useUpdateSettings();
	const [inputToken, setInputToken] = useState("");
	const [isOAuthLoading, setIsOAuthLoading] = useState(false);
	const [isCompletingAuth, setIsCompletingAuth] = useState(false);
	const [isSavingToken, setIsSavingToken] = useState(false);
	const oauthUnlistenersRef = useRef<Array<() => void>>([]);

	const clearOAuthListeners = useCallback(() => {
		for (const unlisten of oauthUnlistenersRef.current) {
			unlisten();
		}
		oauthUnlistenersRef.current = [];
	}, []);

	useEffect(() => {
		setInputToken(bgmToken);
	}, [bgmToken]);

	useEffect(() => {
		return () => {
			clearOAuthListeners();
		};
	}, [clearOAuthListeners]);

	const handleOpenTokenPage = () => {
		openurl("https://next.bgm.tv/demo/access-token/create");
	};

	const handleSaveToken = async () => {
		const accessToken = inputToken.trim();
		try {
			setIsSavingToken(true);
			const auth = await buildManualBgmAuth(accessToken);

			await updateSettingsMutation.mutateAsync({
				bgmAuth: auth,
			});
			snackbar.success(
				t("pages.Settings.bgmTokenSettings.saveSuccess", "BGM Token 保存成功"),
			);
		} catch (error) {
			console.error(error);
			snackbar.error(
				t(
					"pages.Settings.bgmTokenSettings.saveErrorWithDetail",
					"BGM Token 保存失败: {{error}}",
					{ error: toError(error).message },
				),
			);
		} finally {
			setIsSavingToken(false);
		}
	};

	const handleClearToken = () => {
		setInputToken("");
	};

	const handleOAuthLogin = useCallback(async () => {
		try {
			setIsOAuthLoading(true);
			const authorizeUrl = await settingsService.bgmOAuthStartLogin();
			clearOAuthListeners();
			const codeUnlisten = await listen<string>(
				"bgm-oauth-code",
				async (event) => {
					clearOAuthListeners();
					try {
						const auth = await settingsService.bgmOAuthExchangeCode(
							event.payload,
						);
						await updateSettingsMutation.mutateAsync({
							bgmAuth: await completeBgmAuth(auth),
						});
						snackbar.success(
							t(
								"pages.Settings.bgmTokenSettings.oauthSuccess",
								"Bangumi OAuth 登录成功",
							),
						);
					} catch (error) {
						console.error(error);
						snackbar.error(
							t(
								"pages.Settings.bgmTokenSettings.oauthError",
								"OAuth 登录失败: {{error}}",
								{ error: toError(error).message },
							),
						);
					} finally {
						setIsOAuthLoading(false);
					}
				},
			);
			const errorUnlisten = await listen<string>("bgm-oauth-error", (event) => {
				clearOAuthListeners();
				setIsOAuthLoading(false);
				snackbar.error(
					t(
						"pages.Settings.bgmTokenSettings.oauthError",
						"OAuth 登录失败: {{error}}",
						{ error: event.payload },
					),
				);
			});
			oauthUnlistenersRef.current = [codeUnlisten, errorUnlisten];
			await openurl(authorizeUrl);
			snackbar.info(
				t(
					"pages.Settings.bgmTokenSettings.oauthWaiting",
					"请在浏览器中完成授权...",
				),
			);
		} catch (error) {
			console.error(error);
			clearOAuthListeners();
			setIsOAuthLoading(false);
			snackbar.error(
				t(
					"pages.Settings.bgmTokenSettings.oauthStartError",
					"启动 OAuth 登录失败: {{error}}",
					{ error: toError(error).message },
				),
			);
		}
	}, [clearOAuthListeners, t, updateSettingsMutation]);

	const handleCompleteAuth = useCallback(async () => {
		if (!bgmAuth?.access_token) return;
		try {
			setIsCompletingAuth(true);

			await updateSettingsMutation.mutateAsync({
				bgmAuth: await completeBgmAuth(bgmAuth),
			});
			snackbar.success(
				t(
					"pages.Settings.bgmTokenSettings.tokenStatusSuccess",
					"授权信息已更新",
				),
			);
		} catch (error) {
			console.error(error);
			snackbar.error(
				t(
					"pages.Settings.bgmTokenSettings.tokenStatusError",
					"无法查询 Token 状态: {{error}}",
					{ error: toError(error).message },
				),
			);
		} finally {
			setIsCompletingAuth(false);
		}
	}, [bgmAuth, t, updateSettingsMutation]);

	const handleLogout = useCallback(async () => {
		try {
			await logoutBgmAuth();
			setInputToken("");
			snackbar.success(
				t("pages.Settings.bgmTokenSettings.logoutSuccess", "已退出 BGM 登录"),
			);
		} catch (error) {
			console.error(error);
			snackbar.error(
				t("pages.Settings.bgmTokenSettings.logoutError", "退出登录失败"),
			);
		}
	}, [t]);

	return {
		bgmAuth,
		inputToken,
		isOAuthLoading,
		isCompletingAuth,
		isSavingToken: isSavingToken || updateSettingsMutation.isPending,
		setInputToken,
		handleOpenTokenPage,
		handleSaveToken,
		handleClearToken,
		handleOAuthLogin,
		handleCompleteAuth,
		handleLogout,
	};
}
