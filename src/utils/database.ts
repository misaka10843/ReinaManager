import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { BaseDirectory, copyFile, mkdir } from "@tauri-apps/plugin-fs";

export async function backupDatabase(backup_path?: string): Promise<string> {
	// 生成带时间戳的备份文件名
	const AppData = await appDataDir();
	function formatTimestampLocal() {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
	}

	const timestamp = formatTimestampLocal();
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

/**
 * 导入数据库文件（覆盖现有数据库）
 * 导入成功后会自动重启应用
 * @returns Promise<string | null> 导入成功返回文件路径，取消返回 null
 */
export async function importDatabase(): Promise<string | null> {
	// 打开文件选择对话框
	const filePath = await open({
		filters: [{ name: "SQLite Database", extensions: ["db"] }],
		multiple: false,
		directory: false,
	});

	if (!filePath) {
		return null; // 用户取消
	}

	// 调用后端命令导入数据库
	await invoke("import_database", {
		sourcePath: filePath as string,
	});

	return filePath as string;
}
