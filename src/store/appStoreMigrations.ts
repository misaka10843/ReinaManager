import {
	DEFAULT_MIXED_SOURCE_KEYS,
	MIXED_SOURCE_KEYS,
	MIXED_SOURCE_MAX_COUNT,
	REGISTERED_SOURCE_KEYS,
} from "@/metadata/constants";
import type { SourceType } from "@/types";
import { DefaultGroup } from "@/types/collection";

export const APP_STORE_VERSION = 4;

type AppStorePersistedState = {
	mixedEnabledSources?: SourceType[];
	mixedEnableYmgal?: boolean;
	mixedEnableKun?: boolean;
	currentGroupId?: string | null;
	selectedCategory?: SelectedCategoryState;
	selectedCategoryId?: number | null;
	selectedCategoryName?: string | null;
	doubleClickLaunch?: boolean;
	longPressLaunch?: boolean;
	autoBackupMinIntervalHours?: number;
	exitBackupMinIntervalHours?: number;
};

type SelectedCategoryState =
	| { type: "real"; id: number }
	| { type: "developer"; key: string }
	| null;

function normalizeMixedEnabledSources(
	sources?: readonly SourceType[] | null,
): SourceType[] {
	if (!sources) return [...DEFAULT_MIXED_SOURCE_KEYS];

	const enabled = new Set(
		sources.filter((source) => REGISTERED_SOURCE_KEYS.includes(source)),
	);
	// 只规范化偏好，源的迁移待完成状态由请求入口处理。
	const filtered = REGISTERED_SOURCE_KEYS.filter((source) =>
		enabled.has(source),
	);
	return filtered.length >= DEFAULT_MIXED_SOURCE_KEYS.length
		? filtered
		: [...DEFAULT_MIXED_SOURCE_KEYS];
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
		migrateSelectedCategoryState(state);
	}

	if (version < 2) {
		migrateCardLaunchSettings(state);
	}

	if (version < 3) {
		migrateAutoBackupInterval(state);
	}

	if (version < 4) {
		migrateKunSourcePreferences(state);
	}

	return state;
}

function migrateKunSourcePreferences(state: AppStorePersistedState) {
	if (state.mixedEnabledSources) {
		const sources = state.mixedEnabledSources;
		const otherSources = new Set<SourceType>(
			sources.filter((source) => source !== "kun"),
		);
		const onlineCount = MIXED_SOURCE_KEYS.filter((source) =>
			otherSources.has(source),
		).length;
		const canInheritKun = onlineCount < MIXED_SOURCE_MAX_COUNT;
		// 已满四个其它源时不额外加入 Kun，保留原有的其它选择。
		// 只改请求偏好，不改写数据库中旧 Kun 的作品 ID 和元数据。
		state.mixedEnabledSources = [
			...new Set(sources.filter((source) => source !== "kun" || canInheritKun)),
		];
	}
}

function migrateMixedSourceFlagsToEnabledSources(
	state: AppStorePersistedState,
) {
	state.mixedEnabledSources = normalizeMixedEnabledSources([
		...DEFAULT_MIXED_SOURCE_KEYS,
		...(state.mixedEnableYmgal ? (["ymgal"] as const) : []),
		...(state.mixedEnableKun ? (["kun"] as const) : []),
	]);
	delete state.mixedEnableYmgal;
	delete state.mixedEnableKun;
}

function migrateSelectedCategoryState(state: AppStorePersistedState) {
	if (state.selectedCategory === undefined) {
		if (
			typeof state.selectedCategoryId === "number" &&
			state.selectedCategoryId > 0
		) {
			state.selectedCategory = {
				type: "real",
				id: state.selectedCategoryId,
			};
		} else if (
			state.currentGroupId === DefaultGroup.DEVELOPER &&
			typeof state.selectedCategoryName === "string" &&
			state.selectedCategoryName
		) {
			state.selectedCategory = {
				type: "developer",
				key: state.selectedCategoryName,
			};
		} else {
			state.selectedCategory = null;
		}
	}

	delete state.selectedCategoryId;
	delete state.selectedCategoryName;
}

function migrateCardLaunchSettings(state: AppStorePersistedState) {
	delete state.doubleClickLaunch;
	delete state.longPressLaunch;
}

function migrateAutoBackupInterval(state: AppStorePersistedState) {
	if (state.exitBackupMinIntervalHours === undefined) {
		const previousValue = state.autoBackupMinIntervalHours;
		state.exitBackupMinIntervalHours =
			typeof previousValue === "number" && Number.isFinite(previousValue)
				? Math.max(0, Math.floor(previousValue))
				: 6;
	}

	delete state.autoBackupMinIntervalHours;
}
