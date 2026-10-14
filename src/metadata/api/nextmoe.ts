import i18next from "i18next";
import type { GameMetadataDraft, NextmoeData } from "@/types";
import { AppError } from "@/utils/errors";
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

function buildNextmoeOptions(
	context: NetworkRequestContext = {},
	params: Record<string, unknown> = {},
): TauriHttpOptions {
	return {
		...context,
		headers: { ...NEXTMOE_JSON_HEADERS },
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
	context: NetworkRequestContext = {},
): Promise<GameMetadataDraft> {
	const response = await http.get<NextmoeWork>(
		`${NEXTMOE_API_BASE_URL}/catalog/works/${id}`,
		buildNextmoeOptions(context, { include: NEXTMOE_WORK_INCLUDE }),
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
	limit = 8,
	context: NetworkRequestContext = {},
): Promise<SourceCandidate<NextmoeData>[]> {
	const response = await http.get<NextmoeListResponse>(
		`${NEXTMOE_API_BASE_URL}/catalog/works`,
		buildNextmoeOptions(context, {
			q: name.trim(),
			limit,
			include: NEXTMOE_WORK_INCLUDE,
		}),
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
