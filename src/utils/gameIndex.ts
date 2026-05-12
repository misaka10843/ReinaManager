import type { FullGameData, GameData, SourceType } from "@/types";
import { SOURCE_FIELD_KEYS, SOURCE_KEYS } from "@/types";
import type { Category } from "@/types/collection";
import { getDisplayGameData } from "@/utils/dataTransform";

export type SourceAvailability = Record<SourceType, boolean>;

export interface GameIndex {
	rawList: FullGameData[];
	rawById: Map<number, FullGameData>;
	displayList: GameData[];
	displayById: Map<number, GameData>;
	ids: number[];
	sourceAvailabilityById: Map<number, SourceAvailability>;
	developerCategories: Category[];
	developerGameIdsByName: Map<string, number[]>;
	developerGameIdsByCategoryId: Map<number, number[]>;
}

export const EMPTY_SOURCE_AVAILABILITY: SourceAvailability = {
	bgm: false,
	vndb: false,
	ymgal: false,
	kun: false,
};

export const EMPTY_GAME_INDEX: GameIndex = {
	rawList: [],
	rawById: new Map(),
	displayList: [],
	displayById: new Map(),
	ids: [],
	sourceAvailabilityById: new Map(),
	developerCategories: [],
	developerGameIdsByName: new Map(),
	developerGameIdsByCategoryId: new Map(),
};

const gameIndexCache = new WeakMap<FullGameData[], GameIndex>();
export const UNKNOWN_DEVELOPER_KEY = "__unknown_developer__";

function buildSourceAvailability(game: FullGameData): SourceAvailability {
	const availability: SourceAvailability = { ...EMPTY_SOURCE_AVAILABILITY };

	for (const source of SOURCE_KEYS) {
		availability[source] = Boolean(game[SOURCE_FIELD_KEYS[source].data]);
	}

	return availability;
}

export function getDeveloperNames(
	developer: string | null | undefined,
	unknownDeveloper: string,
): string[] {
	const developerStr = developer || unknownDeveloper;
	const developers: string[] = [];
	for (const dev of developerStr.split("/")) {
		const trimmed = dev.trim();
		if (trimmed) {
			developers.push(trimmed);
		}
	}

	return developers.length > 0 ? developers : [unknownDeveloper];
}

function buildDeveloperIndex(
	games: GameData[],
	unknownDeveloper: string,
): Pick<
	GameIndex,
	| "developerCategories"
	| "developerGameIdsByName"
	| "developerGameIdsByCategoryId"
> {
	const developerGameIdsByName = new Map<string, number[]>();

	for (const game of games) {
		for (const developer of getDeveloperNames(
			game.developer,
			unknownDeveloper,
		)) {
			const ids = developerGameIdsByName.get(developer) ?? [];
			ids.push(game.id);
			developerGameIdsByName.set(developer, ids);
		}
	}

	const developerGameIdsByCategoryId = new Map<number, number[]>();
	const developerCategories = Array.from(developerGameIdsByName.entries())
		.toSorted((a, b) => b[1].length - a[1].length)
		.map(([name, gameIds], index) => {
			const id = -(index + 101);
			developerGameIdsByCategoryId.set(id, gameIds);
			return {
				id,
				name,
				sort_order: 0,
				game_count: gameIds.length,
			};
		});

	return {
		developerCategories,
		developerGameIdsByName,
		developerGameIdsByCategoryId,
	};
}

function buildGameIndex(fullGames: FullGameData[]): GameIndex {
	if (fullGames.length === 0) {
		return EMPTY_GAME_INDEX;
	}

	const rawById = new Map<number, FullGameData>();
	const displayList: GameData[] = [];
	const displayById = new Map<number, GameData>();
	const ids: number[] = [];
	const sourceAvailabilityById = new Map<number, SourceAvailability>();

	for (const fullGame of fullGames) {
		const displayGame = getDisplayGameData(fullGame);

		rawById.set(fullGame.id, fullGame);
		displayList.push(displayGame);
		displayById.set(displayGame.id, displayGame);
		ids.push(displayGame.id);
		sourceAvailabilityById.set(fullGame.id, buildSourceAvailability(fullGame));
	}
	const developerIndex = buildDeveloperIndex(
		displayList,
		UNKNOWN_DEVELOPER_KEY,
	);

	return {
		rawList: fullGames,
		rawById,
		displayList,
		displayById,
		ids,
		sourceAvailabilityById,
		developerCategories: developerIndex.developerCategories,
		developerGameIdsByName: developerIndex.developerGameIdsByName,
		developerGameIdsByCategoryId: developerIndex.developerGameIdsByCategoryId,
	};
}

export function getGameIndex(fullGames: FullGameData[] | undefined): GameIndex {
	if (!fullGames || fullGames.length === 0) {
		return EMPTY_GAME_INDEX;
	}

	const cached = gameIndexCache.get(fullGames);
	if (cached) {
		return cached;
	}

	const index = buildGameIndex(fullGames);
	gameIndexCache.set(fullGames, index);
	return index;
}
