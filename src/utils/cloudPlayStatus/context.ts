import {
	type BgmUserCollection,
	fetchUserCollection,
	fetchUserGameCollectionsPage,
} from "@/api/bgm";
import {
	fetchVndbCurrentUserProfile,
	fetchVndbUserCollection,
	fetchVndbUserCollectionsPage,
	type VndbUserCollectionItem,
} from "@/api/vndb";
import { useStore } from "@/store/appStore";
import type { PlayStatus } from "@/types/collection";
import { withBgmAuth } from "@/utils/bgmAuthSession";
import {
	type CloudPlayStatusContext,
	getBgmUsername,
	getVndbToken,
	mapBgmTypeToPlayStatus,
	mapVndbCollectionToPlayStatus,
} from "./shared";

export interface CloudPlayStatusContextInput {
	bgmIds?: Iterable<string>;
	vndbIds?: Iterable<string>;
}

const DIRECT_COLLECTION_LOOKUP_THRESHOLD = 10;
const BGM_COLLECTION_PAGE_SIZE = 50;
const VNDB_COLLECTION_PAGE_SIZE = 100;

interface BgmCollectionPage {
	offset: number;
	limit: number;
	total: number;
	data: BgmUserCollection[];
}

interface VndbCollectionPage {
	results: VndbUserCollectionItem[];
	more: boolean;
	count?: number;
}

async function fetchBgmCollectionPage(
	username: string,
	token: string,
	params: { limit: number; offset: number },
): Promise<BgmCollectionPage> {
	const page = await fetchUserGameCollectionsPage(username, token, params);
	return {
		offset: page.offset ?? params.offset,
		limit: page.limit ?? params.limit,
		total: page.total ?? 0,
		data: Array.isArray(page.data) ? page.data : [],
	};
}

async function fetchVndbCollectionPage(
	token: string,
	params: { userId: string; page: number; count?: boolean },
): Promise<VndbCollectionPage> {
	const page = await fetchVndbUserCollectionsPage(token, params);
	return {
		results: Array.isArray(page.results) ? page.results : [],
		more: Boolean(page.more),
		count: page.count,
	};
}

function appendBgmCollectionsToStatusMap(
	statusMap: Map<string, PlayStatus>,
	collections: BgmUserCollection[],
) {
	for (const collection of collections) {
		const status = mapBgmTypeToPlayStatus(collection.type);
		if (status !== undefined) {
			statusMap.set(String(collection.subject_id), status);
		}
	}
}

function appendVndbCollectionsToStatusMap(
	statusMap: Map<string, PlayStatus>,
	collections: VndbUserCollectionItem[],
) {
	for (const collection of collections) {
		const status = mapVndbCollectionToPlayStatus(collection);
		if (status !== undefined) {
			statusMap.set(collection.id, status);
		}
	}
}

async function createBgmDirectPlayStatusMap(
	username: string,
	token: string,
	ids: string[],
) {
	const statusMap = new Map<string, PlayStatus>();
	for (const id of ids) {
		const collection = await fetchUserCollection(username, id, token);
		const status = mapBgmTypeToPlayStatus(collection?.type);
		if (status !== undefined) {
			statusMap.set(id, status);
		}
	}
	return statusMap;
}

async function createBgmFullPlayStatusMap(
	username: string,
	token: string,
	firstPage?: BgmCollectionPage,
) {
	const statusMap = new Map<string, PlayStatus>();
	let page =
		firstPage ??
		(await fetchBgmCollectionPage(username, token, {
			limit: BGM_COLLECTION_PAGE_SIZE,
			offset: 0,
		}));
	appendBgmCollectionsToStatusMap(statusMap, page.data);

	while (true) {
		const nextOffset = page.offset + page.limit;
		if (page.data.length === 0 || nextOffset >= page.total) {
			break;
		}
		page = await fetchBgmCollectionPage(username, token, {
			limit: BGM_COLLECTION_PAGE_SIZE,
			offset: nextOffset,
		});
		appendBgmCollectionsToStatusMap(statusMap, page.data);
	}

	return statusMap;
}

async function createBgmPlayStatusMap(ids: Iterable<string>) {
	try {
		const uniqueIds = [...new Set(ids)].filter(Boolean);
		if (uniqueIds.length === 0) {
			return new Map<string, PlayStatus>();
		}

		return await withBgmAuth(async (token) => {
			if (!token) return undefined;

			const username = await getBgmUsername(token);
			if (uniqueIds.length <= DIRECT_COLLECTION_LOOKUP_THRESHOLD) {
				return createBgmDirectPlayStatusMap(username, token, uniqueIds);
			}

			const firstPage = await fetchBgmCollectionPage(username, token, {
				limit: BGM_COLLECTION_PAGE_SIZE,
				offset: 0,
			});
			const fullFetchRequests = Math.ceil(
				firstPage.total / BGM_COLLECTION_PAGE_SIZE,
			);

			if (uniqueIds.length < fullFetchRequests) {
				return createBgmDirectPlayStatusMap(username, token, uniqueIds);
			}

			return createBgmFullPlayStatusMap(username, token, firstPage);
		});
	} catch (error) {
		console.error("获取 BGM 收藏列表失败:", error);
		return undefined;
	}
}

async function createVndbDirectPlayStatusMap(
	token: string,
	userId: string,
	ids: string[],
) {
	const statusMap = new Map<string, PlayStatus>();
	for (const id of ids) {
		const collection = await fetchVndbUserCollection(id, token, userId);
		const status = mapVndbCollectionToPlayStatus(collection);
		if (status !== undefined) {
			statusMap.set(id, status);
		}
	}
	return statusMap;
}

async function createVndbFullPlayStatusMap(
	token: string,
	userId: string,
	firstPage?: VndbCollectionPage,
) {
	const statusMap = new Map<string, PlayStatus>();
	let page =
		firstPage ??
		(await fetchVndbCollectionPage(token, {
			userId,
			page: 1,
		}));
	appendVndbCollectionsToStatusMap(statusMap, page.results);

	let pageNumber = 2;
	while (page.more && page.results.length > 0) {
		page = await fetchVndbCollectionPage(token, {
			userId,
			page: pageNumber,
		});
		appendVndbCollectionsToStatusMap(statusMap, page.results);
		pageNumber += 1;
	}

	return statusMap;
}

async function createVndbPlayStatusMap(ids: Iterable<string>) {
	try {
		const uniqueIds = [...new Set(ids)].filter(Boolean);
		if (uniqueIds.length === 0) {
			return new Map<string, PlayStatus>();
		}

		const token = await getVndbToken();
		if (!token) return undefined;

		const profile = await fetchVndbCurrentUserProfile(token);
		const userId = profile?.id;
		if (!userId || !profile.permissions.includes("listread")) {
			return undefined;
		}

		if (uniqueIds.length <= DIRECT_COLLECTION_LOOKUP_THRESHOLD) {
			return createVndbDirectPlayStatusMap(token, userId, uniqueIds);
		}

		const firstPage = await fetchVndbCollectionPage(token, {
			userId,
			page: 1,
			count: true,
		});
		const total = firstPage.count ?? 0;
		const fullFetchRequests = Math.ceil(total / VNDB_COLLECTION_PAGE_SIZE);

		if (uniqueIds.length < fullFetchRequests) {
			return createVndbDirectPlayStatusMap(token, userId, uniqueIds);
		}

		return createVndbFullPlayStatusMap(token, userId, firstPage);
	} catch (error) {
		console.error("获取 VNDB 收藏列表失败:", error);
		return undefined;
	}
}

export async function createCloudPlayStatusContext(
	input: CloudPlayStatusContextInput = {},
): Promise<CloudPlayStatusContext> {
	const { syncBgmCollection, syncVndbCollection } = useStore.getState();
	const [bgm, vndb] = await Promise.all([
		syncBgmCollection
			? createBgmPlayStatusMap(input.bgmIds ?? [])
			: Promise.resolve(undefined),
		syncVndbCollection
			? createVndbPlayStatusMap(input.vndbIds ?? [])
			: Promise.resolve(undefined),
	]);

	return {
		...(bgm ? { bgm } : {}),
		...(vndb ? { vndb } : {}),
	};
}
