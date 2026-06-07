import { fetchBgmById, fetchBgmByName } from "@/api/bgm";
import type { BgmData, GameCandidateData } from "@/types";
import { AppError } from "@/utils/errors";
import type {
	MetadataSourceAdapter,
	MetadataSourceContext,
} from "../sourceAdapter";
import {
	getSourceCandidateFromGame,
	type SourceCandidate,
	type SourceDisplayFields,
} from "../sourceCandidate";

const BGM_MIXED_SEARCH_LIMIT = 25;

function ensureBgmToken(ctx: MetadataSourceContext): string {
	if (!ctx.bgmToken) {
		throw new AppError({
			code: "bgm_token_required",
			message: "Bangumi token is required for Bangumi lookup",
		});
	}

	return ctx.bgmToken;
}

function toBgmCandidate(game: GameCandidateData): SourceCandidate<BgmData> {
	return getSourceCandidateFromGame<BgmData>(
		game,
		bgmAdapter,
		bgmAdapter.toDisplayFields(game.bgm_data as BgmData),
	);
}

export const bgmAdapter: MetadataSourceAdapter<BgmData> = {
	key: "bgm",
	label: "Bangumi",
	idKey: "bgm_id",
	dataKey: "bgm_data",
	participatesInMixed: true,
	defaultMixedEnabled: true,
	mixedSearchLimit: BGM_MIXED_SEARCH_LIMIT,
	requiresBgmToken: true,
	validateId: (id) => /^\d+$/.test(id),
	async fetchById(id, ctx) {
		const game = await fetchBgmById(id, ensureBgmToken(ctx), ctx.signal);
		return toBgmCandidate(game);
	},
	async searchByName(name, ctx) {
		const games = await fetchBgmByName(
			name,
			ensureBgmToken(ctx),
			ctx.limit ?? BGM_MIXED_SEARCH_LIMIT,
			ctx.signal,
		);
		return games.map(toBgmCandidate);
	},
	toDisplayFields: (data): SourceDisplayFields => ({
		image: data.image,
		name: data.name,
		name_cn: data.name_cn,
		summary: data.summary,
		tags: data.tags ?? [],
		rank: data.rank,
		score: data.score,
		developer: data.developer,
		aliases: data.aliases ?? [],
		nsfw: data.nsfw,
		date: data.date,
	}),
};
