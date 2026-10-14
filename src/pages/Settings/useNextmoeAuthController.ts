import { listen } from "@tauri-apps/api/event";
import { open as openurl } from "@tauri-apps/plugin-shell";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAllSettings, useUpdateSettings } from "@/hooks/queries/useSettings";
import { snackbar } from "@/providers/snackBar";
import { settingsService } from "@/services/invoke";
import { logoutNextmoeAuth } from "@/services/oauth/nextmoeAuthSession";
import type { OAuthCallbackPayload } from "@/services/oauth/oauthAuthSession";
import { toError } from "@/utils/errors";

let isNextmoeOAuthRunning = false;
let nextmoeOAuthAttemptId = 0;
let nextmoeOAuthUnlisteners: Array<() => void> = [];
const nextmoeOAuthStatusListeners = new Set<(isLoading: boolean) => void>();

function clearNextmoeOAuthListeners() {
	for (const unlisten of nextmoeOAuthUnlisteners) {
		unlisten();
	}
	nextmoeOAuthUnlisteners = [];
}

function notifyNextmoeOAuthStatus() {
	for (const listener of nextmoeOAuthStatusListeners) {
		listener(isNextmoeOAuthRunning);
	}
}

function isCurrentNextmoeOAuthAttempt(attemptId: number) {
	return isNextmoeOAuthRunning && attemptId === nextmoeOAuthAttemptId;
}

export function useNextmoeAuthController() {
	const { t } = useTranslation();
	const { data: settings, isLoading: isSettingsLoading } = useAllSettings();
	const nextmoeAuth = settings?.nextmoe_auth;
	const updateSettingsMutation = useUpdateSettings();
	const [isOAuthLoading, setIsOAuthLoading] = useState(isNextmoeOAuthRunning);

	useEffect(() => {
		nextmoeOAuthStatusListeners.add(setIsOAuthLoading);
		setIsOAuthLoading(isNextmoeOAuthRunning);
		return () => {
			nextmoeOAuthStatusListeners.delete(setIsOAuthLoading);
		};
	}, []);

	const handleOAuthLogin = useCallback(async () => {
		if (isNextmoeOAuthRunning) {
			snackbar.info(
				t(
					"pages.Settings.nextmoeAuth.oauthWaiting",
					"请在浏览器中完成 NextMoe 授权...",
				),
			);
			return;
		}

		const attemptId = ++nextmoeOAuthAttemptId;
		try {
			isNextmoeOAuthRunning = true;
			notifyNextmoeOAuthStatus();
			const authorizeUrl = await settingsService.nextmoeOAuthStartLogin();
			if (!isCurrentNextmoeOAuthAttempt(attemptId)) {
				await settingsService.nextmoeOAuthCancelLogin();
				return;
			}
			clearNextmoeOAuthListeners();
			const codeUnlisten = await listen<OAuthCallbackPayload>(
				"nextmoe-oauth-code",
				async (event) => {
					if (!isCurrentNextmoeOAuthAttempt(attemptId)) return;
					clearNextmoeOAuthListeners();
					try {
						const codeVerifier = event.payload.code_verifier?.trim();
						if (!codeVerifier) {
							throw new Error("NextMoe OAuth 回调缺少 PKCE verifier");
						}
						const auth = await settingsService.nextmoeOAuthExchangeCode(
							event.payload.code,
							codeVerifier,
						);
						if (!isCurrentNextmoeOAuthAttempt(attemptId)) return;
						await updateSettingsMutation.mutateAsync({ nextmoeAuth: auth });
						if (!isCurrentNextmoeOAuthAttempt(attemptId)) return;
						snackbar.success(
							t(
								"pages.Settings.nextmoeAuth.oauthSuccess",
								"NextMoe OAuth 登录成功",
							),
						);
					} catch (error) {
						if (!isCurrentNextmoeOAuthAttempt(attemptId)) return;
						console.error(error);
						snackbar.error(
							t(
								"pages.Settings.nextmoeAuth.oauthError",
								"NextMoe OAuth 登录失败: {{error}}",
								{ error: toError(error).message },
							),
						);
					} finally {
						if (isCurrentNextmoeOAuthAttempt(attemptId)) {
							isNextmoeOAuthRunning = false;
							nextmoeOAuthAttemptId += 1;
							notifyNextmoeOAuthStatus();
						}
					}
				},
			);
			if (!isCurrentNextmoeOAuthAttempt(attemptId)) {
				codeUnlisten();
				await settingsService.nextmoeOAuthCancelLogin();
				return;
			}
			const errorUnlisten = await listen<string>(
				"nextmoe-oauth-error",
				(event) => {
					if (!isCurrentNextmoeOAuthAttempt(attemptId)) return;
					clearNextmoeOAuthListeners();
					isNextmoeOAuthRunning = false;
					nextmoeOAuthAttemptId += 1;
					notifyNextmoeOAuthStatus();
					snackbar.error(
						t(
							"pages.Settings.nextmoeAuth.oauthError",
							"NextMoe OAuth 登录失败: {{error}}",
							{ error: event.payload },
						),
					);
				},
			);
			if (!isCurrentNextmoeOAuthAttempt(attemptId)) {
				codeUnlisten();
				errorUnlisten();
				await settingsService.nextmoeOAuthCancelLogin();
				return;
			}
			nextmoeOAuthUnlisteners = [codeUnlisten, errorUnlisten];
			void openurl(authorizeUrl).catch(async (error) => {
				if (!isCurrentNextmoeOAuthAttempt(attemptId)) return;
				console.error(error);
				clearNextmoeOAuthListeners();
				const failedAttemptId = ++nextmoeOAuthAttemptId;
				await settingsService.nextmoeOAuthCancelLogin().catch((cancelError) => {
					console.error(cancelError);
				});
				if (failedAttemptId !== nextmoeOAuthAttemptId) return;
				isNextmoeOAuthRunning = false;
				notifyNextmoeOAuthStatus();
				snackbar.error(
					t(
						"pages.Settings.nextmoeAuth.oauthStartError",
						"启动 NextMoe OAuth 登录失败: {{error}}",
						{ error: toError(error).message },
					),
				);
			});
			snackbar.info(
				t(
					"pages.Settings.nextmoeAuth.oauthWaiting",
					"请在浏览器中完成 NextMoe 授权...",
				),
			);
		} catch (error) {
			if (!isCurrentNextmoeOAuthAttempt(attemptId)) {
				await settingsService.nextmoeOAuthCancelLogin().catch((cancelError) => {
					console.error(cancelError);
				});
				return;
			}
			console.error(error);
			clearNextmoeOAuthListeners();
			const failedAttemptId = ++nextmoeOAuthAttemptId;
			await settingsService.nextmoeOAuthCancelLogin().catch((cancelError) => {
				console.error(cancelError);
			});
			if (failedAttemptId !== nextmoeOAuthAttemptId) return;
			isNextmoeOAuthRunning = false;
			notifyNextmoeOAuthStatus();
			snackbar.error(
				t(
					"pages.Settings.nextmoeAuth.oauthStartError",
					"启动 NextMoe OAuth 登录失败: {{error}}",
					{ error: toError(error).message },
				),
			);
		}
	}, [t, updateSettingsMutation]);

	const handleCancelOAuth = useCallback(async () => {
		if (!isNextmoeOAuthRunning) return;

		const cancelAttemptId = ++nextmoeOAuthAttemptId;
		clearNextmoeOAuthListeners();
		try {
			await settingsService.nextmoeOAuthCancelLogin();
			if (cancelAttemptId !== nextmoeOAuthAttemptId) return;
			snackbar.info(
				t(
					"pages.Settings.nextmoeAuth.oauthCancelled",
					"NextMoe OAuth 登录已取消",
				),
			);
		} catch (error) {
			if (cancelAttemptId !== nextmoeOAuthAttemptId) return;
			console.error(error);
			snackbar.error(
				t(
					"pages.Settings.nextmoeAuth.oauthCancelError",
					"取消 NextMoe OAuth 登录失败: {{error}}",
					{ error: toError(error).message },
				),
			);
		} finally {
			if (cancelAttemptId === nextmoeOAuthAttemptId) {
				isNextmoeOAuthRunning = false;
				nextmoeOAuthAttemptId += 1;
				notifyNextmoeOAuthStatus();
			}
		}
	}, [t]);

	const handleLogout = useCallback(async () => {
		try {
			await logoutNextmoeAuth();
			snackbar.success(
				t("pages.Settings.nextmoeAuth.logoutSuccess", "已退出 NextMoe 登录"),
			);
		} catch (error) {
			console.error(error);
			snackbar.error(
				t("pages.Settings.nextmoeAuth.logoutError", "退出 NextMoe 登录失败"),
			);
		}
	}, [t]);

	return {
		nextmoeAuth,
		isSettingsLoading,
		isOAuthLoading,
		isSaving: updateSettingsMutation.isPending,
		handleOAuthLogin,
		handleCancelOAuth,
		handleLogout,
	};
}
