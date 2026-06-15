import { type } from "@tauri-apps/plugin-os";

export function buildTauriProtocolUrl(
	protocol: string,
	path: string,
	params: URLSearchParams,
): string {
	const base =
		type() === "windows"
			? `http://${protocol}.localhost`
			: `${protocol}://localhost`;
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	const query = params.toString();
	return `${base}${normalizedPath}${query ? `?${query}` : ""}`;
}
