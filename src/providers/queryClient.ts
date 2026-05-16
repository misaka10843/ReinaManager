import { QueryClient } from "@tanstack/react-query";

export const DEFAULT_QUERY_STALE_TIME = 30_000;
export const DEFAULT_QUERY_GC_TIME = 10 * 60_000;
export const LOCAL_DATA_STALE_TIME = Number.POSITIVE_INFINITY;
export const LOCAL_DATA_GC_TIME = 30 * 60_000;

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: DEFAULT_QUERY_STALE_TIME,
			gcTime: DEFAULT_QUERY_GC_TIME,
			retry: 1,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
		},
	},
});
