import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import {
	Box,
	ButtonBase,
	CircularProgress,
	FormControl,
	IconButton,
	MenuItem,
	Select,
	Stack,
	Typography,
} from "@mui/material";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";
import type {
	BulkImportDuplicate,
	BulkImportDuplicateGroup,
	BulkImportMode,
} from "@/hooks/features/games/useGameMetadataFacade";
import {
	getCandidateSourceData,
	getRuntimeSourceAdapter,
	SEARCHABLE_SOURCE_KEYS,
} from "@/metadata";
import type { GameLaunchType, GameMetadataDraft } from "@/types";

export type BulkImportOutcome =
	| ({ kind: "duplicate" } & Omit<BulkImportDuplicate, "itemKey">)
	| {
			kind: "error";
			phase: "preparation" | "insertion" | "request";
			message: string;
	  }
	| { kind: "imported" };

export interface BulkImportItem {
	key: string;
	name: string;
	path?: string;
	executables: string[];
	status: "pending" | "matched" | "not found";
	importOutcome?: BulkImportOutcome;
	importMode?: BulkImportMode;
	matchedData?: GameMetadataDraft;
	selectedExe?: string;
	launch_type?: GameLaunchType;
	steam_launch_id?: string;
}

export type VisibleBulkImportItem = BulkImportItem & {
	importOutcome?: Exclude<BulkImportOutcome, { kind: "imported" }>;
};

interface BulkImportResultTableProps {
	items: VisibleBulkImportItem[];
	loading: boolean;
	emptyMessage: string;
	onDeleteItem: (key: string) => void;
	onEditItem: (item: VisibleBulkImportItem) => void;
	onExecutableChange: (key: string, executable: string) => void;
	onOpenDirectory: (path: string) => void;
}

const gridTemplateColumns =
	"minmax(180px, 2fr) minmax(180px, 2fr) 96px minmax(220px, 2.3fr) 88px";

const gridSx = {
	display: "grid",
	gridTemplateColumns,
	columnGap: 2,
	alignItems: "center",
	width: "100%",
	minWidth: 0,
} as const;

const cellSx = {
	minWidth: 0,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
} as const;

function getMatchedGameName(
	gameData: GameMetadataDraft | undefined,
	language: string,
): string | undefined {
	if (!gameData) {
		return undefined;
	}

	const useChineseName = language === "zh-CN";
	let fallbackName: string | undefined;

	for (const source of SEARCHABLE_SOURCE_KEYS) {
		const adapter = getRuntimeSourceAdapter(source);
		const data = getCandidateSourceData(gameData, source);
		if (!data) continue;

		const display = adapter.toDisplayFields(data);
		if (useChineseName && display.name_cn) {
			return display.name_cn;
		}

		if (display.name) {
			if (!useChineseName) return display.name;
			fallbackName ??= display.name;
		}
	}

	return fallbackName;
}

function getStatusLabel(item: VisibleBulkImportItem, t: TFunction): string {
	if (item.importOutcome?.kind === "duplicate") {
		// 列表内重复由组标题提示，混合冲突时优先显示仓库状态，保持单行高度。
		return item.importOutcome.inLibrary
			? t("components.BulkImportModal.statusLibraryDuplicate", "仓库已存在")
			: t("components.BulkImportModal.statusBatchDuplicate", "列表内重复");
	}
	if (item.importOutcome?.kind === "error")
		return t("components.BulkImportModal.statusImportFailed", "导入失败");
	if (item.importMode === "custom")
		return t("components.BulkImportModal.statusCustom", "自定义");
	switch (item.status) {
		case "pending":
			return t("components.BulkImportModal.statusPending", "待处理");
		case "matched":
			return t("components.BulkImportModal.statusMatched", "已匹配");
		case "not found":
			return t("components.BulkImportModal.statusNotFound", "未找到");
	}
}

type BulkDisplayRow =
	| { kind: "group"; key: string; count: number }
	| {
			kind: "item";
			key: string;
			item: VisibleBulkImportItem;
			grouped: boolean;
	  };

function buildDisplayRows(items: VisibleBulkImportItem[]): BulkDisplayRow[] {
	const byKey = new Map(items.map((item) => [item.key, item]));
	const componentByKey = new Map<string, VisibleBulkImportItem[]>();
	const components: VisibleBulkImportItem[][] = [];
	const visitedGroups = new Set<BulkImportDuplicateGroup>();
	for (const item of items) {
		if (componentByKey.has(item.key)) continue;
		const members: VisibleBulkImportItem[] = [];
		components.push(members);
		const pending = [item.key];
		componentByKey.set(item.key, members);
		while (pending.length) {
			const key = pending.pop();
			if (!key) break;
			const outcome = byKey.get(key)?.importOutcome;
			if (outcome?.kind !== "duplicate") continue;
			for (const group of outcome.groups) {
				if (visitedGroups.has(group)) continue;
				visitedGroups.add(group);
				// 直接遍历共享成员列表，每个身份组只访问一次，不构造两两邻接表。
				for (const memberKey of group.itemKeys) {
					if (!byKey.has(memberKey) || componentByKey.has(memberKey)) continue;
					componentByKey.set(memberKey, members);
					pending.push(memberKey);
				}
			}
		}
	}
	// 按原顺序填充展示组，保留最早成员的位置，也避免对大组重新排序。
	for (const item of items) componentByKey.get(item.key)?.push(item);
	const rows: BulkDisplayRow[] = [];
	for (const members of components) {
		const grouped = members.length > 1;
		if (grouped)
			rows.push({
				kind: "group",
				key: `group:${members[0].key}`,
				count: members.length,
			});
		for (const item of members)
			rows.push({ kind: "item", key: item.key, item, grouped });
	}
	return rows;
}

function getFailurePhase(
	phase: "preparation" | "insertion" | "request",
	t: TFunction,
): string {
	switch (phase) {
		case "preparation":
			return t(
				"components.BulkImportModal.failurePreparation",
				"准备游戏数据失败",
			);
		case "insertion":
			return t("components.BulkImportModal.failureInsertion", "写入游戏失败");
		case "request":
			return t("components.BulkImportModal.failureRequest", "批量导入请求失败");
	}
}

export default function BulkImportResultTable({
	items,
	loading,
	emptyMessage,
	onDeleteItem,
	onEditItem,
	onExecutableChange,
	onOpenDirectory,
}: BulkImportResultTableProps) {
	const { t, i18n } = useTranslation();
	const displayRows = useMemo(() => buildDisplayRows(items), [items]);

	return (
		<Box
			sx={{
				alignSelf: "stretch",
				display: "flex",
				flex: "1 1 auto",
				flexDirection: "column",
				minHeight: 0,
				width: "100%",
			}}
		>
			<Box
				sx={{
					...gridSx,
					borderBottom: 1,
					borderColor: "divider",
					color: "text.primary",
					flexShrink: 0,
					fontWeight: 600,
				}}
				className="px-4 py-1.5"
			>
				<Typography variant="subtitle2" sx={cellSx}>
					{t("components.BulkImportModal.searchName", "搜索名称")}
				</Typography>
				<Typography variant="subtitle2" sx={cellSx}>
					{t("components.BulkImportModal.matchedGame", "匹配的游戏")}
				</Typography>
				<Typography variant="subtitle2" sx={cellSx}>
					{t("components.BulkImportModal.status", "状态")}
				</Typography>
				<Typography variant="subtitle2" sx={cellSx}>
					{t("components.BulkImportModal.executable", "启动程序")}
				</Typography>
				<Typography variant="subtitle2" align="center" sx={cellSx}>
					{t("components.BulkImportModal.actions", "操作")}
				</Typography>
			</Box>

			{items.length === 0 ? (
				<Box
					sx={{
						alignItems: "center",
						display: "flex",
						flex: "1 1 auto",
						justifyContent: "center",
						minHeight: 120,
					}}
				>
					{loading ? (
						<Stack spacing={1.5} alignItems="center">
							<CircularProgress size={28} />
							<Typography color="text.secondary">{emptyMessage}</Typography>
						</Stack>
					) : (
						<Typography color="text.secondary">{emptyMessage}</Typography>
					)}
				</Box>
			) : (
				<Box sx={{ flex: "1 1 auto", minHeight: 0, width: "100%" }}>
					<Virtuoso
						style={{ height: "100%", width: "100%" }}
						data={displayRows}
						computeItemKey={(_, item) => item.key}
						overscan={300}
						itemContent={(_, row) => {
							if (row.kind === "group")
								return (
									<Box
										className="px-4 py-1"
										sx={{
											bgcolor: "action.hover",
											borderLeft: 3,
											borderColor: "warning.main",
										}}
									>
										<Typography variant="caption" className="font-semibold">
											{t(
												"components.BulkImportModal.inlineDuplicateGroup",
												"列表内重复（{{count}} 项）",
												{ count: row.count },
											)}
										</Typography>
									</Box>
								);
							const { item } = row;
							const outcome = item.importOutcome;
							const statusLabel = getStatusLabel(item, t);
							const matchedName = getMatchedGameName(
								item.importMode === "custom" ? undefined : item.matchedData,
								i18n.language,
							);
							const directoryPath = item.path;
							return (
								<Box
									data-bulk-item-key={item.key}
									sx={{
										...gridSx,
										borderBottom: 1,
										borderColor: "divider",
										boxShadow: row.grouped
											? "inset 3px 0 var(--mui-palette-warning-main)"
											: undefined,
									}}
									className="min-h-11 px-4 py-0.5"
								>
									{directoryPath ? (
										<ButtonBase
											type="button"
											disableRipple
											onClick={() => onOpenDirectory(directoryPath)}
											aria-label={`${t(
												"components.Toolbar.openGameFolder",
												"打开游戏目录",
											)}: ${item.name}`}
											className="inline-flex w-fit max-w-full min-w-0 justify-self-start items-center justify-start text-left transition-colors duration-200"
											sx={{
												color: "text.primary",
												"&:hover, &.Mui-focusVisible": {
													color: "primary.dark",
												},
												"&:hover .bulk-import-folder-icon, &.Mui-focusVisible .bulk-import-folder-icon":
													{
														opacity: 1,
													},
											}}
										>
											<Typography
												component="span"
												variant="body2"
												className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
												title={item.name}
											>
												{item.name}
											</Typography>
											<FolderOpenRoundedIcon
												className="bulk-import-folder-icon ml-1 shrink-0 opacity-0 transition-opacity duration-200"
												fontSize="small"
											/>
										</ButtonBase>
									) : (
										<Typography variant="body2" sx={cellSx} title={item.name}>
											{item.name}
										</Typography>
									)}
									<Typography variant="body2" sx={cellSx} title={matchedName}>
										{matchedName ?? "-"}
									</Typography>
									<Typography
										variant="body2"
										noWrap
										title={statusLabel}
										color={
											outcome?.kind === "duplicate"
												? "warning.main"
												: outcome?.kind === "error"
													? "error.main"
													: undefined
										}
									>
										{statusLabel}
									</Typography>
									<Box sx={{ minWidth: 0 }}>
										{item.launch_type === "steam" ? (
											<Typography variant="body2" noWrap title={item.path}>
												Steam · {item.steam_launch_id}
												{item.selectedExe ? ` · ${item.selectedExe}` : ""}
											</Typography>
										) : item.executables.length === 0 ? (
											<Typography variant="body2" color="text.secondary">
												{t(
													"components.BulkImportModal.gameDirectory",
													"游戏目录",
												)}
											</Typography>
										) : item.executables.length === 1 ? (
											<Typography
												variant="body2"
												noWrap
												title={item.executables[0]}
											>
												{item.executables[0]}
											</Typography>
										) : (
											<FormControl size="small" fullWidth>
												<Select
													value={item.selectedExe || ""}
													size="small"
													onChange={(event) =>
														onExecutableChange(item.key, event.target.value)
													}
													displayEmpty
													disabled={loading}
													sx={{
														"& .MuiSelect-select": {
															py: 0.75,
														},
													}}
													renderValue={(selected) => (
														<Typography
															variant="body2"
															noWrap
															color={selected ? undefined : "text.secondary"}
														>
															{selected ||
																t(
																	"components.BulkImportModal.selectExe",
																	"请选择启动程序",
																)}
														</Typography>
													)}
												>
													<MenuItem value="" disabled>
														{t(
															"components.BulkImportModal.selectExe",
															"请选择启动程序",
														)}
													</MenuItem>
													{item.executables.map((exe) => (
														<MenuItem key={exe} value={exe}>
															{exe}
														</MenuItem>
													))}
												</Select>
											</FormControl>
										)}
									</Box>
									<Stack direction="row" justifyContent="center">
										<IconButton
											size="small"
											aria-label={t(
												"components.BulkImportModal.editMetadata",
												"编辑游戏信息",
											)}
											onClick={() => onEditItem(item)}
											disabled={loading}
										>
											<EditIcon fontSize="small" />
										</IconButton>
										<IconButton
											size="small"
											aria-label={t(
												"components.BulkImportModal.removeItem",
												"移除项目",
											)}
											onClick={() => onDeleteItem(item.key)}
											disabled={loading}
										>
											<DeleteIcon fontSize="small" />
										</IconButton>
									</Stack>
									{outcome?.kind === "error" ? (
										<Box
											component="details"
											className="col-span-5 min-w-0 pb-1"
											sx={{ color: "error.main" }}
										>
											<summary className="w-fit cursor-pointer text-xs">
												{getFailurePhase(outcome.phase, t)}
											</summary>
											<Typography
												variant="caption"
												component="div"
												className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
											>
												{outcome.message}
											</Typography>
										</Box>
									) : null}
								</Box>
							);
						}}
					/>
				</Box>
			)}
		</Box>
	);
}
