import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/common/useDebouncedValue";
import { fileService } from "@/services/invoke";
import type { UserPathInspection } from "@/services/invoke/fileService";

export interface UserPathInspectionState {
	inspection: UserPathInspection | null;
	error: unknown;
	isLoading: boolean;
}

const EMPTY_STATE: UserPathInspectionState = {
	inspection: null,
	error: null,
	isLoading: false,
};

/** 对用户配置路径做轻量预览，不把输入过程写入全局查询缓存。 */
export function useUserPathInspection(
	value: string,
	enabled = true,
): UserPathInspectionState {
	const debouncedValue = useDebouncedValue(value.trim(), 300);
	const requestIdRef = useRef(0);
	const [state, setState] = useState<UserPathInspectionState>(EMPTY_STATE);

	useEffect(() => {
		const requestId = ++requestIdRef.current;
		if (!enabled || !debouncedValue) {
			setState(EMPTY_STATE);
			return;
		}

		setState((current) => ({ ...current, error: null, isLoading: true }));
		void fileService
			.inspectUserPath(debouncedValue)
			.then((inspection) => {
				if (requestId === requestIdRef.current) {
					setState({ inspection, error: null, isLoading: false });
				}
			})
			.catch((error: unknown) => {
				if (requestId === requestIdRef.current) {
					setState({ inspection: null, error, isLoading: false });
				}
			});
	}, [debouncedValue, enabled]);

	return state;
}
