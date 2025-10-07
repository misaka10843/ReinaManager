import { BaseDirectory, copyFile, mkdir } from "@tauri-apps/plugin-fs";

export async function backupDatabase(): Promise<string> {
	// 生成带时间戳的备份文件名
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupName = `reina_manager_${timestamp}.db`;
	const backupPath = `data/backups/${backupName}`;

	try {
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
	} catch (error) {
		console.error("备份数据库失败:", error);
		throw error;
	}
}
