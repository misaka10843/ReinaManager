import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { settingsService } from "@/services/invoke";

export const isAutostartEnabled = async () => {
	if (await settingsService.isDevelopment()) return false;
	return isEnabled();
};

export const toggleAutostart = async () => {
	try {
		if (await settingsService.isDevelopment()) return;
		// 检查当前是否已启用 autostart
		const enabled = await isEnabled();
		if (enabled) {
			// 如果已启用，则禁用 autostart
			await disable();
		} else {
			// 如果未启用，则启用 autostart
			await enable();
		}
	} catch (error) {
		console.error("Error toggling autostart:", error);
	}
};
