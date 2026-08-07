/**
 * @file Steam Web API Key 会话辅助
 * @description 从用户设置中读取 Steam Web API Key 并注入元数据请求上下文。
 *
 * 与 BGM OAuth 不同，Steam Key 是静态字符串，无过期/刷新逻辑。
 * 注意：appdetails 在线补全是公开接口、不依赖 Key；Key 保留供未来其它
 * Steam Web API（如 ISteamApps）使用。未配置 Key 时返回 undefined，
 * 在线补全仍会正常执行。
 */

import { settingsKeys } from "@/hooks/queries/useSettings";
import { queryClient } from "@/providers/queryClient";
import { settingsService, type UserSettings } from "@/services/invoke";

async function getSteamApiKey(): Promise<string | undefined> {
	const cached = queryClient.getQueryData<UserSettings>(
		settingsKeys.allSettings(),
	);
	const settings =
		cached ??
		(await queryClient.fetchQuery({
			queryKey: settingsKeys.allSettings(),
			queryFn: () => settingsService.getAllSettings(),
		}));
	return settings?.steam_api_key?.trim() || undefined;
}

/**
 * 读取 Steam Web API Key 并调用回调。
 * 未配置 Key 时回调收到 undefined（appdetails 在线补全不受影响）。
 */
export async function withSteamApiKey<T>(
	fn: (steamApiKey?: string) => Promise<T>,
): Promise<T> {
	const steamApiKey = await getSteamApiKey();
	return fn(steamApiKey);
}
