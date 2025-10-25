import type {
	ApiBgmData,
	ApiVndbData,
	FullGameData,
	OtherData,
	RawGameData,
} from "@/types";

// 简化版：仅接受可选的 appendFields（各子段为 Partial），序列化规则固定为默认字段
export type AppendFields = {
	game?: Partial<RawGameData>;
	bgm?: Partial<ApiBgmData>;
	vndb?: Partial<ApiVndbData>;
	other?: Partial<OtherData>;
};

function deepClone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v));
}

function mergeSection<T extends object>(
	base: T | undefined,
	extra: Partial<T> | undefined,
): T | undefined {
	if (!base && !extra) return undefined;
	const b = (base ? deepClone(base) : ({} as T)) as T;
	if (!extra) return b;
	// shallow-assign extra fields into b
	Object.assign(b as Record<string, unknown>, extra as Record<string, unknown>);
	return b;
}

function originalHasArrayField<T extends object | undefined>(
	section: T | undefined,
	field: string,
) {
	if (!section) return false;
	const obj = section as unknown as Record<string, unknown>;
	const arrayKey = `${field}_Array`;
	return Array.isArray(obj[arrayKey]) || Array.isArray(obj[field]);
}

function serializeArraysToStringsForSection<T extends object>(
	section: T,
	fieldsToSerialize?: string[],
) {
	if (!section || !fieldsToSerialize?.length) return;
	const obj = section as unknown as Record<string, unknown>;
	fieldsToSerialize.forEach((field) => {
		const arrayKey = `${field}_Array`;
		const stringKey = field;
		const maybeArray1 = obj[arrayKey];
		const maybeArray2 = obj[stringKey];
		if (Array.isArray(maybeArray1)) {
			try {
				obj[stringKey] = JSON.stringify(maybeArray1 as unknown[]);
			} catch {
				obj[stringKey] = (maybeArray1 as unknown[]).join(",");
			}
		} else if (Array.isArray(maybeArray2)) {
			try {
				obj[stringKey] = JSON.stringify(maybeArray2 as unknown[]);
			} catch {
				obj[stringKey] = (maybeArray2 as unknown[]).join(",");
			}
		}
	});
}

export function transformApiGameData(
	input: FullGameData,
	appendFields?: AppendFields,
): FullGameData {
	const src = deepClone(
		input || { game: { id_type: "custom" } },
	) as FullGameData;
	const original = deepClone(
		input || { game: { id_type: "custom" } },
	) as FullGameData;
	const append = appendFields;

	src.game =
		mergeSection<RawGameData>(src.game, append?.game) || ({} as RawGameData);
	src.bgm_data =
		mergeSection<Partial<ApiBgmData>>(
			src.bgm_data as unknown as Partial<ApiBgmData> | undefined,
			append?.bgm as Partial<ApiBgmData> | undefined,
		) || null;
	src.vndb_data =
		mergeSection<Partial<ApiVndbData>>(
			src.vndb_data as unknown as Partial<ApiVndbData> | undefined,
			append?.vndb as Partial<ApiVndbData> | undefined,
		) || null;
	src.other_data =
		mergeSection<Partial<OtherData>>(
			src.other_data as unknown as Partial<OtherData> | undefined,
			append?.other as Partial<OtherData> | undefined,
		) || null;

	const defaultSerializeFields = ["tags", "aliases", "all_titles"];

	if (src.bgm_data) {
		const allowed = defaultSerializeFields.filter((f) =>
			originalHasArrayField(
				original.bgm_data as unknown as Partial<ApiBgmData> | undefined,
				f,
			),
		);
		serializeArraysToStringsForSection(src.bgm_data, allowed);
	}
	if (src.vndb_data) {
		const allowed = defaultSerializeFields.filter((f) =>
			originalHasArrayField(
				original.vndb_data as unknown as Partial<ApiVndbData> | undefined,
				f,
			),
		);
		serializeArraysToStringsForSection(src.vndb_data, allowed);
	}
	if (src.other_data) {
		const allowed = defaultSerializeFields.filter((f) =>
			originalHasArrayField(
				original.other_data as unknown as Partial<OtherData> | undefined,
				f,
			),
		);
		serializeArraysToStringsForSection(src.other_data, allowed);
	}
	if (src.game) {
		const allowed = defaultSerializeFields.filter((f) =>
			originalHasArrayField(
				original.game as unknown as Partial<RawGameData> | undefined,
				f,
			),
		);
		serializeArraysToStringsForSection(
			src.game as unknown as Record<string, unknown>,
			allowed,
		);
	}

	return src;
}

/**
 * 批量处理数组版本的 transformApiGameData
 * 返回转换结果和遇到的错误（不抛出），便于上层批量流程继续处理
 */
export function transformApiGameDataBatch(
	inputs: FullGameData[],
	appendFields?: AppendFields | AppendFields[],
): {
	results: FullGameData[];
	errors: Array<{ index: number; message: string }>;
} {
	const results: FullGameData[] = [];
	const errors: Array<{ index: number; message: string }> = [];

	if (!Array.isArray(inputs)) return { results, errors };

	for (let i = 0; i < inputs.length; i++) {
		try {
			const append = Array.isArray(appendFields)
				? appendFields[i]
				: (appendFields as AppendFields | undefined);
			const transformed = transformApiGameData(inputs[i], append);
			results.push(transformed);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			errors.push({ index: i, message: msg });
		}
	}

	return { results, errors };
}
