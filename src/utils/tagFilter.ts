function normalizeTagFilterValue(tag: string): string {
	return tag.trim().toLowerCase();
}

export function normalizeTagFilters(tags: readonly string[]): string[] {
	const seen = new Set<string>();
	const normalizedTags: string[] = [];

	for (const tag of tags) {
		const trimmed = tag.trim();
		const normalized = normalizeTagFilterValue(trimmed);
		if (!trimmed || seen.has(normalized)) continue;
		seen.add(normalized);
		normalizedTags.push(trimmed);
	}

	return normalizedTags;
}

export function buildNormalizedTagMap(
	tags: readonly string[],
): Map<string, string> {
	const tagMap = new Map<string, string>();

	for (const tag of tags) {
		tagMap.set(normalizeTagFilterValue(tag), tag);
	}

	return tagMap;
}

export function buildNormalizedTagSet(tags: readonly string[]): Set<string> {
	return new Set(tags.map(normalizeTagFilterValue).filter(Boolean));
}

export function hasMatchingTag(
	normalizedTags: ReadonlySet<string>,
	tag: string,
): boolean {
	return normalizedTags.has(normalizeTagFilterValue(tag));
}

export function matchesAllTagFilters(
	tags: readonly string[],
	filters: readonly string[],
): boolean {
	if (filters.length === 0) return true;
	if (tags.length === 0) return false;

	const normalizedTags = buildNormalizedTagSet(tags);
	return filters.every((filter) => hasMatchingTag(normalizedTags, filter));
}

export function findTagByInput(
	tagMap: ReadonlyMap<string, string>,
	input: string,
): string | undefined {
	return tagMap.get(normalizeTagFilterValue(input));
}

export function filterTagSuggestions(
	tags: readonly string[],
	selectedTags: readonly string[],
	input: string,
	limit: number,
): string[] {
	const normalizedInput = normalizeTagFilterValue(input);
	if (!normalizedInput) return [];

	const selectedTagSet = buildNormalizedTagSet(selectedTags);

	return tags
		.filter((tag) => {
			const normalizedTag = normalizeTagFilterValue(tag);
			if (selectedTagSet.has(normalizedTag)) return false;
			return normalizedTag.includes(normalizedInput);
		})
		.slice(0, limit);
}
