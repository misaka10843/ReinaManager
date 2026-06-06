import type { FullGameData, SourceDataKey, SourceType } from "@/types";
import { SOURCE_FIELD_KEYS, SOURCE_KEYS } from "@/types";

const SOURCE_COVER_KEYS = ["bgm", "vndb", "kun", "ymgal"] as const;

type SourceImageData = Partial<
	Record<SourceType, { image?: string | null } | null | undefined>
>;

export interface SourceImageOption {
	source: SourceType;
	image: string;
}

type SourceImagePayload = Pick<FullGameData, SourceDataKey>;

export function getSourceImageMap(game: SourceImagePayload): SourceImageData {
	return Object.fromEntries(
		SOURCE_KEYS.map((source) => [source, game[SOURCE_FIELD_KEYS[source].data]]),
	) as SourceImageData;
}

export function resolveSourceImage(
	sources: SourceImageData,
	coverSource?: SourceType | null,
): string | undefined {
	if (coverSource) {
		const selectedImage = sources[coverSource]?.image;
		if (selectedImage) return selectedImage;
	}

	for (const source of SOURCE_COVER_KEYS) {
		const image = sources[source]?.image;
		if (image) return image;
	}

	return undefined;
}

export function getSourceImageOptions(game: FullGameData): SourceImageOption[] {
	const sources = getSourceImageMap(game);

	return SOURCE_COVER_KEYS.map((source) => ({
		source,
		image: sources[source]?.image,
	})).filter((option): option is SourceImageOption => Boolean(option.image));
}
