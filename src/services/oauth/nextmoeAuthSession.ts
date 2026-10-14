import i18next from "i18next";
import { settingsKeys } from "@/hooks/queries/useSettings";
import { queryClient } from "@/providers/queryClient";
import { snackbar } from "@/providers/snackBar";
import { settingsService, type UserSettings } from "@/services/invoke";
import {
	isOAuthAuthExpired,
	isOAuthAuthRefreshDue,
	isRefreshCredentialError,
	nowUnixSeconds,
} from "@/services/oauth/oauthAuthSession";
import type { NextmoeAuth } from "@/types";
import { AppError, isHttpStatus } from "@/utils/errors";

let nextmoeRefreshPromise: Promise<NextmoeAuth | null> | null = null;

export function isNextmoeAuthRefreshDue(
	auth: NextmoeAuth | null | undefined,
	now = nowUnixSeconds(),
) {
	return isOAuthAuthRefreshDue(auth, now);
}

function getCachedSettings() {
	return queryClient.getQueryData<UserSettings>(settingsKeys.allSettings());
}

async function fetchSettings() {
	return queryClient.fetchQuery({
		queryKey: settingsKeys.allSettings(),
		queryFn: () => settingsService.getAllSettings(),
	});
}

function updateCachedNextmoeAuth(auth: NextmoeAuth | null) {
	const settings = getCachedSettings();
	if (settings) {
		queryClient.setQueryData<UserSettings>(settingsKeys.allSettings(), {
			...settings,
			nextmoe_auth: auth,
		});
	}
}

function getReloginMessage() {
	return i18next.t(
		"pages.Settings.nextmoeAuth.reloginRequired",
		"NextMoe 登录已失效，请重新登录。",
	);
}

export async function logoutNextmoeAuth(options?: { notify?: boolean }) {
	await settingsService.updateSettings({ nextmoeAuth: null });
	updateCachedNextmoeAuth(null);
	await queryClient.invalidateQueries({ queryKey: settingsKeys.allSettings() });

	if (options?.notify) {
		snackbar.error(getReloginMessage());
	}
}

async function refreshNextmoeAuth(
	auth: NextmoeAuth,
): Promise<NextmoeAuth | null> {
	if (!auth.refresh_token) return auth;

	try {
		const refreshedAuth = await settingsService.nextmoeOAuthRefreshToken(
			auth.refresh_token,
		);
		updateCachedNextmoeAuth(refreshedAuth);
		await queryClient.invalidateQueries({
			queryKey: settingsKeys.allSettings(),
		});
		return refreshedAuth;
	} catch (error) {
		if (isRefreshCredentialError(error)) {
			await logoutNextmoeAuth({ notify: true });
			return null;
		}
		throw error;
	}
}

async function refreshNextmoeAuthSingleFlight(auth: NextmoeAuth) {
	nextmoeRefreshPromise ??= refreshNextmoeAuth(auth).finally(() => {
		nextmoeRefreshPromise = null;
	});
	return nextmoeRefreshPromise;
}

async function getValidNextmoeAuth() {
	const settings = await fetchSettings();
	const auth = settings.nextmoe_auth ?? null;

	if (!auth?.access_token) return null;
	const validAuth = isNextmoeAuthRefreshDue(auth)
		? await refreshNextmoeAuthSingleFlight(auth)
		: auth;
	return isOAuthAuthExpired(validAuth) ? null : validAuth;
}

export function isNextmoeAuthExpiredError(error: unknown) {
	return error instanceof Error && error.name === "NextmoeAuthExpiredError";
}

export async function withNextmoeAuth<T>(
	fn: (token?: string, auth?: NextmoeAuth) => Promise<T>,
) {
	const auth = await getValidNextmoeAuth();
	const token = auth?.access_token;

	try {
		return await fn(token, auth ?? undefined);
	} catch (error) {
		if (token && isHttpStatus(error, 401)) {
			await logoutNextmoeAuth({ notify: true });
			throw new AppError({
				code: "nextmoe_auth_expired",
				message: getReloginMessage(),
				cause: error,
				name: "NextmoeAuthExpiredError",
			});
		}
		throw error;
	}
}

export function hasNextmoeScope(
	auth: NextmoeAuth | null | undefined,
	requiredScope: string,
) {
	return new Set(auth?.scope?.split(/\s+/).filter(Boolean) ?? []).has(
		requiredScope,
	);
}

export async function initNextmoeAuthRefresh() {
	try {
		await getValidNextmoeAuth();
	} catch (error) {
		console.error("NextMoe OAuth 自动刷新检查失败:", error);
	}
}
