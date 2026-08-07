import type { GameMetadataDraft, SourceType } from "@/types";
import type { NetworkRequestContext } from "./api/http";
import type { SourceCandidate, SourceDisplayFields } from "./sourceCandidate";

export type SourceIdMap = Partial<Record<SourceType, string>>;

export const DEFAULT_METADATA_SEARCH_LIMIT = 8;

export interface MetadataRequestContext extends NetworkRequestContext {
	spoilerLevel: number;
	bgmToken?: string;
	/** Steam Web API Key：存在时允许在线 appdetails 补全元数据 */
	steamApiKey?: string;
	hikarinagiToken?: string;
}

export interface MetadataSourceContext extends MetadataRequestContext {
	enrichCrossSource?: boolean;
	limit?: number;
}

export type MetadataSourceOptions = Pick<
	MetadataSourceContext,
	"enrichCrossSource" | "limit"
>;

export interface MetadataSourceAdapter<TData = unknown> {
	key: SourceType;
	label: string;
	iconUrl: string;
	validateId: (id: string) => boolean;
	getExternalUrl(id: string): string;
	fetchById(id: string, ctx: MetadataSourceContext): Promise<GameMetadataDraft>;
	searchByName(
		name: string,
		ctx: MetadataSourceContext,
	): Promise<SourceCandidate<TData>[]>;
	enrichOnSelect?(
		candidate: SourceCandidate<TData>,
		ctx: MetadataSourceContext,
	): Promise<GameMetadataDraft>;
	toDisplayFields(data: TData): SourceDisplayFields;
}

export type BoundMetadataSourceAdapter<TData = unknown> = Omit<
	MetadataSourceAdapter<TData>,
	"fetchById" | "searchByName" | "enrichOnSelect"
> & {
	fetchById(
		id: string,
		options?: MetadataSourceOptions,
	): Promise<GameMetadataDraft>;
	searchByName(
		name: string,
		options?: MetadataSourceOptions,
	): Promise<SourceCandidate<TData>[]>;
	enrichOnSelect?(
		candidate: SourceCandidate<TData>,
		options?: MetadataSourceOptions,
	): Promise<GameMetadataDraft>;
};

export function bindMetadataSourceAdapter<TData>(
	adapter: MetadataSourceAdapter<TData>,
	context: MetadataRequestContext,
): BoundMetadataSourceAdapter<TData> {
	const { fetchById, searchByName, enrichOnSelect, ...definition } = adapter;

	return {
		...definition,
		fetchById: (id, options = {}) =>
			fetchById.call(adapter, id, { ...context, ...options }),
		searchByName: (name, options = {}) =>
			searchByName.call(adapter, name, { ...context, ...options }),
		...(enrichOnSelect
			? {
					enrichOnSelect: (
						candidate: SourceCandidate<TData>,
						options: MetadataSourceOptions = {},
					) =>
						enrichOnSelect.call(adapter, candidate, {
							...context,
							...options,
						}),
				}
			: {}),
	};
}
