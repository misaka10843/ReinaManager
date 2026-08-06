import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	DialogActions,
	DialogContent,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	Typography,
} from "@mui/material";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBulkGameAddActions } from "@/hooks/features/games/useGameMetadataFacade";
import { useAllGames, useUpdateGame } from "@/hooks/queries/useGames";
import { useAllSettings } from "@/hooks/queries/useSettings";
import { getRuntimeSourceAdapter, SEARCHABLE_SOURCE_KEYS } from "@/metadata";
import { getGameIdentityKeys } from "@/metadata/data/metadata";
import { snackbar } from "@/providers/snackBar";
import { isBgmAuthExpiredError, withBgmAuth } from "@/services/bgmAuthSession";
import { fileService, type SteamLibraryGame } from "@/services/invoke";
import { createMetadataSession } from "@/services/requestContext";
import type { GameMetadataDraft } from "@/types";
import { createAbortableRunner, isAbortError } from "@/utils/async";
import { getUserErrorMessage, isApiRateLimitError } from "@/utils/errors";

type SteamImportItem = SteamLibraryGame & {
	matchedData?: GameMetadataDraft;
	selectedProcessPath?: string;
	matchState: "pending" | "matched" | "not_found" | "error";
};

interface SteamImportTabProps {
	hidden: boolean;
	onClose: () => void;
}

export default function SteamImportTab({
	hidden,
	onClose,
}: SteamImportTabProps) {
	const { t } = useTranslation();
	const { data: settings } = useAllSettings();
	const hasBgmAuth = Boolean(settings?.bgm_auth);
	const { addGamesFromBulkImport, isAddingGames } = useBulkGameAddActions();
	const { data: allGames = [] } = useAllGames();
	const { mutateAsync: updateGame, isPending: isLinking } = useUpdateGame();
	const [items, setItems] = useState<SteamImportItem[]>([]);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [source, setSource] = useState<(typeof SEARCHABLE_SOURCE_KEYS)[number]>(
		hasBgmAuth ? "bgm" : "vndb",
	);
	const [scanning, setScanning] = useState(false);
	const [matching, setMatching] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const loading = scanning || matching || isAddingGames || isLinking;
	const importable = useMemo(
		() => items.filter((item) => item.existing_game_id === null),
		[items],
	);

	const scan = async () => {
		setScanning(true);
		try {
			const result = await fileService.scanSteamLibrary();
			setWarnings(result.warnings);
			setItems(
				result.games.map((game) => ({
					...game,
					selectedProcessPath: game.executables[0],
					matchState: "pending",
				})),
			);
		} catch (error) {
			snackbar.error(getUserErrorMessage(error, t));
		} finally {
			setScanning(false);
		}
	};

	const matchMetadata = async () => {
		abortRef.current?.abort();
		const { controller, withAbort } = createAbortableRunner();
		abortRef.current = controller;
		setMatching(true);
		const next = [...items];
		try {
			for (let index = 0; index < next.length; index++) {
				if (controller.signal.aborted) break;
				if (next[index].existing_game_id !== null) continue;
				try {
					const matched =
						source === "bgm"
							? await withBgmAuth((token) =>
									withAbort(
										createMetadataSession({
											bgmToken: token,
											signal: controller.signal,
										}).searchBestMatch({ query: next[index].name, source }),
									),
								)
							: await withAbort(
									createMetadataSession({
										signal: controller.signal,
									}).searchBestMatch({
										query: next[index].name,
										source,
									}),
								);
					next[index] = {
						...next[index],
						matchedData: matched ?? undefined,
						matchState: matched ? "matched" : "not_found",
					};
				} catch (error) {
					if (isAbortError(error) || isBgmAuthExpiredError(error)) break;
					if (isApiRateLimitError(error)) {
						snackbar.warning(getUserErrorMessage(error, t));
						break;
					}
					next[index] = { ...next[index], matchState: "error" };
				}
				setItems([...next]);
			}
		} finally {
			setMatching(false);
			abortRef.current = null;
		}
	};

	const importGames = async (matchedOnly: boolean) => {
		let candidates = importable.filter(
			(item) => !matchedOnly || item.matchState === "matched",
		);
		const linkedAppIds = new Set<number>();
		if (matchedOnly) {
			for (const item of candidates) {
				if (!item.matchedData) continue;
				const keys = new Set(getGameIdentityKeys(item.matchedData));
				const existing = allGames.find((game) =>
					getGameIdentityKeys(game).some((key) => keys.has(key)),
				);
				if (!existing) continue;
				await updateGame({
					gameId: existing.id,
					updates: {
						launch_type: "steam",
						steam_app_id: item.app_id,
						steam_process_path: item.selectedProcessPath ?? null,
						localpath: item.install_path,
						executable: null,
						le_launch: 0,
					},
				});
				linkedAppIds.add(item.app_id);
			}
			candidates = candidates.filter((item) => !linkedAppIds.has(item.app_id));
		}
		if (candidates.length === 0) {
			setItems((current) =>
				current.filter((item) => !linkedAppIds.has(item.app_id)),
			);
			snackbar.success(
				t(
					"components.SteamImport.linkedExisting",
					"已关联 {{count}} 个现有游戏",
					{
						count: linkedAppIds.size,
					},
				),
			);
			return;
		}
		const result = await addGamesFromBulkImport(
			candidates.map((item) => ({
				name: item.name,
				path: item.install_path,
				matchedData: matchedOnly ? item.matchedData : undefined,
				launchType: "steam" as const,
				steamAppId: item.app_id,
				steamProcessPath: item.selectedProcessPath,
			})),
		);
		if (result.batchResult?.success) {
			const failedPayloadIndexes = new Set(
				result.batchResult.errors.map((error) => error.index),
			);
			const successfulAppIds = new Set<number>();
			for (const { itemIndex, payloadIndex } of result.pendingPayloads) {
				if (failedPayloadIndexes.has(payloadIndex)) continue;
				const appId = candidates[itemIndex]?.app_id;
				if (appId !== undefined) {
					successfulAppIds.add(appId);
				}
			}
			setItems((current) =>
				current.filter(
					(item) =>
						!successfulAppIds.has(item.app_id) &&
						!linkedAppIds.has(item.app_id),
				),
			);
			snackbar.success(
				t("components.SteamImport.imported", "已导入 {{count}} 个 Steam 游戏", {
					count: result.batchResult.success,
				}),
			);
		} else if (result.mutationError) {
			snackbar.error(result.mutationError);
		} else {
			snackbar.info(
				t("components.SteamImport.noImportable", "没有可导入的游戏"),
			);
		}
	};

	return (
		<>
			<DialogContent
				className={
					hidden ? "hidden" : "flex flex-1 min-h-0 overflow-hidden pt-4"
				}
			>
				<Stack spacing={2} className="w-full min-h-0">
					<Stack
						direction="row"
						spacing={1.5}
						alignItems="center"
						useFlexGap
						flexWrap="wrap"
					>
						<Button
							variant="contained"
							startIcon={<RefreshRoundedIcon />}
							onClick={scan}
							disabled={loading}
						>
							{t("components.SteamImport.scan", "扫描 Steam 库")}
						</Button>
						<FormControl size="small" sx={{ minWidth: 160 }} disabled={loading}>
							<InputLabel>
								{t("components.SteamImport.source", "匹配数据源")}
							</InputLabel>
							<Select
								value={source}
								label={t("components.SteamImport.source", "匹配数据源")}
								onChange={(event) =>
									setSource(event.target.value as typeof source)
								}
							>
								{SEARCHABLE_SOURCE_KEYS.map((value) => (
									<MenuItem
										key={value}
										value={value}
										disabled={value === "bgm" && !hasBgmAuth}
									>
										{getRuntimeSourceAdapter(value).label}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<Typography variant="body2" color="text.secondary">
							{t("components.SteamImport.count", "{{count}} 个已安装游戏", {
								count: items.length,
							})}
						</Typography>
					</Stack>
					{warnings.length > 0 && (
						<Alert severity="warning">{warnings.slice(0, 3).join("；")}</Alert>
					)}
					<Box className="min-h-0 flex-1 overflow-auto">
						<Stack spacing={1}>
							{items.map((item) => (
								<Box
									key={item.app_id}
									className="grid grid-cols-[minmax(180px,1fr)_120px_minmax(180px,1fr)] items-center gap-3 border-0 border-b border-solid border-[var(--mui-palette-divider)] py-2"
								>
									<Box className="min-w-0">
										<Typography noWrap fontWeight={600}>
											{item.name}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											AppID {item.app_id} · {item.status.stage}
										</Typography>
									</Box>
									<Typography
										variant="body2"
										color={
											item.existing_game_id ? "warning.main" : "text.secondary"
										}
									>
										{item.existing_game_id
											? t("components.SteamImport.linked", "已关联")
											: item.matchState === "matched"
												? t("components.SteamImport.matched", "已匹配")
												: t("components.SteamImport.pending", "待匹配")}
									</Typography>
									<FormControl
										size="small"
										disabled={item.existing_game_id !== null}
									>
										<Select
											displayEmpty
											value={item.selectedProcessPath ?? ""}
											onChange={(event) =>
												setItems((current) =>
													current.map((candidate) =>
														candidate.app_id === item.app_id
															? {
																	...candidate,
																	selectedProcessPath:
																		event.target.value || undefined,
																}
															: candidate,
													),
												)
											}
										>
											<MenuItem value="">
												{t("components.SteamImport.detectLater", "启动后检测")}
											</MenuItem>
											{item.executables.map((executable) => (
												<MenuItem key={executable} value={executable}>
													{executable}
												</MenuItem>
											))}
										</Select>
									</FormControl>
								</Box>
							))}
						</Stack>
					</Box>
				</Stack>
			</DialogContent>
			<DialogActions className={hidden ? "hidden" : "flex flex-wrap gap-2"}>
				<Button variant="outlined" onClick={onClose}>
					{t("common.cancel", "取消")}
				</Button>
				<Button
					startIcon={<SearchRoundedIcon />}
					onClick={matchMetadata}
					disabled={loading || importable.length === 0}
				>
					{matching ? (
						<CircularProgress size={18} />
					) : (
						t("components.SteamImport.match", "匹配元数据")
					)}
				</Button>
				<Button
					variant="outlined"
					onClick={() => void importGames(false)}
					disabled={loading || importable.length === 0}
				>
					{t("components.SteamImport.customImport", "导入为自定义")}
				</Button>
				<Button
					variant="contained"
					onClick={() => void importGames(true)}
					disabled={
						loading || !importable.some((item) => item.matchState === "matched")
					}
				>
					{t("components.SteamImport.importMatched", "导入已匹配")}
				</Button>
			</DialogActions>
		</>
	);
}
