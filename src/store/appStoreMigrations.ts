import { SOURCE_KEYS, type SourceType } from "@/types";

export const APP_STORE_VERSION = 1;
export const DEFAULT_MIXED_ENABLED_SOURCES: readonly SourceType[] = [
	"bgm",
	"vndb",
];

type AppStorePersistedState = {
	mixedEnabledSources?: SourceType[];
	mixedEnableYmgal?: boolean;
	mixedEnableKun?: boolean;
};

function normalizeMixedEnabledSources(
	sources?: readonly SourceType[] | null,
): SourceType[] {
	if (!sources) return [...DEFAULT_MIXED_ENABLED_SOURCES];

	const enabled = new Set(
		sources.filter((source) => SOURCE_KEYS.includes(source)),
	);
	const filtered = SOURCE_KEYS.filter((source) => enabled.has(source));
	return filtered.length >= DEFAULT_MIXED_ENABLED_SOURCES.length
		? filtered
		: [...DEFAULT_MIXED_ENABLED_SOURCES];
}

export function migrateAppStorePersistedState(
	persistedState: unknown,
	version: number,
) {
	if (!persistedState || typeof persistedState !== "object") {
		return persistedState;
	}

	const state = persistedState as AppStorePersistedState;
	if (version < 1) {
		migrateMixedSourceFlagsToEnabledSources(state);
	}

	return state;
}

function migrateMixedSourceFlagsToEnabledSources(
	state: AppStorePersistedState,
) {
	state.mixedEnabledSources = normalizeMixedEnabledSources([
		...DEFAULT_MIXED_ENABLED_SOURCES,
		...(state.mixedEnableYmgal ? (["ymgal"] as const) : []),
		...(state.mixedEnableKun ? (["kun"] as const) : []),
	]);
	delete state.mixedEnableYmgal;
	delete state.mixedEnableKun;
}
