/**
 * @file Steam 元数据 API 封装
 * @description 本地 acf/appinfo 索引 + 在线 store appdetails 补全。
 *
 * 数据来源（按用户指定优先级）：
 * 1. 本地游戏侧：`search_steam_acf`（已安装游戏的 appmanifest_*.acf 清单，权威名称）
 * 2. 本地整体：`search_steam_appinfo` / `get_steam_appinfo`（appinfo.vdf 二进制索引，含开发者/别名）
 * 3. 在线：store.steampowered.com/api/appdetails（公开接口，**无需 Web API Key**，
 *    l=schinese&cc=cn 获取中文名/中文简介/本地化封面/标签）
 *
 * 取数流程：
 * - 给 steam id：先查 acf（已安装游戏）→ 再 appinfo → 最后 web 补全
 * - 只给游戏名：先从 appinfo 搜索 → 结果用 acf 名称/已安装状态补全 →
 *   若 appinfo 无结果则用 acf 搜索兜底 → 都无则降级返回空
 *
 * 在线补全发生在选中候选（enrichOnSelect）或按 ID 直取（fetchSteamById）时；
 * 在线失败时优雅降级保留本地数据。
 * Steam Web API Key 保留在请求上下文中，供未来其它 Steam Web API 使用。
 */

import { fileService, type SteamAppInfoEntry } from "@/services/invoke";
import type { GameMetadataDraft, SteamData } from "@/types";
import {
	DEFAULT_METADATA_SEARCH_LIMIT,
	type MetadataSourceContext,
} from "../sourceAdapter";
import {
	createSourceCandidateRecord,
	normalizeGameCandidateSources,
} from "../sourceCandidate";
import { tauriHttp } from "./http";

const STEAM_APPDETAILS_BASE = "https://store.steampowered.com/api/appdetails";

interface SteamAppDetailsData {
	type?: string;
	name?: string;
	steam_appid?: number;
	short_description?: string;
	detailed_description?: string;
	developers?: string[];
	publishers?: string[];
	genres?: Array<{ id: number | string; description: string }>;
	categories?: Array<{ id: number; description: string }>;
	platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
	release_date?: { coming_soon?: boolean; date?: string };
	header_image?: string;
	capsule_image?: string;
	website?: string;
	is_free?: boolean;
}

interface SteamAppDetailsResponse {
	success: boolean;
	data?: SteamAppDetailsData;
}

function mapAppDetails(data: SteamAppDetailsData): SteamData {
	return {
		name: data.name,
		// 竖版封面（600x900）：appdetails 返回的 capsule_image 是横版 616x353，
		image: data.steam_appid
			? steamCoverUrl(data.steam_appid)
			: (data.capsule_image ?? data.header_image),
		summary: data.short_description,
		tags: data.genres?.map((genre) => genre.description),
		developer: data.developers?.[0],
		publishers: data.publishers,
		is_free: data.is_free,
		website: data.website,
		date: data.release_date?.date,
		app_type: data.type,
	};
}

function localEntryToSteamData(entry: SteamAppInfoEntry): SteamData {
	return {
		name: entry.name ?? undefined,
		app_type: entry.app_type ?? undefined,
		oslist: entry.oslist ?? undefined,
		developer: entry.developer ?? undefined,
		publishers: entry.publisher ? [entry.publisher] : undefined,
		date: entry.release_date ?? undefined,
		aliases: entry.aliases
			?.split(",")
			.map((alias) => alias.trim())
			.filter(Boolean),
	};
}

function mergeLocalAndOnline(
	localData: SteamData,
	online: SteamData,
): SteamData {
	return {
		...localData,
		name: online.name ?? localData.name,
		image: online.image ?? localData.image,
		summary: online.summary ?? localData.summary,
		tags: online.tags ?? localData.tags,
		developer: online.developer ?? localData.developer,
		publishers: online.publishers ?? localData.publishers,
		is_free: online.is_free ?? localData.is_free,
		website: online.website ?? localData.website,
		date: online.date ?? localData.date,
		app_type: online.app_type ?? localData.app_type,
		aliases: Array.from(
			new Set([...(localData.aliases ?? []), ...(online.aliases ?? [])]),
		),
	};
}

function createSteamDraft(appid: number, data: SteamData): GameMetadataDraft {
	return normalizeGameCandidateSources(
		{
			id_type: "steam",
			sources: [
				createSourceCandidateRecord("steam", String(appid), {
					...data,
					image: data.image ?? steamCoverUrl(appid),
				}),
			],
		},
		"steam",
	);
}


export function steamCoverUrl(appid: number): string {
	return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;
}

export async function fetchSteamAppDetails(
	appids: readonly number[],
	ctx: MetadataSourceContext,
): Promise<Map<number, SteamData>> {
	const result = new Map<number, SteamData>();
	for (const appid of appids) {
		const url = `${STEAM_APPDETAILS_BASE}?appids=${appid}&l=schinese&cc=cn`;
		const response = await tauriHttp.get<
			Record<string, SteamAppDetailsResponse>
		>(url, {
			...ctx,
			rateLimit: { source: "steam" as const },
		});
		const item = response.data[String(appid)];
		if (item?.success && item.data) {
			result.set(appid, mapAppDetails(item.data));
		}
	}
	return result;
}

export async function fetchSteamByName(
	name: string,
	ctx: MetadataSourceContext,
): Promise<GameMetadataDraft[]> {
	const limit = ctx.limit ?? DEFAULT_METADATA_SEARCH_LIMIT;
	const [appinfoEntries, acfEntries] = await Promise.all([
		fileService.searchSteamAppInfo(name, limit),
		fileService.searchSteamAcf(name, limit),
	]);

	const acfByName = new Map(acfEntries.map((entry) => [entry.app_id, entry]));
	const acfOnly: SteamAppInfoEntry[] = acfEntries
		.filter(
			(entry) => !appinfoEntries.some((info) => info.appid === entry.app_id),
		)
		.map((entry) => ({
			appid: entry.app_id,
			name: entry.name,
			app_type: null,
			oslist: null,
			developer: null,
			publisher: null,
			release_date: null,
			aliases: null,
		}));

	const merged = [...appinfoEntries, ...acfOnly].map((entry) => {
		const acf = acfByName.get(entry.appid);
		const data = localEntryToSteamData(entry);
		if (acf) {
			data.name = acf.name;
		}
		return createSteamDraft(entry.appid, data);
	});

	return merged.slice(0, limit);
}

export async function fetchSteamById(
	appid: number,
	ctx: MetadataSourceContext,
): Promise<GameMetadataDraft> {
	const [acfEntry, appinfoEntry] = await Promise.all([
		fileService.searchSteamAcf(String(appid), 1).then((entries) => entries[0]),
		fileService.getSteamAppInfo(appid),
	]);

	const localData: SteamData = {
		...localEntryToSteamData(
			appinfoEntry ?? {
				appid,
				name: acfEntry?.name ?? null,
				app_type: null,
				oslist: null,
				developer: null,
				publisher: null,
				release_date: null,
				aliases: null,
			},
		),
	};
	if (acfEntry) {
		localData.name = acfEntry.name;
	}

	try {
		const onlineMap = await fetchSteamAppDetails([appid], ctx);
		const online = onlineMap.get(appid);
		return createSteamDraft(
			appid,
			online ? mergeLocalAndOnline(localData, online) : localData,
		);
	} catch {
		return createSteamDraft(appid, localData);
	}
}

export type { SteamAppInfoEntry, SteamAppInfoStatus } from "@/services/invoke";
export { fileService as steamFileService };
