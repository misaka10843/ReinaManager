/**
 * @file GameSelectDialog 组件
 * @description 游戏选择列表弹窗组件，用于展示搜索结果列表供用户选择
 * @module src/components/AddModal/GameSelectDialog
 * @author ReinaManager
 * @copyright AGPL-3.0
 */

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { FullGameData } from "@/types";

interface GameSelectDialogProps {
	open: boolean;
	onClose: () => void;
	results: FullGameData[];
	onSelect: (index: number) => void;
	loading?: boolean;
	title?: string;
	dataSource: "bgm" | "vndb" | "ymgal";
}

/**
 * 从 FullGameData 中提取显示信息
 */
function extractDisplayInfo(
	item: FullGameData,
	dataSource: "bgm" | "vndb" | "ymgal",
): {
	id: string;
	name: string;
	name_cn: string | null;
	image: string | null;
	developer: string | null;
	date: string | null;
} {
	const data =
		dataSource === "bgm"
			? item.bgm_data
			: dataSource === "vndb"
				? item.vndb_data
				: item.ymgal_data;
	return {
		id:
			dataSource === "bgm"
				? item.bgm_id || ""
				: dataSource === "vndb"
					? item.vndb_id || ""
					: item.ymgal_id || "",
		name: data?.name || "",
		name_cn: data?.name_cn || null,
		image: data?.image || null,
		developer: data?.developer || null,
		date: item.date || null,
	};
}

/**
 * 游戏选择列表弹窗组件
 */
const GameSelectDialog: React.FC<GameSelectDialogProps> = ({
	open,
	onClose,
	results,
	onSelect,
	loading = false,
	title,
	dataSource,
}) => {
	const { t } = useTranslation();

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			fullWidth
			aria-labelledby="game-select-dialog-title"
		>
			<DialogTitle id="game-select-dialog-title">
				{title || t("components.AddModal.selectGame", "选择游戏")}
			</DialogTitle>
			<DialogContent dividers>
				{loading ? (
					<Box className="flex justify-center items-center py-8">
						<CircularProgress />
					</Box>
				) : results.length === 0 ? (
					<Typography className="text-center py-4" color="text.secondary">
						{t("components.AddModal.noResults", "没有找到结果")}
					</Typography>
				) : (
					<List className="max-h-[400px] overflow-auto">
						{results.map((item, index) => {
							const displayInfo = extractDisplayInfo(item, dataSource);
							return (
								<ListItemButton
									key={displayInfo.id}
									onClick={() => onSelect(index)}
									className="rounded mb-1"
								>
									<ListItemAvatar>
										{displayInfo.image ? (
											<Box
												component="img"
												src={displayInfo.image}
												alt={displayInfo.name}
												className="w-[60px] h-[80px] object-cover rounded mr-2"
											/>
										) : (
											<Box className="w-[60px] h-[80px] bg-gray-300 rounded mr-2 flex items-center justify-center">
												<Typography variant="caption" color="text.secondary">
													N/A
												</Typography>
											</Box>
										)}
									</ListItemAvatar>
									<ListItemText
										primary={
											<Box>
												<Typography variant="subtitle1" component="span">
													{displayInfo.name_cn || displayInfo.name}
												</Typography>
												{displayInfo.name_cn && displayInfo.name && (
													<Typography
														variant="body2"
														color="text.secondary"
														component="span"
														className="ml-1"
													>
														({displayInfo.name})
													</Typography>
												)}
											</Box>
										}
										secondary={
											<Box component="span" className="flex flex-col gap-1">
												{displayInfo.developer && (
													<Typography
														variant="body2"
														color="text.secondary"
														component="span"
													>
														{t("components.AddModal.developer", "开发商")}:{" "}
														{displayInfo.developer}
													</Typography>
												)}
												<Box
													component="span"
													className="flex items-center gap-2"
												>
													{displayInfo.date && (
														<Typography
															variant="caption"
															color="text.secondary"
															component="span"
														>
															{displayInfo.date}
														</Typography>
													)}
													<Typography
														variant="caption"
														color="primary"
														component="span"
													>
														{dataSource === "bgm"
															? `BGM: ${displayInfo.id}`
															: dataSource === "vndb"
																? `VNDB: ${displayInfo.id}`
																: `YMGal: ${displayInfo.id}`}
													</Typography>
												</Box>
											</Box>
										}
									/>
								</ListItemButton>
							);
						})}
					</List>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default GameSelectDialog;
