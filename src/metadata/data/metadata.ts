import i18n from "@/providers/i18n";
import {
	type CloudPlayStatusContext,
	resolveCloudPlayStatus,
} from "@/services/cloudPlayStatus";
import type {
	CustomData,
	GameCandidateData,
	GameData,
	InsertGameParams,
	SourceIdType,
	SourceType,
	UpdateGameParams,
} from "@/types";
import { isSourceType } from "@/types";
import { getArrayDiff, getBoolDiff, getDiff } from "@/utils/diff";
import { getGameDisplayName, getGameNsfwStatus } from "@/utils/game";
import {
	getRuntimeSourceAdapter,
	MIXED_SOURCE_KEYS,
	REGISTERED_SOURCE_KEYS,
} from "../sourceRegistry";
import { gameMetadataService } from "./gameMetadataService";

export interface GameInfoUpdateDraft {
	newLocalPath: string;
	newName: string;
	newImageExt?: string | null;
	newCoverSource?: SourceType | null;
	newAliases?: string[];
	newSummary?: string;
	newTags?: string[];
	newDeveloper?: string;
	newNsfw?: boolean;
	newDate?: string;
}

export interface BatchImportGameCandidate {
	name: string;
	path: string;
	selectedExe?: string;
	matchedData?: GameCandidateData;
}

interface SourceUpdateParams {
	selectedGame: GameData | null;
	idType: string;
	bgm_id?: string;
	vndb_id?: string;
	ymgal_id?: string;
	kun_id?: string;
	enabledSources?: readonly SourceType[];
	bgmToken?: string;
}

export interface MixedSourceResult {
	bgm_data?: GameCandidateData | null;
	vndb_data?: GameCandidateData | null;
	ymgal_data?: GameCandidateData | null;
	kun_data?: GameCandidateData | null;
}

export interface MixedSourceListResult {
	bgm_data?: GameCandidateData[];
	vndb_data?: GameCandidateData[];
	ymgal_data?: GameCandidateData[];
	kun_data?: GameCandidateData[];
}

interface MixedSourceMergeRule {
	source: SourceType;
	resultKey: keyof MixedSourceResult;
}

export type MixedSourceCandidates = Record<SourceType, GameCandidateData[]>;
export type MixedSourceSelection = Partial<
	Record<SourceType, GameCandidateData | null>
>;
export type MixedSourceEnabled = Partial<Record<SourceType, boolean>>;

const mixedSourceMergeRules: readonly MixedSourceMergeRule[] =
	MIXED_SOURCE_KEYS.map((source) => ({
		source,
		resultKey: getRuntimeSourceAdapter(source)
			.dataKey as keyof MixedSourceResult,
	}));

function assignGameField<Key extends keyof GameCandidateData>(
	target: GameCandidateData,
	source: GameCandidateData,
	key: Key,
): void {
	target[key] = source[key];
}

function mergeSourceIntoGame(
	target: GameCandidateData,
	source: GameCandidateData,
	sourceType: SourceType,
): void {
	const { idKey, dataKey } = getRuntimeSourceAdapter(sourceType);
	assignGameField(target, source, idKey);
	assignGameField(target, source, dataKey);
}

export function mergeMixedResult(
	result: MixedSourceResult,
): GameCandidateData | null {
	const mergedGame: GameCandidateData = {
		id_type: "mixed",
	};
	let hasMergedSource = false;

	for (const rule of mixedSourceMergeRules) {
		const sourceGame = result[rule.resultKey];
		if (!sourceGame) {
			continue;
		}
		hasMergedSource = true;
		mergeSourceIntoGame(mergedGame, sourceGame, rule.source);
	}

	if (!hasMergedSource) {
		return null;
	}

	return mergedGame;
}

export function pickFirstMixedResult(
	result: MixedSourceListResult,
): MixedSourceResult {
	return Object.fromEntries(
		mixedSourceMergeRules.map((rule) => [
			rule.resultKey,
			result[rule.resultKey]?.[0] ?? null,
		]),
	) as MixedSourceResult;
}

export function buildGameFromMixedSelection(params: {
	selection: MixedSourceSelection;
	enabled: MixedSourceEnabled;
	defaults?: Partial<GameCandidateData>;
}): GameCandidateData {
	const { selection, enabled, defaults } = params;
	const selectedEntries = mixedSourceMergeRules
		.map(({ source }) => ({
			source,
			game: enabled[source] ? selection[source] : null,
		}))
		.filter((entry): entry is { source: SourceType; game: GameCandidateData } =>
			Boolean(entry.game),
		);

	if (selectedEntries.length === 0) {
		throw new Error("At least one mixed source must be selected");
	}

	if (selectedEntries.length === 1) {
		const [{ source, game }] = selectedEntries;
		const result: GameCandidateData = {
			...defaults,
			id_type: source,
		};
		mergeSourceIntoGame(result, game, source);

		return result;
	}

	const mixedResult = mergeMixedResult(
		Object.fromEntries(
			mixedSourceMergeRules.map((rule) => [
				rule.resultKey,
				enabled[rule.source] ? selection[rule.source] : null,
			]),
		) as MixedSourceResult,
	);

	if (!mixedResult) {
		throw new Error("At least one mixed source must be selected");
	}

	return defaults ? { ...defaults, ...mixedResult } : mixedResult;
}

function getSourceUpdateId(
	params: Pick<
		SourceUpdateParams,
		"bgm_id" | "vndb_id" | "ymgal_id" | "kun_id"
	>,
	source: SourceType,
): string | undefined {
	const { idKey } = getRuntimeSourceAdapter(source);
	return params[idKey];
}

function clearMetadataSource(
	updateData: UpdateGameParams,
	source: SourceType,
): void {
	const { idKey, dataKey } = getRuntimeSourceAdapter(source);
	updateData[idKey] = null;
	updateData[dataKey] = null;
}

// ---------------------- 核心业务逻辑区 ----------------------

export async function fetchMetadataForUpdate({
	selectedGame,
	idType,
	bgm_id,
	vndb_id,
	ymgal_id,
	kun_id,
	enabledSources,
	bgmToken,
}: SourceUpdateParams): Promise<GameCandidateData> {
	if (!selectedGame) {
		throw new Error(
			i18n.t("pages.Detail.DataSourceUpdate.noGameSelected", "未选择游戏"),
		);
	}

	if (idType === "custom") {
		throw new Error(
			i18n.t(
				"pages.Detail.DataSourceUpdate.customModeWarning",
				"自定义模式无法从数据源更新。",
			),
		);
	}

	let apiData: GameCandidateData;

	if (idType === "mixed") {
		const enabled = new Set(enabledSources ?? MIXED_SOURCE_KEYS);
		apiData = await gameMetadataService.getGameByIds({
			bgm_id: enabled.has("bgm") ? bgm_id : undefined,
			vndb_id: enabled.has("vndb") ? vndb_id : undefined,
			ymgal_id: enabled.has("ymgal") ? ymgal_id : undefined,
			kun_id: enabled.has("kun") ? kun_id : undefined,
			bgmToken: enabled.has("bgm") ? bgmToken : undefined,
			enabledSources,
		});
	} else if (isSourceType(idType)) {
		const sourceId = getSourceUpdateId(
			{ bgm_id, vndb_id, ymgal_id, kun_id },
			idType,
		);
		if (!sourceId) {
			throw new Error(
				i18n.t("pages.Detail.DataSourceUpdate.invalidIdType", "无效的ID类型"),
			);
		}

		apiData = await gameMetadataService.getGameById(sourceId, idType, bgmToken);
	} else {
		throw new Error(
			i18n.t("pages.Detail.DataSourceUpdate.invalidIdType", "无效的ID类型"),
		);
	}

	if (!apiData) {
		throw new Error(
			i18n.t(
				"pages.Detail.DataSourceUpdate.noDataFetched",
				"未获取到数据或数据源无效。",
			),
		);
	}

	return apiData;
}

export async function buildInsertGameData(
	gameData: GameCandidateData,
	cloudStatusContext?: CloudPlayStatusContext,
): Promise<InsertGameParams> {
	const insertData: InsertGameParams = {
		bgm_id: gameData.bgm_id,
		vndb_id: gameData.vndb_id,
		ymgal_id: gameData.ymgal_id,
		kun_id: gameData.kun_id,
		id_type: gameData.id_type || "mixed",
		localpath: gameData.localpath ?? undefined,
		bgm_data: gameData.bgm_data ?? undefined,
		vndb_data: gameData.vndb_data ?? undefined,
		ymgal_data: gameData.ymgal_data ?? undefined,
		kun_data: gameData.kun_data ?? undefined,
		custom_data: gameData.custom_data ?? undefined,
	};
	const cloudStatus = await resolveCloudPlayStatus(
		insertData,
		cloudStatusContext,
	);

	if (cloudStatus === undefined) {
		return insertData;
	}

	return {
		...insertData,
		clear: cloudStatus,
	};
}

function getBatchImportLocalPath(item: BatchImportGameCandidate): string {
	return item.selectedExe ? `${item.path}\\${item.selectedExe}` : item.path;
}

export function buildMetadataUpdatePayload(
	gameData: GameCandidateData,
): UpdateGameParams {
	const updateData: UpdateGameParams = { ...gameData };

	if (gameData.id_type !== "mixed") {
		for (const source of REGISTERED_SOURCE_KEYS) {
			if (source !== gameData.id_type) {
				clearMetadataSource(updateData, source);
			}
		}
	} else {
		for (const source of REGISTERED_SOURCE_KEYS) {
			const { idKey } = getRuntimeSourceAdapter(source);
			if (!gameData[idKey]) {
				clearMetadataSource(updateData, source);
			}
		}
	}

	return updateData;
}

export function buildGameInfoUpdatePayload(
	originalGame: GameData,
	draft: GameInfoUpdateDraft,
): UpdateGameParams {
	const payload: UpdateGameParams = {};
	const localPathDiff = getDiff(draft.newLocalPath, originalGame.localpath);
	if (localPathDiff !== undefined) {
		payload.localpath = localPathDiff;
	}

	const currentCustomData = originalGame.custom_data || {};
	const displayName = getGameDisplayName(originalGame);
	const currentCustomName = currentCustomData.name || displayName;
	const originalSummary = originalGame.summary ?? "";
	const originalDeveloper = originalGame.developer ?? "";
	const originalNsfw = getGameNsfwStatus(originalGame) ?? false;
	const originalDate = originalGame.date ?? "";
	let nextCustomData: CustomData | undefined;
	const customData = () => (nextCustomData ??= { ...currentCustomData });

	const nameDiff = getDiff(draft.newName, currentCustomName);
	if (nameDiff !== undefined) {
		customData().name = nameDiff;
	}

	if (draft.newImageExt !== undefined) {
		customData().image = draft.newImageExt;
	}

	if (draft.newCoverSource !== undefined) {
		if (draft.newCoverSource !== (currentCustomData.cover_source ?? null)) {
			customData().cover_source = draft.newCoverSource;
		}
	}

	if (draft.newAliases !== undefined) {
		const aliasesDiff = getArrayDiff(
			draft.newAliases,
			currentCustomData.aliases,
		);
		if (aliasesDiff !== undefined) {
			customData().aliases = aliasesDiff;
		}
	}

	if (draft.newSummary !== undefined) {
		const summaryDiff = getDiff(draft.newSummary, originalSummary);
		if (summaryDiff !== undefined) {
			customData().summary = summaryDiff;
		}
	}

	if (draft.newTags !== undefined) {
		const tagsDiff = getArrayDiff(draft.newTags, currentCustomData.tags);
		if (tagsDiff !== undefined) {
			customData().tags = tagsDiff;
		}
	}

	if (draft.newDeveloper !== undefined) {
		const developerDiff = getDiff(draft.newDeveloper, originalDeveloper);
		if (developerDiff !== undefined) {
			customData().developer = developerDiff;
		}
	}

	if (draft.newNsfw !== undefined) {
		const nsfwDiff = getBoolDiff(draft.newNsfw, originalNsfw);
		if (nsfwDiff !== undefined) {
			customData().nsfw = nsfwDiff;
		}
	}

	if (draft.newDate !== undefined) {
		const dateDiff = getDiff(draft.newDate, originalDate);
		if (dateDiff !== undefined) {
			payload.date = dateDiff;
		}
	}

	if (nextCustomData) {
		payload.custom_data = nextCustomData;
	}

	return payload;
}

export async function buildBulkImportGameData(
	item: BatchImportGameCandidate,
	cloudStatusContext?: CloudPlayStatusContext,
): Promise<InsertGameParams> {
	if (item.matchedData) {
		const insertData = await buildInsertGameData(
			item.matchedData,
			cloudStatusContext,
		);
		return {
			...insertData,
			localpath: getBatchImportLocalPath(item),
		};
	}

	return {
		id_type: "custom",
		custom_data: {
			name: item.name,
		},
		localpath: getBatchImportLocalPath(item),
	};
}

export function getGameIdentityKeys(
	payload: Pick<InsertGameParams, SourceIdType>,
): string[] {
	return REGISTERED_SOURCE_KEYS.map((source) => {
		const { idKey } = getRuntimeSourceAdapter(source);
		const sourceId = payload[idKey];
		return sourceId ? `${source}:${sourceId}` : null;
	}).filter((value): value is string => Boolean(value));
}
