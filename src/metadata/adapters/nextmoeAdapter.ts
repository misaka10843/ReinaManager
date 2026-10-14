import type { NextmoeData } from "@/types";
import {
	fetchNextmoeById,
	fetchNextmoeByName,
	getNextmoeDataDisplayFields,
} from "../api/nextmoe";
import {
	DEFAULT_METADATA_SEARCH_LIMIT,
	type MetadataSourceAdapter,
} from "../sourceAdapter";

export const nextmoeAdapter: MetadataSourceAdapter<NextmoeData> = {
	key: "nextmoe",
	label: "NextMoe",
	iconUrl: "https://www.kungal.com/favicon.ico",
	validateId: (id) => /^\d+$/.test(id),
	getExternalUrl: (id) => `https://www.kungal.com/galgame/${id}`,
	async fetchById(id, ctx) {
		return fetchNextmoeById(id, ctx.nextmoeToken, ctx);
	},
	async searchByName(name, ctx) {
		return fetchNextmoeByName(
			name,
			ctx.nextmoeToken,
			ctx.limit ?? DEFAULT_METADATA_SEARCH_LIMIT,
			ctx,
		);
	},
	toDisplayFields: getNextmoeDataDisplayFields,
};
