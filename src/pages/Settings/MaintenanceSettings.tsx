import BackupIcon from "@mui/icons-material/Backup";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ImageIcon from "@mui/icons-material/Image";
import RestoreIcon from "@mui/icons-material/Restore";
import {
	Alert,
	CircularProgress,
	Switch,
	TextField,
	Typography,
} from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { type ChangeEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useRefreshSettings } from "@/hooks/queries/useSettings";
import { snackbar } from "@/providers/snackBar";
import {
	type AppTerminationPermit,
	releaseAppTermination,
	requestAppTermination,
	restartApp,
} from "@/services/appExit";
import {
	backupCustomCovers,
	backupDatabase,
	importDatabase,
	selectDatabaseImportFile,
} from "@/services/fs/dataMaintenance";
import { openDatabaseBackupFolder } from "@/services/fs/savedataBackup";
import { fileService } from "@/services/invoke";
import { useStore } from "@/store/appStore";
import { getUserErrorMessage } from "@/utils/errors";
import { SettingsGroup, SettingsItem } from "./SettingsLayout";

export const DatabaseBackupSettings = () => {
	const { t } = useTranslation();
	const refreshSettings = useRefreshSettings();
	const [isBackingUp, setIsBackingUp] = useState(false);
	const [isBackingCovers, setIsBackingCovers] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [webdavEnabled, setWebdavEnabled] = useState(false);
	const [webdavUrl, setWebdavUrl] = useState("");
	const [webdavUsername, setWebdavUsername] = useState("");
	const [webdavPath, setWebdavPath] = useState("ReinaManager");
	const [webdavEncrypt, setWebdavEncrypt] = useState(false);
	const [webdavPassword, setWebdavPassword] = useState("");
	const [webdavMasterPassword, setWebdavMasterPassword] = useState("");
	const [webdavSecretsConfigured, setWebdavSecretsConfigured] = useState(false);
	const [webdavMasterConfigured, setWebdavMasterConfigured] = useState(false);
	const [webdavSaving, setWebdavSaving] = useState(false);
	const [webdavTesting, setWebdavTesting] = useState(false);
	const [webdavError, setWebdavError] = useState<string | null>(null);
	const {
		autoBackupIncludeCovers,
		autoBackupLastError,
		autoBackupLastSuccessAt,
		autoBackupOnExit,
		autoBackupRetentionCount,
		exitBackupMinIntervalHours,
		scheduledBackupEnabled,
		scheduledBackupIntervalHours,
		setAutoBackupIncludeCovers,
		setAutoBackupOnExit,
		setAutoBackupRetentionCount,
		setExitBackupMinIntervalHours,
		setScheduledBackupEnabled,
		setScheduledBackupIntervalHours,
	} = useStore(
		useShallow((s) => ({
			autoBackupIncludeCovers: s.autoBackupIncludeCovers,
			autoBackupLastError: s.autoBackupLastError,
			autoBackupLastSuccessAt: s.autoBackupLastSuccessAt,
			autoBackupOnExit: s.autoBackupOnExit,
			autoBackupRetentionCount: s.autoBackupRetentionCount,
			exitBackupMinIntervalHours: s.exitBackupMinIntervalHours,
			scheduledBackupEnabled: s.scheduledBackupEnabled,
			scheduledBackupIntervalHours: s.scheduledBackupIntervalHours,
			setAutoBackupIncludeCovers: s.setAutoBackupIncludeCovers,
			setAutoBackupOnExit: s.setAutoBackupOnExit,
			setAutoBackupRetentionCount: s.setAutoBackupRetentionCount,
			setExitBackupMinIntervalHours: s.setExitBackupMinIntervalHours,
			setScheduledBackupEnabled: s.setScheduledBackupEnabled,
			setScheduledBackupIntervalHours: s.setScheduledBackupIntervalHours,
		})),
	);

	const handleScheduledIntervalChange = (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		setScheduledBackupIntervalHours(Number(event.target.value));
	};

	const handleExitIntervalChange = (event: ChangeEvent<HTMLInputElement>) => {
		setExitBackupMinIntervalHours(Number(event.target.value));
	};

	const handleRetentionCountChange = (event: ChangeEvent<HTMLInputElement>) => {
		setAutoBackupRetentionCount(Number(event.target.value));
	};

	const lastAutoBackupText = autoBackupLastSuccessAt
		? new Date(autoBackupLastSuccessAt).toLocaleString()
		: t("pages.Settings.databaseBackup.autoNever", "从未自动备份");
	const autoBackupEnabled = scheduledBackupEnabled || autoBackupOnExit;

	useEffect(() => {
		void Promise.all([
			fileService.getWebDavConfig(),
			fileService.getWebDavSecretStatus(),
		])
			.then(([config, secrets]) => {
				setWebdavEnabled(config.enabled);
				setWebdavUrl(config.url);
				setWebdavUsername(config.username);
				setWebdavPath(config.remotePath);
				setWebdavEncrypt(config.encrypt);
				setWebdavSecretsConfigured(secrets.passwordSaved);
				setWebdavMasterConfigured(secrets.masterPasswordSaved);
			})
			.catch((error) => setWebdavError(getUserErrorMessage(error, t)));
	}, [t]);

	const handleSaveWebdav = async () => {
		setWebdavSaving(true);
		setWebdavError(null);
		try {
			if (webdavPassword || webdavMasterPassword) {
				await fileService.setWebDavSecrets(
					webdavPassword,
					webdavMasterPassword,
				);
				setWebdavSecretsConfigured(
					webdavSecretsConfigured || Boolean(webdavPassword),
				);
				setWebdavMasterConfigured(
					webdavMasterConfigured || Boolean(webdavMasterPassword),
				);
				setWebdavPassword("");
				setWebdavMasterPassword("");
			}
			await fileService.saveWebDavConfig({
				enabled: webdavEnabled,
				url: webdavUrl.trim(),
				username: webdavUsername,
				remotePath: webdavPath,
				encrypt: webdavEncrypt,
			});
			snackbar.success(
				t("pages.Settings.databaseBackup.webdavSaved", "WebDAV 设置已保存"),
			);
		} catch (error) {
			setWebdavError(getUserErrorMessage(error, t));
		} finally {
			setWebdavSaving(false);
		}
	};

	const handleTestWebdav = async () => {
		setWebdavTesting(true);
		setWebdavError(null);
		try {
			if (webdavPassword || webdavMasterPassword) {
				await fileService.setWebDavSecrets(
					webdavPassword,
					webdavMasterPassword,
				);
				setWebdavSecretsConfigured(
					webdavSecretsConfigured || Boolean(webdavPassword),
				);
				setWebdavMasterConfigured(
					webdavMasterConfigured || Boolean(webdavMasterPassword),
				);
				setWebdavPassword("");
				setWebdavMasterPassword("");
			}
			const config = {
				enabled: webdavEnabled,
				url: webdavUrl.trim(),
				username: webdavUsername,
				remotePath: webdavPath,
				encrypt: webdavEncrypt,
			};
			await fileService.testWebDavConnection(config);
			snackbar.success(
				t("pages.Settings.databaseBackup.webdavConnected", "WebDAV 连接成功"),
			);
		} catch (error) {
			setWebdavError(getUserErrorMessage(error, t));
		} finally {
			setWebdavTesting(false);
		}
	};

	const handleBackupDatabase = async () => {
		setIsBackingUp(true);

		try {
			const result = await backupDatabase();
			if (result.success) {
				refreshSettings();
				snackbar.success(
					t(
						"pages.Settings.databaseBackup.backupSuccess",
						"数据库备份成功: {{path}}",
						{
							path: result.path,
						},
					),
				);
			} else {
				snackbar.error(
					t(
						"pages.Settings.databaseBackup.backupError",
						"数据库备份失败: {{error}}",
						{
							error: result.message,
						},
					),
				);
			}
		} catch (error) {
			const errorMessage = getUserErrorMessage(
				error,
				t,
				t("pages.Settings.databaseBackup.backupFailed", "备份失败"),
			);
			snackbar.error(
				t(
					"pages.Settings.databaseBackup.backupError",
					"数据库备份失败: {{error}}",
					{ error: errorMessage },
				),
			);
		} finally {
			setIsBackingUp(false);
		}
	};

	const handleBackupCustomCovers = async () => {
		setIsBackingCovers(true);

		try {
			const result = await backupCustomCovers();
			if (result.success) {
				refreshSettings();
				snackbar.success(
					result.path
						? t(
								"pages.Settings.databaseBackup.coverBackupSuccess",
								"自定义封面备份成功: {{path}}",
								{
									path: result.path,
								},
							)
						: t(
								"pages.Settings.databaseBackup.noCoversToBackup",
								"没有自定义封面需要备份",
							),
				);
			} else {
				snackbar.error(
					t(
						"pages.Settings.databaseBackup.coverBackupError",
						"自定义封面备份失败: {{error}}",
						{
							error: result.message,
						},
					),
				);
			}
		} catch (error) {
			const errorMessage = getUserErrorMessage(
				error,
				t,
				t(
					"pages.Settings.databaseBackup.coverBackupFailed",
					"备份自定义封面失败",
				),
			);
			snackbar.error(
				t(
					"pages.Settings.databaseBackup.coverBackupError",
					"自定义封面备份失败: {{error}}",
					{
						error: errorMessage,
					},
				),
			);
		} finally {
			setIsBackingCovers(false);
		}
	};

	const handleOpenBackupFolder = async () => {
		try {
			await openDatabaseBackupFolder();
		} catch (error) {
			const errorMessage = getUserErrorMessage(
				error,
				t,
				t("pages.Settings.databaseBackup.openFolderFailed", "打开文件夹失败"),
			);
			snackbar.error(
				t(
					"pages.Settings.databaseBackup.openFolderError",
					"打开备份文件夹失败: {{error}}",
					{
						error: errorMessage,
					},
				),
			);
		}
	};

	const handleImportDatabase = async () => {
		setIsImporting(true);
		let restartPermit: AppTerminationPermit | null = null;
		try {
			const filePath = await selectDatabaseImportFile();
			if (!filePath) {
				return;
			}

			restartPermit = await requestAppTermination("restart");
			if (!restartPermit) {
				return;
			}

			const result = await importDatabase(filePath);
			if (!result.success) {
				snackbar.error(
					t(
						"pages.Settings.databaseBackup.importError",
						"数据库导入失败: {{error}}",
						{
							error: result.message,
						},
					),
				);
				return;
			}

			refreshSettings();
			snackbar.success(
				t(
					"pages.Settings.databaseBackup.importSuccess",
					"数据库导入成功，已备份自定义封面并清空封面缓存，应用将自动重启",
				),
			);

			const confirmedPermit = restartPermit;
			restartPermit = null;
			// 延迟重启应用，让用户看到成功提示。
			setTimeout(() => {
				void restartApp(confirmedPermit).catch((error) => {
					console.error("数据库导入后重启应用失败:", error);
				});
			}, 3000);
		} catch (error) {
			const errorMessage = getUserErrorMessage(
				error,
				t,
				t("pages.Settings.databaseBackup.importFailed", "导入失败"),
			);
			snackbar.error(
				t(
					"pages.Settings.databaseBackup.importError",
					"数据库导入失败: {{error}}",
					{ error: errorMessage },
				),
			);
		} finally {
			releaseAppTermination(restartPermit);
			setIsImporting(false);
		}
	};

	return (
		<SettingsGroup
			title={t("pages.Settings.databaseBackup.title", "数据备份与恢复")}
			description={t(
				"pages.Settings.databaseBackup.restoreWarning",
				"恢复数据库将覆盖现有数据，并会先备份自定义封面、清空封面缓存以避免封面错配。导入后应用将自动重启。",
			)}
		>
			<Stack
				direction="row"
				spacing={2}
				useFlexGap
				alignItems="center"
				flexWrap="wrap"
			>
				<Button
					variant="contained"
					color="primary"
					onClick={handleBackupDatabase}
					disabled={isBackingUp}
					startIcon={
						isBackingUp ? (
							<CircularProgress size={16} color="inherit" />
						) : (
							<BackupIcon />
						)
					}
					className="px-6 py-2"
				>
					{isBackingUp
						? t("pages.Settings.databaseBackup.backing", "备份中...")
						: t("pages.Settings.databaseBackup.backup", "备份数据库")}
				</Button>

				<Button
					variant="outlined"
					color="primary"
					onClick={handleBackupCustomCovers}
					disabled={isBackingCovers}
					startIcon={
						isBackingCovers ? (
							<CircularProgress size={16} color="inherit" />
						) : (
							<ImageIcon />
						)
					}
					className="px-6 py-2"
				>
					{isBackingCovers
						? t("pages.Settings.databaseBackup.backingCovers", "备份封面中...")
						: t("pages.Settings.databaseBackup.backupCovers", "备份自定义封面")}
				</Button>

				<Button
					variant="outlined"
					color="primary"
					onClick={handleOpenBackupFolder}
					startIcon={<FolderOpenIcon />}
					className="px-6 py-2"
				>
					{t("pages.Settings.databaseBackup.openFolder", "打开备份文件夹")}
				</Button>

				<Button
					variant="outlined"
					color="warning"
					onClick={handleImportDatabase}
					disabled={isImporting}
					startIcon={
						isImporting ? (
							<CircularProgress size={16} color="inherit" />
						) : (
							<RestoreIcon />
						)
					}
					className="px-6 py-2"
				>
					{isImporting
						? t("pages.Settings.databaseBackup.importing", "导入中...")
						: t("pages.Settings.databaseBackup.restore", "恢复数据库")}
				</Button>
			</Stack>

			<SettingsItem
				title={t(
					"pages.Settings.databaseBackup.scheduledBackup",
					"定时自动备份",
				)}
				description={t(
					"pages.Settings.databaseBackup.scheduledBackupDescription",
					"应用运行或驻留托盘时按周期备份；启动时若已逾期，会在约 60 秒后补做一次。",
				)}
			>
				<Switch
					checked={scheduledBackupEnabled}
					onChange={(event) => setScheduledBackupEnabled(event.target.checked)}
					color="primary"
				/>
			</SettingsItem>

			<SettingsItem
				title={t(
					"pages.Settings.databaseBackup.autoBackupOnExit",
					"退出时自动备份",
				)}
				description={t(
					"pages.Settings.databaseBackup.autoBackupOnExitDescription",
					"开启后，软件正常退出时会自动备份数据库；如果同时启用自定义封面备份，可能会延长退出时间。",
				)}
			>
				<Switch
					checked={autoBackupOnExit}
					onChange={(event) => setAutoBackupOnExit(event.target.checked)}
					color="primary"
				/>
			</SettingsItem>
			<Box className="space-y-3">
				<Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
					<TextField
						label={t(
							"pages.Settings.databaseBackup.scheduledIntervalHours",
							"定时备份周期（小时）",
						)}
						type="number"
						size="small"
						value={scheduledBackupIntervalHours}
						onChange={handleScheduledIntervalChange}
						disabled={!scheduledBackupEnabled}
						slotProps={{ htmlInput: { min: 1 } }}
					/>
					<TextField
						label={t(
							"pages.Settings.databaseBackup.exitMinIntervalHours",
							"退出备份最小间隔（小时）",
						)}
						type="number"
						size="small"
						value={exitBackupMinIntervalHours}
						onChange={handleExitIntervalChange}
						disabled={!autoBackupOnExit}
						helperText={t(
							"pages.Settings.databaseBackup.exitMinIntervalHelp",
							"填 0 表示每次退出都备份",
						)}
						slotProps={{ htmlInput: { min: 0 } }}
					/>
					<TextField
						label={t(
							"pages.Settings.databaseBackup.autoRetentionCount",
							"最多保留自动备份（批次）",
						)}
						type="number"
						size="small"
						value={autoBackupRetentionCount}
						onChange={handleRetentionCountChange}
						disabled={!autoBackupEnabled}
						slotProps={{ htmlInput: { min: 1 } }}
					/>
				</Stack>

				<SettingsItem
					title={t(
						"pages.Settings.databaseBackup.autoIncludeCovers",
						"同时备份自定义封面",
					)}
				>
					<Switch
						checked={autoBackupIncludeCovers}
						onChange={(event) =>
							setAutoBackupIncludeCovers(event.target.checked)
						}
						disabled={!autoBackupEnabled}
						color="primary"
					/>
				</SettingsItem>

				<Typography variant="caption" color="text.secondary" className="block">
					{t(
						"pages.Settings.databaseBackup.lastAutoBackup",
						"上次自动备份：{{time}}",
						{ time: lastAutoBackupText },
					)}
				</Typography>
				{autoBackupLastError && (
					<Typography variant="caption" color="error" className="block mt-1">
						{t(
							"pages.Settings.databaseBackup.lastAutoBackupNotice",
							"上次自动备份提示：{{error}}",
							{ error: autoBackupLastError },
						)}
					</Typography>
				)}
			</Box>
			<SettingsGroup
				title={t(
					"pages.Settings.databaseBackup.webdavTitle",
					"WebDAV 自动备份",
				)}
				description={t(
					"pages.Settings.databaseBackup.webdavDescription",
					"自动备份完成后上传数据库和可选封面到 WebDAV。连接密码保存在系统凭据库；远端加密使用用户主密码。",
				)}
			>
				<SettingsItem
					title={t(
						"pages.Settings.databaseBackup.webdavEnabled",
						"启用 WebDAV 上传",
					)}
				>
					<Switch
						checked={webdavEnabled}
						onChange={(event) => setWebdavEnabled(event.target.checked)}
					/>
				</SettingsItem>
				<Stack spacing={2}>
					<TextField
						size="small"
						label="WebDAV URL"
						value={webdavUrl}
						onChange={(event) => setWebdavUrl(event.target.value)}
					/>
					<Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
						<TextField
							size="small"
							label={t(
								"pages.Settings.databaseBackup.webdavUsername",
								"用户名",
							)}
							value={webdavUsername}
							onChange={(event) => setWebdavUsername(event.target.value)}
						/>
						<TextField
							size="small"
							type="password"
							label={t(
								"pages.Settings.databaseBackup.webdavPassword",
								"密码/应用令牌",
							)}
							value={webdavPassword}
							helperText={
								webdavSecretsConfigured
									? t(
											"pages.Settings.databaseBackup.webdavPasswordSaved",
											"已保存；留空则保持不变",
										)
									: undefined
							}
							onChange={(event) => setWebdavPassword(event.target.value)}
						/>
						<TextField
							size="small"
							label={t("pages.Settings.databaseBackup.webdavPath", "远端目录")}
							value={webdavPath}
							onChange={(event) => setWebdavPath(event.target.value)}
						/>
					</Stack>
					<SettingsItem
						title={t(
							"pages.Settings.databaseBackup.webdavEncrypt",
							"加密远端备份",
						)}
						description={t(
							"pages.Settings.databaseBackup.webdavEncryptDescription",
							"启用后其他设备需要使用同一主密码解密；忘记密码将无法恢复。",
						)}
					>
						<Switch
							checked={webdavEncrypt}
							onChange={(event) => setWebdavEncrypt(event.target.checked)}
						/>
					</SettingsItem>
					{webdavEncrypt && (
						<TextField
							size="small"
							type="password"
							label={t(
								"pages.Settings.databaseBackup.webdavMasterPassword",
								"备份主密码",
							)}
							value={webdavMasterPassword}
							helperText={
								webdavMasterConfigured
									? t(
											"pages.Settings.databaseBackup.webdavMasterPasswordSaved",
											"已保存；留空则保持不变",
										)
									: undefined
							}
							onChange={(event) => setWebdavMasterPassword(event.target.value)}
						/>
					)}
					{webdavError && <Alert severity="error">{webdavError}</Alert>}
					<Button
						variant="outlined"
						onClick={() => void handleSaveWebdav()}
						disabled={webdavSaving}
					>
						{webdavSaving
							? t("pages.Settings.databaseBackup.webdavSaving", "保存中…")
							: t(
									"pages.Settings.databaseBackup.webdavSave",
									"保存 WebDAV 设置",
								)}
					</Button>
					<Button
						variant="outlined"
						onClick={() => void handleTestWebdav()}
						disabled={webdavTesting}
					>
						{webdavTesting
							? t("pages.Settings.databaseBackup.webdavTesting", "测试中…")
							: t("pages.Settings.databaseBackup.webdavTest", "测试连接")}
					</Button>
				</Stack>
			</SettingsGroup>
		</SettingsGroup>
	);
};
