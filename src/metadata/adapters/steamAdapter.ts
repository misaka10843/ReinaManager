import type { GameMetadataDraft, SteamData } from "@/types";
import { fetchSteamById, fetchSteamByName } from "../api/steam";
import type { MetadataSourceAdapter } from "../sourceAdapter";
import {
	createSourceCandidate,
	getCandidateSourceData,
	getCandidateSourceId,
	mergeCandidateDetailData,
	normalizeGameCandidateSources,
	type SourceCandidate,
	type SourceDisplayFields,
	sourceCandidateToDraft,
} from "../sourceCandidate";

function toSteamCandidate(game: GameMetadataDraft): SourceCandidate<SteamData> {
	const data = getCandidateSourceData<SteamData>(game, "steam");
	if (!data) {
		throw new Error("Missing steam data in steam candidate");
	}

	return createSourceCandidate({
		source: "steam",
		externalId: getCandidateSourceId(game, "steam"),
		data,
		display: steamAdapter.toDisplayFields(data),
	});
}

function parseAppId(id: string): number {
	const appid = Number(id.trim());
	if (!Number.isSafeInteger(appid) || appid <= 0) {
		throw new Error(`无效的 Steam appid: ${id}`);
	}
	return appid;
}

export const steamAdapter: MetadataSourceAdapter<SteamData> = {
	key: "steam",
	label: "Steam",
	iconUrl: "https://store.steampowered.com/favicon.ico",
	validateId: (id) => /^\d+$/.test(id.trim()),
	getExternalUrl: (id) => `https://store.steampowered.com/app/${id.trim()}/`,
	async fetchById(id, ctx) {
		const game = await fetchSteamById(parseAppId(id), ctx);
		return normalizeGameCandidateSources(game, "steam");
	},
	async searchByName(name, ctx) {
		const games = await fetchSteamByName(name, ctx);
		return games.map(toSteamCandidate);
	},
	async enrichOnSelect(candidate, ctx) {
		if (!candidate.externalId) {
			return sourceCandidateToDraft(candidate);
		}

		const game = await fetchSteamById(parseAppId(candidate.externalId), ctx);
		return mergeCandidateDetailData(candidate, game);
	},
	toDisplayFields: (data): SourceDisplayFields => ({
		image: data.image,
		name: data.name,
		summary: data.summary,
		tags: data.tags ?? [],
		developer: data.developer,
		date: data.date,
		aliases: data.aliases,
	}),
};
