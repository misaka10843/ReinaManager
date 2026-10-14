import {
	batchUpdateNextmoePlaytimes,
	batchUpdateNextmoeWorkStates,
	chunkNextmoeItems,
	type NextmoeBatchItemResult,
	type NextmoePlaytimeBatchItem,
	type NextmoeWorkStateBatchItem,
	updateNextmoeRating,
} from "@/metadata/api/nextmoe";
import { getAnySourceId } from "@/metadata/sourceRecord";
import { mapPlayStatusToNextmoeState } from "@/services/cloudPlayStatus/shared";
import {
	normalizeNextmoePlaytimeMinutes,
	normalizeNextmoeShortSummary,
	normalizeUserRating,
} from "@/services/cloudUserReview";
import { withNextmoeAuth } from "@/services/oauth/nextmoeAuthSession";
import { getNetworkRequestContext } from "@/services/requestContext";
import type { FullGameData, GameStatistics } from "@/types";
import type { PlayStatus } from "@/types/collection";
import { AppError, toError } from "@/utils/errors";

const NEXTMOE_BATCH_SIZE = 100;

export interface NextmoeBulkSyncFailure {
	message: string;
	workId: string;
}

export interface NextmoeBulkSyncResult {
	failures: NextmoeBulkSyncFailure[];
	playtimePushed: number;
	ratingPushed: number;
	statePushed: number;
}

export interface NextmoeBulkSyncInput {
	games: readonly FullGameData[];
	statistics: ReadonlyMap<number, GameStatistics>;
}

function collectBatchItemFailures(
	workIds: readonly string[],
	results: readonly NextmoeBatchItemResult[],
) {
	const failures: NextmoeBulkSyncFailure[] = [];
	for (let index = 0; index < results.length; index++) {
		const result = results[index];
		if (result.status === 200) continue;
		failures.push({
			workId: result.work_id ?? workIds[index] ?? "",
			message: result.message ?? result.code ?? "NextMoe 拒绝了这一条",
		});
	}
	return failures;
}

function countBatchItemSuccesses(results: readonly NextmoeBatchItemResult[]) {
	return results.filter((result) => result.status === 200).length;
}

export async function syncGamesToNextmoe({
	games,
	statistics,
}: NextmoeBulkSyncInput): Promise<NextmoeBulkSyncResult> {
	const stateItems: NextmoeWorkStateBatchItem[] = [];
	const playtimeItems: NextmoePlaytimeBatchItem[] = [];
	const ratingEntries: Array<{
		overall: number;
		shortSummary: string;
		workId: string;
	}> = [];

	for (const game of games) {
		const workId = getAnySourceId(game, "nextmoe");
		if (!workId) continue;

		if (game.clear != null) {
			stateItems.push({
				work_id: workId,
				state: mapPlayStatusToNextmoeState(game.clear as PlayStatus),
			});
		}

		const minutes = normalizeNextmoePlaytimeMinutes(
			statistics.get(game.id)?.total_time,
		);
		if (minutes > 0) {
			playtimeItems.push({ work_id: workId, minutes });
		}

		const overall = Math.round(
			normalizeUserRating(game.custom_data?.user_rating ?? 0),
		);
		if (overall > 0) {
			ratingEntries.push({
				workId,
				overall,
				shortSummary: normalizeNextmoeShortSummary(
					game.custom_data?.user_review ?? "",
				),
			});
		}
	}

	return withNextmoeAuth(async (token) => {
		if (!token) {
			throw new AppError({
				code: "nextmoe_auth_missing",
				message: "未配置 NextMoe 登录",
			});
		}

		const context = getNetworkRequestContext();
		const failures: NextmoeBulkSyncFailure[] = [];
		let statePushed = 0;
		let playtimePushed = 0;
		let ratingPushed = 0;

		for (const chunk of chunkNextmoeItems(stateItems, NEXTMOE_BATCH_SIZE)) {
			const results = await batchUpdateNextmoeWorkStates(token, chunk, context);
			statePushed += countBatchItemSuccesses(results);
			failures.push(
				...collectBatchItemFailures(
					chunk.map((item) => item.work_id),
					results,
				),
			);
		}

		for (const chunk of chunkNextmoeItems(playtimeItems, NEXTMOE_BATCH_SIZE)) {
			const results = await batchUpdateNextmoePlaytimes(token, chunk, context);
			playtimePushed += countBatchItemSuccesses(results);
			failures.push(
				...collectBatchItemFailures(
					chunk.map((item) => item.work_id),
					results,
				),
			);
		}

		for (const entry of ratingEntries) {
			try {
				await updateNextmoeRating(
					token,
					entry.workId,
					{
						overall: entry.overall,
						...(entry.shortSummary
							? { short_summary: entry.shortSummary }
							: {}),
					},
					context,
				);
				ratingPushed += 1;
			} catch (error) {
				failures.push({
					workId: entry.workId,
					message: toError(error).message,
				});
			}
		}

		return { statePushed, playtimePushed, ratingPushed, failures };
	});
}
