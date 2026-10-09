import { FormControlLabel, Radio, RadioGroup, Switch } from "@mui/material";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { snackbar } from "@/providers/snackBar";
import { applyUiZoom, UI_ZOOM_PRESETS } from "@/services/uiZoom";
import { type StartupPage, useStore } from "@/store/appStore";
import {
	SETTINGS_SELECT_CLASS_NAME,
	SettingsGroup,
	SettingsItem,
} from "./SettingsLayout";

export const LanguageSelect = () => {
	const { t, i18n } = useTranslation(); // 使用i18n实例和翻译函数

	// 语言名称映射
	const languageNames = {
		"zh-CN": "简体中文(zh-CN)",
		"zh-TW": "繁体中文(zh-TW)",
		"en-US": "English(en-US)",
		"ja-JP": "日本語(ja-JP)",
	};

	/**
	 * 处理语言切换
	 * @param {SelectChangeEvent} event
	 */
	const handleChange = (event: SelectChangeEvent) => {
		const newLang = event.target.value;
		i18n.changeLanguage(newLang); // 切换语言
	};

	return (
		<SettingsItem title={t("pages.Settings.language", "语言")}>
			<Select
				id="language-select"
				value={i18n.language}
				onChange={handleChange}
				className={SETTINGS_SELECT_CLASS_NAME}
				size="small"
				renderValue={(value) =>
					languageNames[value as keyof typeof languageNames]
				}
			>
				<MenuItem value="zh-CN">简体中文(zh-CN)</MenuItem>
				<MenuItem value="zh-TW">繁体中文(zh-TW)</MenuItem>
				<MenuItem value="en-US">English(en-US)</MenuItem>
				<MenuItem value="ja-JP">日本語(ja-JP)</MenuItem>
			</Select>
		</SettingsItem>
	);
};

export const StartupPageSettings = () => {
	const { t } = useTranslation();
	const { startupPage, setStartupPage } = useStore(
		useShallow((s) => ({
			startupPage: s.startupPage,
			setStartupPage: s.setStartupPage,
		})),
	);

	const handleChange = (event: SelectChangeEvent<StartupPage>) => {
		setStartupPage(event.target.value as StartupPage);
	};

	return (
		<SettingsItem
			title={t("pages.Settings.startupPage.title", "启动默认页面")}
			description={t(
				"pages.Settings.startupPage.description",
				"下次启动应用时打开的初始页面。",
			)}
		>
			<Select
				id="startup-page-select"
				value={startupPage}
				onChange={handleChange}
				className={SETTINGS_SELECT_CLASS_NAME}
				size="small"
			>
				<MenuItem value="home">{t("app.NAVIGATION.home", "主页")}</MenuItem>
				<MenuItem value="libraries">
					{t("app.NAVIGATION.gameLibrary", "游戏仓库")}
				</MenuItem>
				<MenuItem value="collection">
					{t("app.NAVIGATION.collection", "收藏夹")}
				</MenuItem>
			</Select>
		</SettingsItem>
	);
};

export const InterfaceZoomSettings = () => {
	const { t } = useTranslation();
	const zoomPercent = useStore((state) => state.zoomPercent);
	const options = UI_ZOOM_PRESETS.includes(zoomPercent)
		? UI_ZOOM_PRESETS
		: [...UI_ZOOM_PRESETS, zoomPercent].sort((a, b) => a - b);

	const handleChange = (event: SelectChangeEvent<string>) => {
		void applyUiZoom(Number(event.target.value)).catch((error) => {
			console.error("设置界面缩放失败:", error);
			snackbar.error(t("pages.Settings.interfaceZoomError", "界面缩放失败"));
		});
	};

	return (
		<SettingsItem
			title={t("pages.Settings.interfaceZoom", "界面缩放")}
			description={t(
				"pages.Settings.interfaceZoomDescription",
				"也可使用 Ctrl + 加号/减号或 Ctrl + 滚轮调整。",
			)}
		>
			<Select
				id="interface-zoom-select"
				value={String(zoomPercent)}
				onChange={handleChange}
				className={SETTINGS_SELECT_CLASS_NAME}
				size="small"
			>
				{options.map((percent) => (
					<MenuItem key={percent} value={String(percent)}>
						{percent}%
					</MenuItem>
				))}
			</Select>
		</SettingsItem>
	);
};

const THEME_COLOR_PRESETS = [
	{ name: "teal", color: "#496c78" },
	{ name: "blue", color: "#3568c0" },
	{ name: "violet", color: "#7651b5" },
	{ name: "rose", color: "#bd526c" },
	{ name: "orange", color: "#bd6b32" },
	{ name: "green", color: "#3d8063" },
] as const;

export const ThemeColorSettings = () => {
	const { t } = useTranslation();
	const { themePrimaryColor, setThemePrimaryColor } = useStore(
		useShallow((state) => ({
			themePrimaryColor: state.themePrimaryColor,
			setThemePrimaryColor: state.setThemePrimaryColor,
		})),
	);
	const [draftColor, setDraftColor] = useState(themePrimaryColor);
	useEffect(() => setDraftColor(themePrimaryColor), [themePrimaryColor]);

	return (
		<SettingsGroup
			title={t("pages.Settings.themeColor.title", "主题颜色")}
			description={t(
				"pages.Settings.themeColor.description",
				"选择预设颜色或输入自定义主色，所有主题模式会同步更新。",
			)}
		>
			<div className="flex flex-wrap gap-3">
				{THEME_COLOR_PRESETS.map(({ name, color }) => (
					<button
						key={color}
						type="button"
						aria-label={t(`pages.Settings.themeColor.${name}`, name)}
						aria-pressed={themePrimaryColor.toLowerCase() === color}
						onClick={() => setThemePrimaryColor(color)}
						className="size-9 rounded-full border-2 border-solid border-[var(--mui-palette-divider)] p-1"
						style={{ backgroundColor: color }}
					/>
				))}
			</div>
			<SettingsItem title={t("pages.Settings.themeColor.custom", "自定义颜色")}>
				<div className="flex items-center gap-2">
					<input
						aria-label={t("pages.Settings.themeColor.custom", "自定义颜色")}
						type="color"
						value={themePrimaryColor}
						onChange={(event) => {
							setDraftColor(event.target.value);
							setThemePrimaryColor(event.target.value);
						}}
						className="size-10 cursor-pointer rounded border-0 bg-transparent p-0"
					/>
					<TextField
						value={draftColor}
						onChange={(event) => {
							const color = event.target.value;
							setDraftColor(color);
							if (/^#[0-9a-fA-F]{6}$/.test(color)) setThemePrimaryColor(color);
						}}
						size="small"
						inputProps={{
							maxLength: 7,
							"aria-label": t("pages.Settings.themeColor.hex", "十六进制颜色"),
						}}
					/>
				</div>
			</SettingsItem>
		</SettingsGroup>
	);
};

export const NsfwSettings = () => {
	const { t } = useTranslation();
	const { nsfwFilter, setNsfwFilter, nsfwCoverReplace, setNsfwCoverReplace } =
		useStore(
			useShallow((s) => ({
				nsfwFilter: s.nsfwFilter,
				setNsfwFilter: s.setNsfwFilter,
				nsfwCoverReplace: s.nsfwCoverReplace,
				setNsfwCoverReplace: s.setNsfwCoverReplace,
			})),
		);

	return (
		<SettingsGroup title={t("pages.Settings.nsfw.title", "NSFW 设置")}>
			<SettingsItem title={t("pages.Settings.nsfw.filter", "过滤 NSFW 内容")}>
				<Switch
					checked={nsfwFilter}
					onChange={(e) => setNsfwFilter(e.target.checked)}
					color="primary"
				/>
			</SettingsItem>
			<SettingsItem
				title={t("pages.Settings.nsfw.coverReplace", "NSFW 封面替换")}
			>
				<Switch
					checked={nsfwCoverReplace}
					onChange={(e) => setNsfwCoverReplace(e.target.checked)}
					color="primary"
				/>
			</SettingsItem>
		</SettingsGroup>
	);
};

export const CardClickModeSettings = () => {
	const { t } = useTranslation();
	const { cardClickMode, setCardClickMode } = useStore(
		useShallow((s) => ({
			cardClickMode: s.cardClickMode,
			setCardClickMode: s.setCardClickMode,
		})),
	);

	return (
		<SettingsGroup
			title={t("pages.Settings.cardClickMode.title", "卡片点击模式")}
			description={t(
				"pages.Settings.cardClickMode.description",
				"仓库与收藏夹游戏卡片单击的行为（两种模式下均可双击游戏卡片启动游戏）。",
			)}
		>
			<Box>
				<RadioGroup
					value={cardClickMode}
					onChange={(e) =>
						setCardClickMode(e.target.value as "navigate" | "select")
					}
				>
					<FormControlLabel
						value="navigate"
						control={<Radio color="primary" />}
						label={t(
							"pages.Settings.cardClickMode.navigate",
							"导航模式（单击跳转详情页）",
						)}
						className="mb-1"
					/>
					<FormControlLabel
						value="select"
						control={<Radio color="primary" />}
						label={t(
							"pages.Settings.cardClickMode.select",
							"选择模式（单击选择游戏）",
						)}
						className="mb-1"
					/>
				</RadioGroup>
			</Box>
		</SettingsGroup>
	);
};
