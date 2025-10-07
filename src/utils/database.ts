import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { BaseDirectory, copyFile, mkdir } from "@tauri-apps/plugin-fs";

export async function backupDatabase(backup_path?: string): Promise<string> {
	// 生成带时间戳的备份文件名
	const AppData = await appDataDir();
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupName = `reina_manager_${timestamp}.db`;
	const backupPath = `data/backups/${backupName}`;

	try {
		if (backup_path === "" || backup_path === undefined) {
			// 确保备份目录存在
			await mkdir("data/backups", {
				baseDir: BaseDirectory.AppData,
				recursive: true,
			});

			// 复制数据库文件
			await copyFile("data/reina_manager.db", backupPath, {
				fromPathBaseDir: BaseDirectory.AppData,
				toPathBaseDir: BaseDirectory.AppData,
			});

			console.log(`数据库已备份到: ${backupPath}`);
			return backupPath;
		} else {
			// 将 AppData 下的数据库文件复制到用户指定的目标位置（后端或插件实现 copy_file）
			await invoke("copy_file", {
				src: `${AppData}/data/reina_manager.db`,
				dst: `${backup_path}/${backupName}`,
			});

			return `${backup_path}/${backupName}`;
		}
	} catch (error) {
		console.error("备份数据库失败:", error);
		throw error;
	}
}
