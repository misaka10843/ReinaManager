import type { GameCandidateData, KunData } from "@/types";
import { fetchGalgameById, searchGalgame } from "../api/kun";
import {
	DEFAULT_METADATA_SEARCH_LIMIT,
	type MetadataSourceAdapter,
} from "../sourceAdapter";
import {
	getSourceCandidateFromGame,
	mergeCandidateWithDetails,
	type SourceCandidate,
	type SourceDisplayFields,
} from "../sourceCandidate";

function toKunCandidate(game: GameCandidateData): SourceCandidate<KunData> {
	return getSourceCandidateFromGame<KunData>(
		game,
		kunAdapter,
		kunAdapter.toDisplayFields(game.kun_data as KunData),
	);
}

export const kunAdapter: MetadataSourceAdapter<KunData> = {
	key: "kun",
	label: "Kungal",
	idKey: "kun_id",
	dataKey: "kun_data",
	iconUrl: "https://www.kungal.com/favicon.ico",
	participatesInMixed: true,
	defaultMixedEnabled: false,
	validateId: (id) => /^\d+$/.test(id),
	getExternalUrl: (id) => `https://www.kungal.com/galgame/${id}`,
	async fetchById(id, ctx) {
		const game = await fetchGalgameById(id, {
			enrichVndb: ctx.enrichCrossSource ?? true,
			signal: ctx.signal,
		});
		return toKunCandidate(game);
	},
	async searchByName(name, ctx) {
		const games = await searchGalgame(
			name,
			1,
			ctx.limit ?? DEFAULT_METADATA_SEARCH_LIMIT,
			false,
			{ signal: ctx.signal },
		);
		return games.map(toKunCandidate);
	},
	async enrichOnSelect(candidate, ctx) {
		if (!candidate.externalId) {
			return candidate;
		}

		const game = await fetchGalgameById(candidate.externalId, {
			enrichVndb: ctx.enrichCrossSource ?? true,
			signal: ctx.signal,
		});
		return toKunCandidate(mergeCandidateWithDetails(candidate, game));
	},
	toDisplayFields: (data): SourceDisplayFields => ({
		image: data.image,
		name: data.name,
		name_cn: data.name_cn,
		summary: data.summary,
		tags: data.tags ?? [],
		developer: data.developer,
		all_titles: data.all_titles ?? [],
		aliases: data.aliases ?? [],
		nsfw: data.nsfw,
		date: data.date,
	}),
};
