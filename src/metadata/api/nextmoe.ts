import i18next from "i18next";
import type { GameMetadataDraft, NextmoeData } from "@/types";
import { AppError, isHttpStatus } from "@/utils/errors";
import { isChineseLocale } from "@/utils/locale";
import { USER_AGENT } from "../constants";
import type { SourceDisplayFields } from "../sourceCandidate";
import {
	createGameCandidate,
	createSourceCandidate,
	createSourceCandidateRecord,
	type SourceCandidate,
} from "../sourceCandidate";
import http, {
	type NetworkRequestContext,
	type TauriHttpOptions,
} from "./http";

const NEXTMOE_API_BASE_URL = "https://api.nextmoe.dev/v2";

const NEXTMOE_JSON_HEADERS = {
	Accept: "application/json",
	"User-Agent": USER_AGENT,
} as const;

const NEXTMOE_WORK_INCLUDE = "titles,refs,intros,covers,companies,ratings,tags";

interface NextmoeLocalizedTitle {
	value?: string;
}

interface NextmoeTitle {
	lang?: string;
	title?: string;
	title_kind?: string;
}

interface NextmoeIntro {
	lang?: string;
	value?: string;
}

interface NextmoeCompany {
	attribution_role?: string;
	display_name?: string;
}

interface NextmoeRating {
	score?: number | null;
	source?: string;
}

interface NextmoeTag {
	display_name?: string;
}

interface NextmoeCover {
	url?: string;
}

interface NextmoeWork {
	companies?: NextmoeCompany[];
	content_limit?: string;
	cover?: NextmoeCover | null;
	display_name?: string;
	id?: string;
	intros?: NextmoeIntro[];
	localized?: Record<string, NextmoeLocalizedTitle>;
	olang?: string;
	ratings?: NextmoeRating[];
	release_date?: string;
	tags?: NextmoeTag[];
	titles?: NextmoeTitle[];
}

interface NextmoeListResponse {
	items?: NextmoeWork[];
}

export type NextmoeWorkState =
	| "wish"
	| "doing"
	| "done"
	| "on_hold"
	| "dropped";

interface NextmoeWorkStateItem {
	state?: string;
	work_id?: string;
}

interface NextmoeWorkStateListResponse {
	items?: NextmoeWorkStateItem[];
	next_cursor?: string | null;
}

export interface NextmoeWorkStateEntry {
	state: string;
	workId: string;
}

export function chunkNextmoeItems<T>(items: readonly T[], size = 100): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

function buildNextmoeUserOptions(
	token: string,
	context: NetworkRequestContext = {},
	params: Record<string, unknown> = {},
): TauriHttpOptions {
	return {
		...context,
		headers: {
			...NEXTMOE_JSON_HEADERS,
			Authorization: `Bearer ${token}`,
		},
		params,
		rateLimit: { source: "nextmoe" },
	};
}

function buildNextmoeOptions(
	context: NetworkRequestContext = {},
	params: Record<string, unknown> = {},
	token?: string,
): TauriHttpOptions {
	return {
		...context,
		headers: {
			...NEXTMOE_JSON_HEADERS,
			// 带用户令牌走 100 次/分、10000 次/天（按用户），匿名只有 30 次/分、1000 次/天（按 IP）。
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		// 缺省闸会把 R18 作品静默并入 missing[]，因此统一在这里打开。
		params: { ...params, nsfw: "true" },
		rateLimit: { source: "nextmoe" },
	};
}

function normalizeText(value?: string | null) {
	const text = value?.trim();
	return text || undefined;
}

function normalizeDate(value?: string | null) {
	return normalizeText(value)?.split("T", 1)[0];
}

function pickTitle(work: NextmoeWork) {
	const original = work.olang ? work.localized?.[work.olang]?.value : undefined;
	return normalizeText(original) ?? normalizeText(work.display_name);
}

function pickAliases(work: NextmoeWork) {
	return (work.titles ?? []).flatMap((title) =>
		title.title_kind === "alias" && title.title ? [title.title] : [],
	);
}

function pickIntro(work: NextmoeWork) {
	const intros = work.intros ?? [];
	if (intros.length === 0) return undefined;

	const byLang = (lang: string) =>
		normalizeText(intros.find((intro) => intro.lang === lang)?.value);
	const chinese = byLang("zh-Hans") ?? byLang("zh-Hant");
	const japanese = byLang("ja");
	const preferred = isChineseLocale(i18next.language)
		? (chinese ?? japanese)
		: (japanese ?? chinese);

	return preferred ?? normalizeText(intros[0]?.value);
}

function pickDeveloper(work: NextmoeWork) {
	const developer = (work.companies ?? []).find(
		(company) => company.attribution_role === "developer",
	);
	return normalizeText(developer?.display_name);
}

function pickScore(work: NextmoeWork) {
	const rating = (work.ratings ?? []).find((item) => item.source === "nextmoe");
	return typeof rating?.score === "number" ? rating.score : null;
}

function toNextmoeData(work: NextmoeWork): NextmoeData {
	return {
		image: normalizeText(work.cover?.url),
		name: pickTitle(work),
		name_cn: normalizeText(work.localized?.["zh-Hans"]?.value),
		aliases: pickAliases(work),
		summary: pickIntro(work),
		tags: (work.tags ?? []).flatMap((tag) =>
			tag.display_name ? [tag.display_name] : [],
		),
		score: pickScore(work),
		developer: pickDeveloper(work),
		nsfw: work.content_limit === "nsfw",
		date: normalizeDate(work.release_date),
	};
}

function toNextmoeDraft(work: NextmoeWork): GameMetadataDraft {
	return createGameCandidate({
		idType: "nextmoe",
		source: createSourceCandidateRecord(
			"nextmoe",
			String(work.id),
			toNextmoeData(work),
		),
	});
}

export async function fetchNextmoeById(
	id: string,
	token?: string,
	context: NetworkRequestContext = {},
): Promise<GameMetadataDraft> {
	const response = await http.get<NextmoeWork>(
		`${NEXTMOE_API_BASE_URL}/catalog/works/${id}`,
		buildNextmoeOptions(context, { include: NEXTMOE_WORK_INCLUDE }, token),
	);
	const work = response.data;

	if (!work?.id) {
		throw new AppError({
			code: "metadata_not_found",
			message: `NextMoe work not found: ${id}`,
		});
	}

	return toNextmoeDraft(work);
}

export async function fetchNextmoeByName(
	name: string,
	token?: string,
	limit = 8,
	context: NetworkRequestContext = {},
): Promise<SourceCandidate<NextmoeData>[]> {
	const response = await http.get<NextmoeListResponse>(
		`${NEXTMOE_API_BASE_URL}/catalog/works`,
		buildNextmoeOptions(
			context,
			{
				q: name.trim(),
				limit,
				include: NEXTMOE_WORK_INCLUDE,
			},
			token,
		),
	);

	return (response.data?.items ?? [])
		.filter((work) => work.id)
		.map((work) => {
			const data = toNextmoeData(work);
			return createSourceCandidate({
				source: "nextmoe",
				externalId: String(work.id),
				data,
				display: {
					image: data.image,
					name: data.name,
					name_cn: data.name_cn,
					developer: data.developer,
					date: data.date,
				},
			});
		});
}

export async function fetchNextmoeWorkStates(
	token: string,
	workIds: readonly string[],
	context: NetworkRequestContext = {},
): Promise<NextmoeWorkStateEntry[]> {
	if (workIds.length === 0) return [];

	const response = await http.get<NextmoeWorkStateListResponse>(
		`${NEXTMOE_API_BASE_URL}/me/work-states`,
		buildNextmoeUserOptions(token, context, { work_ids: workIds.join(",") }),
	);

	return (response.data?.items ?? []).flatMap((item) =>
		item.work_id && item.state
			? [{ workId: item.work_id, state: item.state }]
			: [],
	);
}

export async function fetchNextmoeWorkState(
	token: string,
	workId: string,
	context: NetworkRequestContext = {},
): Promise<string | undefined> {
	try {
		const response = await http.get<NextmoeWorkStateItem>(
			`${NEXTMOE_API_BASE_URL}/me/work-states/${workId}`,
			buildNextmoeUserOptions(token, context),
		);
		return normalizeText(response.data?.state);
	} catch (error) {
		if (isHttpStatus(error, 404)) return undefined;
		throw error;
	}
}

export async function updateNextmoeWorkState(
	token: string,
	workId: string,
	state: NextmoeWorkState,
	context: NetworkRequestContext = {},
) {
	const response = await http.put<NextmoeWorkStateItem>(
		`${NEXTMOE_API_BASE_URL}/me/work-states/${workId}`,
		{ state },
		buildNextmoeUserOptions(token, context),
	);

	return Boolean(response.data);
}

export function getNextmoeDataDisplayFields(
	data: NextmoeData,
): SourceDisplayFields {
	return {
		image: data.image,
		name: data.name,
		name_cn: data.name_cn,
		summary: data.summary,
		tags: data.tags ?? [],
		score: data.score ?? undefined,
		developer: data.developer,
		aliases: data.aliases ?? [],
		nsfw: data.nsfw,
		date: data.date,
	};
}
