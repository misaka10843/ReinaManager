import type {
	GameCandidateData,
	SourceDataKey,
	SourceIdType,
	SourceType,
} from "@/types";

export interface SourceDisplayFields {
	image?: string;
	name?: string;
	name_cn?: string;
	summary?: string;
	tags?: string[];
	rank?: number;
	score?: number;
	developer?: string;
	all_titles?: string[];
	aliases?: string[];
	average_hours?: number;
	nsfw?: boolean;
	date?: string;
}

export interface SourceCandidate<TData = unknown> {
	source: SourceType;
	idKey: SourceIdType;
	dataKey: SourceDataKey;
	externalId?: string;
	data: TData;
	display: SourceDisplayFields;
	raw: GameCandidateData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mergeDefinedValues<T extends Record<string, unknown>>(
	base: T,
	next: T,
): T {
	const merged = { ...base };
	for (const [key, value] of Object.entries(next)) {
		if (value !== undefined) {
			merged[key as keyof T] = value as T[keyof T];
		}
	}
	return merged;
}

export function mergeCandidateWithDetails(
	candidate: SourceCandidate,
	details: GameCandidateData,
): GameCandidateData {
	const merged = mergeDefinedValues(
		candidate.raw as Record<string, unknown>,
		details as Record<string, unknown>,
	) as GameCandidateData;
	const baseSourceData = candidate.raw[candidate.dataKey];
	const detailSourceData = details[candidate.dataKey];

	if (isRecord(baseSourceData) && isRecord(detailSourceData)) {
		(merged as Record<string, unknown>)[candidate.dataKey] = mergeDefinedValues(
			baseSourceData,
			detailSourceData,
		);
	}

	merged.localpath = candidate.raw.localpath ?? details.localpath;
	return merged;
}

export function getSourceCandidateFromGame<TData>(
	game: GameCandidateData,
	source: {
		key: SourceType;
		idKey: SourceIdType;
		dataKey: SourceDataKey;
	},
	display: SourceDisplayFields,
): SourceCandidate<TData> {
	const data = game[source.dataKey];

	if (!data) {
		throw new Error(`Missing ${source.dataKey} in ${source.key} candidate`);
	}

	return {
		source: source.key,
		idKey: source.idKey,
		dataKey: source.dataKey,
		externalId: game[source.idKey],
		data: data as TData,
		display,
		raw: game,
	};
}

export function sourceCandidateToGameCandidate(
	candidate: SourceCandidate,
): GameCandidateData {
	return {
		id_type: candidate.source,
		[candidate.idKey]: candidate.externalId,
		[candidate.dataKey]: candidate.data,
	};
}
