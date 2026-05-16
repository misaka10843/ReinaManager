export function getDiff(
	current: string,
	original: string | undefined,
): string | null | undefined {
	const normOriginal = original ?? "";
	const normCurrent = current.trim();

	if (normOriginal === normCurrent) return undefined;
	if (normCurrent === "") return null;
	return normCurrent;
}

export function getArrayDiff<T>(
	current: T[],
	original: T[] | null | undefined,
): T[] | null | undefined {
	const normOriginal = original ?? [];

	if (
		current.length === normOriginal.length &&
		current.every((value, index) => Object.is(value, normOriginal[index]))
	) {
		return undefined;
	}

	if (current.length === 0) {
		return null;
	}

	return current;
}

export function getBoolDiff(
	current: boolean,
	original: boolean | null | undefined,
): boolean | undefined {
	const normOriginal = original ?? false;

	if (current === normOriginal) {
		return undefined;
	}

	return current;
}
