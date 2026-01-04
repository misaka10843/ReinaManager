/**
 * @file YMGal 月幕Galgame API 封装
 * @description 提供与 YMGal API 交互的函数和类型定义，用于获取游戏信息，返回结构化数据，便于前端统一处理。
 * @module src/api/ym
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - fetchYmByName：根据名称搜索获取游戏详细信息（列表模式）
 * - fetchYmByNameAccurate：精确搜索单个游戏详细信息
 * - fetchYmById：通过 YMGal 游戏 ID 获取游戏详细信息
 *
 * 依赖：
 * - http: 封装的 HTTP 请求工具
 */

import type { FullGameData, YmgalData } from "@/types";
import i18n from "@/utils/i18n";
import { tauriHttp } from "./http";

/**
 * YMGal API 全局配置
 */
const YMGAL_CONFIG = {
	baseUrl: "https://www.ymgal.games",
	clientId: "ymgal",
	clientSecret: "luna0327",
	scope: "public",
};

/**
 * Access Token 缓存
 */
interface TokenCache {
	token: string;
}

let tokenCache: TokenCache | null = null;

/**
 * 获取 YMGal Access Token
 * @returns {Promise<string>} Access Token
 */
async function getAccessToken(forceRefresh = false): Promise<string> {
	if (!forceRefresh && tokenCache?.token) return tokenCache.token;

	try {
		const response = await tauriHttp.get(
			`${YMGAL_CONFIG.baseUrl}/oauth/token`,
			{
				params: {
					grant_type: "client_credentials",
					client_id: YMGAL_CONFIG.clientId,
					client_secret: YMGAL_CONFIG.clientSecret,
					scope: YMGAL_CONFIG.scope,
				},
			},
		);

		const { access_token } = response.data;

		tokenCache = {
			token: access_token,
		};

		return access_token;
	} catch (error) {
		console.error("YMGal获取Access Token失败:", error);
		throw new Error(i18n.t("api.ym.tokenFailed", "YMGal认证失败，请稍后重试"));
	}
}

/**
 * 发起 YMGal API 请求（自动处理认证）
 * @param {string} path API 路径
 * @param {object} params 请求参数
 * @returns {Promise<any>} API 响应数据
 */
async function ymApiRequest(
	path: string,
	params: Record<string, unknown> = {},
) {
	const tryRequest = async (forceRefresh = false) => {
		const token = await getAccessToken(forceRefresh);
		const response = await tauriHttp.get(`${YMGAL_CONFIG.baseUrl}${path}`, {
			params,
			headers: {
				Accept: "application/json;charset=utf-8",
				Authorization: `Bearer ${token}`,
				version: "1",
			},
		});

		// 接口异常码 401/403 也视为需要重取 token 的信号
		if (!response.data.success || response.data.code !== 0) {
			if (response.data.code === 401 || response.data.code === 403) {
				throw new Error("YM_AUTH_RETRY");
			}
			throw new Error(response.data.msg || "API调用失败");
		}

		return response.data.data;
	};

	try {
		return await tryRequest(false);
	} catch (error: unknown) {
		// 请求被拒绝或 token 失效时，清空缓存并强制刷新 token 再重试一次
		const status = (error as { response?: { status?: number } })?.response
			?.status;
		const isAuthError =
			error instanceof Error &&
			(error.message === "YM_AUTH_RETRY" || status === 401 || status === 403);

		if (isAuthError) {
			tokenCache = null;
			return tryRequest(true);
		}

		console.error("YMGal API请求失败:", error);
		throw error;
	}
}

/**
 * 通过 orgId 获取机构名称（用于填充 YmgalData.developer）
 */
async function fetchOrganizationName(
	orgId?: number,
): Promise<string | undefined> {
	if (!orgId) return undefined;
	try {
		const data = await ymApiRequest("/open/archive", { orgId });
		const org = data?.org;
		return org?.chineseName || org?.name || undefined;
	} catch {
		return undefined;
	}
}

/**
 * YMGal 游戏基础信息接口（列表返回）
 */
interface YmGameListItem {
	id: number; // gid
	orgId: number;
	orgName: string;
	releaseDate: string;
	haveChinese: boolean;
	restricted: boolean; // NSFW 限制级标识
	name: string;
	chineseName: string;
	state: string;
	weights: number;
	mainImg: string;
	publishVersion: number;
	publishTime: string;
	publisher: number;
	score: string;
}

/**
 * YMGal 游戏详细信息接口
 */
interface YmGameDetail {
	gid: number;
	developerId: number;
	haveChinese: boolean;
	typeDesc: string;
	releaseDate: string;
	restricted: boolean; // NSFW 限制级标识
	country: string;
	publishVersion: number;
	publishTime: string;
	name: string;
	chineseName: string;
	extensionName: Array<{ name: string; type: string; desc: string }>;
	introduction: string;
	state: string;
	weights: number;
	mainImg: string;
	moreEntry: Array<{ key: string; value: string }>;
	characters: Array<{
		cid: number;
		cvId: number;
		characterPosition: number;
	}>;
	releases: Array<{
		id: number;
		releaseName: string;
		relatedLink: string;
		platform: string;
		releaseDate: string;
		releaseLanguage: string;
		restrictionLevel: string;
	}>;
	website: Array<{ title: string; link: string }>;
	staff: Array<{
		sid: number;
		pid: number;
		empName: string;
		empDesc: string;
		jobName: string;
	}>;
}

/**
 * 将 YMGal 数据转换为统一格式
 * @param {YmGameDetail} ymData YMGal 游戏详细数据
 * @param {boolean} update_batch 是否批量更新模式
 * @returns {FullGameData}
 */
function transformYmData(
	ymData: YmGameDetail,
	update_batch = false,
): FullGameData {
	const aliases = ymData.extensionName?.map((ext) => ext.name).filter(Boolean);

	const ymgal_data: YmgalData = {
		date: ymData.releaseDate,
		image: ymData.mainImg,
		name: ymData.name,
		name_cn: ymData.chineseName,
		aliases: aliases && aliases.length > 0 ? aliases : undefined,
		summary: ymData.introduction,
		developer: undefined,
		nsfw: ymData.restricted,
	};

	return {
		ymgal_id: String(ymData.gid),
		...(update_batch ? {} : { id_type: "ymgal" }),
		date: ymData.releaseDate,
		ymgal_data,
	};
}

/**
 * 根据游戏名称搜索获取游戏列表（列表模式）
 *
 * @param {string} name 游戏名称
 * @param {number} pageNum 页号，从 1 开始
 * @param {number} pageSize 每页数量，范围 1-20
 * @returns {Promise<FullGameData[] | string>} 游戏列表或错误信息
 */
export async function fetchYmByName(
	name: string,
	pageNum = 1,
	pageSize = 20,
): Promise<FullGameData[] | string> {
	try {
		const data = await ymApiRequest("/open/archive/search-game", {
			mode: "list",
			keyword: name.trim(),
			pageNum: pageNum,
			pageSize: pageSize,
		});

		if (!data?.result || data.result.length === 0) {
			return i18n.t("api.ym.notFound", "未找到相关条目，请确认游戏名字后重试");
		}

		// 将列表数据转换为统一格式（不包含详细信息）
		return data.result.map((item: YmGameListItem): FullGameData => {
			const ymgal_data: YmgalData = {
				image: item.mainImg,
				name: item.name,
				name_cn: item.chineseName,
				developer: item.orgName,
				nsfw: item.restricted,
			};

			return {
				ymgal_id: String(item.id),
				id_type: "ymgal",
				date: item.releaseDate,
				ymgal_data,
			};
		});
	} catch (error) {
		console.error("YMGal搜索失败:", error);
		return i18n.t("api.ym.fetchFailed", "获取数据失败，请稍后重试");
	}
}

/**
 * 通过 YMGal 游戏 ID 获取游戏详细信息
 *
 * @param {number} gid YMGal 游戏 ID
 * @returns {Promise<FullGameData | string>} 游戏详细信息或错误信息
 */
export async function fetchYmById(gid: number): Promise<FullGameData | string> {
	try {
		const data = await ymApiRequest("/open/archive", {
			gid,
		});

		if (!data?.game) {
			return i18n.t("api.ym.notFound", "未找到相关条目，请确认游戏ID后重试");
		}

		const result = transformYmData(data.game);
		if (result.ymgal_data) {
			result.ymgal_data.developer = await fetchOrganizationName(
				data.game?.developerId,
			);
		}

		return result;
	} catch (error) {
		console.error("YMGal获取游戏详情失败:", error);
		return i18n.t(
			"api.ym.fetchByIdFailed",
			"YMGal数据获取失败，请检查ID或网络连接",
		);
	}
}

/**
 * 批量获取 YMGal 游戏信息（通过 gid 数组）
 *
 * @param {number[]} gids YMGal 游戏 ID 数组
 * @returns {Promise<Array<FullGameData | string>>} 游戏信息数组
 */
export async function fetchYmByIds(
	gids: number[],
): Promise<Array<FullGameData | string>> {
	const results = await Promise.allSettled(gids.map((gid) => fetchYmById(gid)));

	return results.map((result) => {
		if (result.status === "fulfilled") {
			return result.value;
		}
		return i18n.t("api.ym.fetchFailed", "获取数据失败");
	});
}
