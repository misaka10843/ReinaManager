export type { GameSearchParams } from "./data/gameMetadataService";
export { gameMetadataService } from "./data/gameMetadataService";
export type {
	MetadataSourceAdapter,
	MetadataSourceContext,
	SourceIdMap,
} from "./sourceAdapter";
export type { AutoResolveSourceCandidateParams } from "./sourceAutoResolve";
export { resolveAutoSelectedSourceCandidate } from "./sourceAutoResolve";
export type {
	SourceCandidate,
	SourceDisplayFields,
} from "./sourceCandidate";
export {
	getSourceCandidateFromGame,
	sourceCandidateToGameCandidate,
} from "./sourceCandidate";
export type { RuntimeSourceAdapter } from "./sourceRegistry";
export {
	DEFAULT_MIXED_SOURCE_KEYS,
	getEnabledMixedAdapters,
	getRuntimeSourceAdapter,
	getSourceAdapter,
	MIXED_SOURCE_KEYS,
	REGISTERED_SOURCE_KEYS,
	SEARCHABLE_SOURCE_KEYS,
	SOURCE_ADAPTERS,
} from "./sourceRegistry";
