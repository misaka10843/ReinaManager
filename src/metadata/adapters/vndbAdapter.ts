import type { GameCandidateData, VndbData } from "@/types";
import { fetchVndbById, fetchVndbByName } from "../api/vndb";
import type { MetadataSourceAdapter } from "../sourceAdapter";
import {
	getSourceCandidateFromGame,
	type SourceCandidate,
	type SourceDisplayFields,
} from "../sourceCandidate";

const VNDB_MIXED_SEARCH_LIMIT = 25;

function toVndbCandidate(game: GameCandidateData): SourceCandidate<VndbData> {
	return getSourceCandidateFromGame<VndbData>(
		game,
		vndbAdapter,
		vndbAdapter.toDisplayFields(game.vndb_data as VndbData),
	);
}

export const vndbAdapter: MetadataSourceAdapter<VndbData> = {
	key: "vndb",
	label: "VNDB",
	idKey: "vndb_id",
	dataKey: "vndb_data",
	iconUrl: "https://vndb.org/favicon.ico",
	participatesInMixed: true,
	defaultMixedEnabled: true,
	mixedSearchLimit: VNDB_MIXED_SEARCH_LIMIT,
	validateId: (id) => /^v\d+$/i.test(id),
	getExternalUrl: (id) => `https://vndb.org/${id}`,
	async fetchById(id, ctx) {
		const game = await fetchVndbById(id, ctx.signal);
		return toVndbCandidate(game);
	},
	async searchByName(name, ctx) {
		const games = await fetchVndbByName(
			name,
			undefined,
			ctx.limit ?? VNDB_MIXED_SEARCH_LIMIT,
			ctx.signal,
		);
		return games.map(toVndbCandidate);
	},
	toDisplayFields: (data): SourceDisplayFields => ({
		image: data.image,
		name: data.name,
		name_cn: data.name_cn,
		summary: data.summary,
		tags: data.tags ?? [],
		score: data.score ?? undefined,
		developer: data.developer,
		all_titles: data.all_titles ?? [],
		aliases: data.aliases ?? [],
		average_hours: data.average_hours ?? undefined,
		nsfw: data.nsfw,
		date: data.date,
	}),
};
