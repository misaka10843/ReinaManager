import type { GameCandidateData, VndbData } from "@/types";
import { fetchVndbById, fetchVndbByName } from "../api/vndb";
import {
	DEFAULT_METADATA_SEARCH_LIMIT,
	type MetadataSourceAdapter,
} from "../sourceAdapter";
import {
	getSourceCandidateFromGame,
	type SourceCandidate,
	type SourceDisplayFields,
} from "../sourceCandidate";

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
			ctx.limit ?? DEFAULT_METADATA_SEARCH_LIMIT,
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
