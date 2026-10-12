/**
 * @file 多数据源混合获取 API 封装
 * @description 同时从已启用的数据源获取游戏信息，返回各源原始数据
 * @module src/metadata/api/mixed
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 逻辑说明：
 * 1. 根据传入的参数获取：
 *    - 一个或多个数据源 ID：仅并行获取指定的数据源
 *    - 只有名称：同时搜索所有数据源
 * 2. 使用安全模式避免单个数据源失败导致整体失败
 * 3. 按 source 返回候选列表
 *
 * 主要导出：
 * - fetchMixedData：通用混合数据获取，返回按 source 分组的候选列表
 */

import type { GameMetadataDraft, SourceType } from "@/types";
import { isAbortError } from "@/utils/async";
import {
	AppError,
	isApiRateLimitError,
	isHttpStatus,
	toError,
} from "@/utils/errors";
import { isDeprecatedSource } from "../constants";
import {
	getCandidateSourceData,
	getSourceCandidateFromGame,
	type SourceCandidate,
} from "../sourceCandidate";
import type { RuntimeBoundSourceAdapter } from "../sourceRegistry";

interface SafeFetchResult {
	source: SourceType;
	data: SourceCandidate[];
	failed: boolean;
	error?: unknown;
}

export type MixedSourceCandidateResult = Partial<
	Record<SourceType, SourceCandidate[]>
>;

export interface MixedSourceFetchResult {
	candidates: MixedSourceCandidateResult;
	failedSources: SourceType[];
}

interface FetchMixedDataOptions {
	sourceIds?: Partial<Record<SourceType, string>>;
	name?: string;
	adapters: RuntimeBoundSourceAdapter[];
}

async function fetchAdapterSafely(
	adapter: RuntimeBoundSourceAdapter,
	task: () => Promise<SourceCandidate[]>,
): Promise<SafeFetchResult> {
	try {
		return {
			source: adapter.key,
			data: await task(),
			failed: false,
		};
	} catch (error) {
		if (isAbortError(error)) throw error;
		if (isApiRateLimitError(error)) throw error;
		if (adapter.key === "bgm" && isHttpStatus(error, 401)) throw error;
		return {
			source: adapter.key,
			data: [],
			failed: true,
			error,
		};
	}
}

function isMetadataNotFound(error: unknown) {
	return (
		isHttpStatus(error, 404) ||
		(error instanceof AppError && error.code === "metadata_not_found")
	);
}

function assertNotAllAttemptedSourcesFailed(
	results: SafeFetchResult[],
	message: string,
	cause?: Error,
) {
	if (results.length > 0 && results.every((result) => result.failed)) {
		if (results.every((result) => isMetadataNotFound(result.error))) {
			throw new AppError({
				code: "metadata_not_found",
				message: "No metadata found from attempted mixed sources",
				cause,
			});
		}
		throw new AppError({
			code: "mixed_sources_failed",
			message,
			cause,
		});
	}
}

function toSourceResult(results: SafeFetchResult[]): MixedSourceFetchResult {
	const mixedResult: MixedSourceCandidateResult = {};

	for (const result of results) {
		mixedResult[result.source] = result.data;
	}

	return {
		candidates: mixedResult,
		failedSources: results
			.filter((result) => result.failed)
			.map((result) => result.source),
	};
}

function getSourceCandidateFromDraft(
	adapter: RuntimeBoundSourceAdapter,
	draft: GameMetadataDraft,
): SourceCandidate {
	const data = getCandidateSourceData(draft, adapter.key);
	if (!data) {
		throw new Error(`Missing ${adapter.key} data in ${adapter.key} candidate`);
	}

	return getSourceCandidateFromGame(
		draft,
		adapter,
		adapter.toDisplayFields(data),
	);
}

function getProvidedSourceIds(
	options: FetchMixedDataOptions,
	adapters: RuntimeBoundSourceAdapter[],
) {
	return adapters
		.map((adapter) => ({
			adapter,
			id: options.sourceIds?.[adapter.key]?.trim(),
		}))
		.filter(
			(
				entry,
			): entry is {
				adapter: RuntimeBoundSourceAdapter;
				id: string;
			} => Boolean(entry.id),
		);
}

/**
 * 多数据源混合数据获取函数
 * - 一个或多个 ID：各源按指定 ID 独立获取，不扩展未填写的源
 * - 游戏名称：所有源都返回候选列表
 *
 * @param options 配置选项
 * @param options.sourceIds 按 source 传入的外部 ID（可选）
 * @param options.name 游戏名称（可选）
 * @returns 返回按 source 分组的候选列表
 */
export async function fetchMixedData(options: FetchMixedDataOptions) {
	const { name } = options;
	const adapters = options.adapters.filter(
		(adapter) => !isDeprecatedSource(adapter.key),
	);
	const providedSourceIds = getProvidedSourceIds(options, adapters);

	// ID 的数量不改变获取语义，只有用户明确填写的来源会进入请求。
	if (providedSourceIds.length > 0) {
		const results = await Promise.all(
			providedSourceIds.map(({ adapter, id }) =>
				fetchAdapterSafely(adapter, async () => [
					getSourceCandidateFromDraft(adapter, await adapter.fetchById(id)),
				]),
			),
		);
		assertNotAllAttemptedSourcesFailed(
			results,
			"All mixed source requests failed for multi-id lookup",
		);

		return toSourceResult(results);
	}

	// 名称搜索返回各源独立候选，由上层交给用户选择。
	if (name?.trim()) {
		const searchName = name.trim();
		const results = await Promise.all(
			adapters.map((adapter) => {
				return fetchAdapterSafely(adapter, () =>
					adapter.searchByName(searchName),
				);
			}),
		);

		assertNotAllAttemptedSourcesFailed(
			results,
			`All mixed source requests failed for search: ${searchName}`,
			toError(undefined, "Mixed search failed"),
		);

		return toSourceResult(results);
	}

	throw new AppError({
		code: "invalid_game_id",
		message: "Mixed fetch requires source ids or a name query",
	});
}
