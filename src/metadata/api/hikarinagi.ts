import i18next from "i18next";
import type {
	GameMetadataDraft,
	HikarinagiAuth,
	HikarinagiData,
} from "@/types";
import { AppError, isHttpStatus } from "@/utils/errors";
import { USER_AGENT } from "../constants";
import type { SourceDisplayFields } from "../sourceCandidate";
import {
	createGameCandidate,
	createSourceCandidate,
	createSourceCandidateRecord,
	mergeCandidateDetailData,
	type SourceCandidate,
} from "../sourceCandidate";
import http, {
	type NetworkRequestContext,
	type TauriHttpOptions,
} from "./http";

const HIKARINAGI_API_BASE_URL = "https://www.hikarinagi.org/api/v3/open";
const HIKARINAGI_CDN_BASE_URL = "https://images.yurari.moe/";

const HIKARINAGI_JSON_HEADERS = {
	Accept: "application/json",
	"User-Agent": USER_AGENT,
} as const;

interface HikarinagiApiEnvelope<T> {
	data?: T;
}

interface HikarinagiCover {
	url?: string;
}

interface HikarinagiGameResponse {
	aliases?: string[];
	covers?: HikarinagiCover[];
	id: number;
	images?: HikarinagiCover[];
	nsfw?: boolean;
	origin_intro?: string | null;
	origin_title?: string;
	release_date?: string | null;
	tags?: Array<{ name?: string }>;
	trans_intro?: string | null;
	trans_title?: string | null;
}

export interface HikarinagiSearchHit {
	cover?: HikarinagiCover | null;
	developer?: string | null;
	id: number;
	subtitle?: string | null;
	title?: string | null;
	type: string;
}

interface HikarinagiSearchResponse {
	items?: HikarinagiSearchHit[];
}

export interface HikarinagiUserProfile {
	id: number;
	name: string;
}

export type HikarinagiStatus =
	| "GOING"
	| "COMPLETED"
	| "ON_HOLD"
	| "DROPPED"
	| "PLAN";

export interface HikarinagiRate {
	id: number;
	is_spoiler?: boolean;
	rate?: number | null;
	rate_content?: string;
	status?: HikarinagiStatus;
}

export interface HikarinagiRatePage {
	items: HikarinagiRate[];
	meta: {
		page: number;
		page_size: number;
		total_pages: number;
		total_items: number;
	};
}

export interface HikarinagiRateUpdatePayload {
	is_spoiler?: boolean;
	rate?: number | null;
	rate_content?: string;
	status?: HikarinagiStatus;
}

function unwrapData<T>(payload: HikarinagiApiEnvelope<T> | T): T {
	if (payload && typeof payload === "object" && "data" in payload) {
		const data = (payload as HikarinagiApiEnvelope<T>).data;
		if (data !== undefined) return data;
	}
	return payload as T;
}

function buildHikarinagiOptions(
	token?: string,
	context: NetworkRequestContext = {},
): TauriHttpOptions {
	const headers: Record<string, string> = { ...HIKARINAGI_JSON_HEADERS };
	if (token) headers.Authorization = `Bearer ${token}`;

	return {
		...context,
		headers,
		rateLimit: { source: "hikarinagi" },
	};
}

function resolveHikarinagiAssetUrl(url?: string | null) {
	if (!url) return undefined;
	if (/^https?:\/\//i.test(url)) return url;
	return new URL(url, HIKARINAGI_CDN_BASE_URL).toString();
}

function normalizeText(value?: string | null) {
	const text = value?.trim();
	return text || undefined;
}

function normalizeDate(value?: string | null) {
	return normalizeText(value)?.split("T", 1)[0];
}

function isChineseLanguage() {
	const language = i18next.language.toLowerCase();
	return language === "zh" || language.startsWith("zh-");
}

function toHikarinagiData(
	game: HikarinagiGameResponse,
	searchHit?: HikarinagiSearchHit,
): HikarinagiData {
	const originTitle =
		normalizeText(game.origin_title) ?? normalizeText(searchHit?.title);
	const translatedTitle = normalizeText(game.trans_title);
	const originIntro = normalizeText(game.origin_intro);
	const translatedIntro = normalizeText(game.trans_intro);
	const summary = isChineseLanguage()
		? (translatedIntro ?? originIntro)
		: (originIntro ?? translatedIntro);
	const cover =
		game.covers?.[0]?.url ?? game.images?.[0]?.url ?? searchHit?.cover?.url;

	return {
		image: resolveHikarinagiAssetUrl(cover),
		name: originTitle,
		name_cn: translatedTitle,
		aliases: game.aliases,
		summary,
		tags: game.tags?.flatMap((tag) => (tag.name ? [tag.name] : [])),
		developer: normalizeText(searchHit?.developer),
		nsfw: game.nsfw,
		date:
			normalizeDate(game.release_date) ?? normalizeDate(searchHit?.subtitle),
	};
}

function toHikarinagiDraft(
	game: HikarinagiGameResponse,
	searchHit?: HikarinagiSearchHit,
): GameMetadataDraft {
	return createGameCandidate({
		idType: "hikarinagi",
		source: createSourceCandidateRecord(
			"hikarinagi",
			String(game.id),
			toHikarinagiData(game, searchHit),
		),
	});
}

export async function fetchHikarinagiById(
	id: string,
	token?: string,
	context: NetworkRequestContext = {},
): Promise<GameMetadataDraft> {
	const response = await http.get<
		HikarinagiApiEnvelope<HikarinagiGameResponse>
	>(
		`${HIKARINAGI_API_BASE_URL}/galgames/${id}`,
		buildHikarinagiOptions(token, context),
	);
	const game = unwrapData(response.data);

	if (!game?.id) {
		throw new AppError({
			code: "metadata_not_found",
			message: `Hikarinagi galgame not found: ${id}`,
		});
	}

	return toHikarinagiDraft(game);
}

export async function fetchHikarinagiByName(
	name: string,
	token?: string,
	limit = 8,
	context: NetworkRequestContext = {},
): Promise<SourceCandidate<HikarinagiData>[]> {
	const response = await http.get<
		HikarinagiApiEnvelope<HikarinagiSearchResponse>
	>(`${HIKARINAGI_API_BASE_URL}/search`, {
		...buildHikarinagiOptions(token, context),
		params: {
			q: name.trim(),
			types: "galgame",
			page: 1,
			page_size: limit,
		},
	});
	const search = unwrapData(response.data);

	return (search?.items ?? [])
		.filter((item) => item.type === "galgame" && item.id)
		.map((item) => {
			const data = toHikarinagiData(
				{
					id: item.id,
				},
				item,
			);
			return createSourceCandidate({
				source: "hikarinagi",
				externalId: String(item.id),
				data,
				display: {
					image: data.image,
					name: data.name,
					developer: data.developer,
					date: data.date,
				},
			});
		});
}

export async function fetchHikarinagiCurrentUserProfile(
	token: string,
	context: NetworkRequestContext = {},
): Promise<HikarinagiUserProfile> {
	const response = await http.get<HikarinagiApiEnvelope<HikarinagiUserProfile>>(
		`${HIKARINAGI_API_BASE_URL}/user/me`,
		buildHikarinagiOptions(token, context),
	);
	return unwrapData(response.data);
}

export async function completeHikarinagiAuth(
	auth: HikarinagiAuth,
	context: NetworkRequestContext = {},
): Promise<HikarinagiAuth> {
	if (auth.user_id != null && auth.name) return auth;

	const profile = await fetchHikarinagiCurrentUserProfile(
		auth.access_token,
		context,
	);
	return {
		...auth,
		user_id: auth.user_id ?? profile.id,
		name: auth.name ?? profile.name,
	};
}

export async function fetchHikarinagiGameRate(
	id: string,
	token: string,
	context: NetworkRequestContext = {},
): Promise<HikarinagiRate | null> {
	try {
		const response = await http.get<HikarinagiApiEnvelope<HikarinagiRate>>(
			`${HIKARINAGI_API_BASE_URL}/user/me/rates/galgames/${id}`,
			buildHikarinagiOptions(token, context),
		);
		return unwrapData(response.data);
	} catch (error) {
		if (isHttpStatus(error, 404)) return null;
		throw error;
	}
}

export async function fetchHikarinagiRatesPage(
	token: string,
	params: { page: number; pageSize: number },
	context: NetworkRequestContext = {},
): Promise<HikarinagiRatePage> {
	const response = await http.get<HikarinagiApiEnvelope<HikarinagiRatePage>>(
		`${HIKARINAGI_API_BASE_URL}/user/me/rates`,
		{
			...buildHikarinagiOptions(token, context),
			params: {
				page: params.page,
				page_size: params.pageSize,
				work_type: "GALGAME",
			},
		},
	);
	const page = unwrapData(response.data);
	return {
		items: Array.isArray(page?.items) ? page.items : [],
		meta: {
			page: page?.meta?.page ?? params.page,
			page_size: page?.meta?.page_size ?? params.pageSize,
			total_pages: page?.meta?.total_pages ?? 0,
			total_items: page?.meta?.total_items ?? 0,
		},
	};
}

export async function updateHikarinagiGameRate(
	id: string,
	payload: HikarinagiRateUpdatePayload,
	token: string,
	context: NetworkRequestContext = {},
) {
	await http.put(
		`${HIKARINAGI_API_BASE_URL}/user/me/rates/galgames/${id}`,
		payload,
		buildHikarinagiOptions(token, context),
	);
	return true;
}

export function getHikarinagiDataDisplayFields(
	data: HikarinagiData,
): SourceDisplayFields {
	return {
		image: data.image,
		name: data.name,
		name_cn: data.name_cn,
		summary: data.summary,
		tags: data.tags ?? [],
		developer: data.developer,
		aliases: data.aliases ?? [],
		nsfw: data.nsfw,
		date: data.date,
	};
}

export function mergeHikarinagiSearchCandidate(
	candidate: SourceCandidate<HikarinagiData>,
	details: GameMetadataDraft,
) {
	return mergeCandidateDetailData(candidate, details);
}
