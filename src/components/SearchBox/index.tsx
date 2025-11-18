/**
 * @file SearchBox 组件
 * @description 游戏库顶部搜索框组件，支持输入关键字实时搜索，集成防抖、清空、国际化等功能。
 * @module src/components/SearchBox/index
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - SearchBox：游戏搜索输入框组件
 *
 * 依赖：
 * - @mui/material
 * - @mui/icons-material
 * - @/store
 * - react-i18next
 */

import { Clear as ClearIcon, Search as SearchIcon } from "@mui/icons-material";
import {
	Autocomplete,
	IconButton,
	InputAdornment,
	TextField,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useStore } from "@/store";
import { getSearchSuggestions } from "@/utils/enhancedSearch";

/**
 * SearchBox 组件
 * 用于输入关键字实时搜索游戏，支持防抖、清空、国际化。
 *
 * @component
 * @returns {JSX.Element} 搜索输入框
 */
export const SearchBox = () => {
	const { t, i18n } = useTranslation();
	const { searchKeyword, setSearchKeyword, games, allGames } = useStore();
	const [keyword, setKeyword] = useState(searchKeyword);
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const [hasInput, setHasInput] = useState(false);

	// 根据语言动态调整搜索框宽度和样式
	const getSearchBoxStyle = () => {
		const language = i18n.language;
		// 中文（简体和繁体）
		if (language.startsWith("zh")) {
			return { width: "clamp(220px, 28vw, 400px)" };
		}
		// 日语
		if (language === "ja-JP") {
			return { width: "clamp(175px, 17vw, 400px)"  };
		}
		// 英语
		return { width: "clamp(200px, 20vw, 400px)" };
	};

	const searchBoxStyle = getSearchBoxStyle();

	// 对输入值应用防抖
	const debouncedKeyword = useDebouncedValue(keyword, 300);
	const debouncedSuggestions = useDebouncedValue(keyword, 150); // 建议的防抖时间更短

	/**
	 * 执行搜索
	 * @param {string} term 搜索关键字
	 */
	const performSearch = useCallback(
		(term: string) => {
			setSearchKeyword(term);
		},
		[setSearchKeyword],
	);

	// 同步全局状态
	useEffect(() => {
		setKeyword(searchKeyword);
		setHasInput(Boolean(searchKeyword?.trim()));
	}, [searchKeyword]);

	// 当防抖后的关键字变化时，执行搜索
	useEffect(() => {
		performSearch(debouncedKeyword);
	}, [debouncedKeyword, performSearch]);

	// 生成搜索建议
	useEffect(() => {
		if (
			debouncedSuggestions &&
			debouncedSuggestions.trim() !== "" &&
			debouncedSuggestions.length > 1
		) {
			try {
				// 使用所有游戏数据来生成建议，而不仅仅是当前显示的游戏
				const searchSuggestions = getSearchSuggestions(
					allGames.length > 0 ? allGames : games,
					debouncedSuggestions,
					8,
				);
				setSuggestions(searchSuggestions);
			} catch (error) {
				console.error("生成搜索建议失败:", error);
				setSuggestions([]);
			}
		} else {
			setSuggestions([]);
		}
	}, [debouncedSuggestions, allGames, games]);

	/**
	 * 处理焦点事件
	 */
	const handleFocus = useCallback(() => {
		setIsFocused(true);
	}, []);

	const handleBlur = useCallback(() => {
		setIsFocused(false);
		// 如果没有输入内容，延迟收缩
		if (!keyword.trim()) {
			setTimeout(() => {
				setHasInput(false);
			}, 200);
		}
	}, [keyword]);

	/**
	 * 处理自动完成选择
	 * @param {React.SyntheticEvent} _event 事件对象
	 * @param {string | null} value 选择的值
	 */
	const handleAutocompleteChange = useCallback(
		(_event: React.SyntheticEvent, value: string | null) => {
			if (value) {
				setKeyword(value);
				setHasInput(true);
				performSearch(value);
				setIsOpen(false);
			}
		},
		[performSearch],
	);

	/**
	 * 处理键盘事件 - 确保不干扰正常的快捷键
	 */
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			// 对于所有 Ctrl 组合键，都不阻止默认行为
			if (event.ctrlKey) {
				return; // 允许 Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X 等
			}

			// ESC 键关闭建议
			if (event.key === "Escape") {
				setIsOpen(false);
				event.stopPropagation();
				return;
			}

			// Enter 键执行搜索并关闭建议
			if (event.key === "Enter") {
				if (isOpen) {
					// 如果下拉框打开，让 Autocomplete 处理选择
					return;
				} else {
					// 如果下拉框关闭，执行搜索
					performSearch(keyword);
					setIsOpen(false);
					event.stopPropagation();
				}
			}
		},
		[isOpen, keyword, performSearch],
	);

	/**
	 * 清除搜索内容
	 */
	const handleClear = () => {
		setKeyword("");
		setSuggestions([]);
		setIsOpen(false);
		setHasInput(false);
		// 清除后立即搜索，不用等待防抖
		performSearch("");
	};

	return (
		<div
			className="overflow-visible" 
			style={searchBoxStyle}
		>
			<Autocomplete
				freeSolo
				open={isOpen && suggestions.length > 0}
				onOpen={() => setIsOpen(true)}
				onClose={() => setIsOpen(false)}
				options={suggestions}
				inputValue={keyword}
				selectOnFocus={false}
				clearOnBlur={false}
				handleHomeEndKeys={false}
				blurOnSelect={false}
				onInputChange={(_event, newInputValue, reason) => {
					if (reason === "input") {
						setKeyword(newInputValue);
						setHasInput(Boolean(newInputValue.trim()));
						setIsOpen(true);
					} else if (reason === "clear") {
						handleClear();
					}
				}}
				onChange={handleAutocompleteChange}
				className="w-full"
				sx={{
					"& .MuiOutlinedInput-root": {
						transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
						"&:hover": {
							boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
							"& .MuiOutlinedInput-notchedOutline": {
								borderColor: "rgb(59, 130, 246)",
							},
						},
						"&.Mui-focused": {
							boxShadow: "0 4px 16px rgba(59, 130, 246, 0.2)",
							"& .MuiOutlinedInput-notchedOutline": {
								borderColor: "rgb(59, 130, 246)",
								borderWidth: "2px",
							},
						},
					},
				}}
				renderInput={(params) => (
					<TextField
						{...params}
						variant="outlined"
						size="small"
						aria-label={t("components.SearchBox.searchGame")}
						placeholder={
							isFocused || hasInput
								? t("components.SearchBox.inputGameName")
								: t("components.SearchBox.search")
						}
						onFocus={handleFocus}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						slotProps={{
							input: {
								...params.InputProps,
								className: "transition-all duration-300",
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon
											fontSize="small"
											className={`transition-colors duration-300 ${
												isFocused || keyword ? "text-blue-600" : "text-gray-500"
											}`}
										/>
									</InputAdornment>
								),
								onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
									if (event.ctrlKey || event.metaKey) {
										event.stopPropagation();
									}
									handleKeyDown(event);
								},
							},
						}}
						InputProps={{
							...params.InputProps,
							endAdornment: (
								<>
									{keyword && (
										<InputAdornment position="end">
											<IconButton
												onClick={handleClear}
												size="small"
												aria-label={t("components.SearchBox.clearSearch")}
												className="p-1 hover:bg-gray-100 rounded"
											>
												<ClearIcon fontSize="small" />
											</IconButton>
										</InputAdornment>
									)}
									{params.InputProps.endAdornment}
								</>
							),
						}}
					/>
				)}
				renderOption={(props, option) => {
					const { ...otherProps } = props;
					return (
						<li
							{...otherProps}
							className="flex items-center px-4 py-3 mx-2 my-1 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-blue-100 group"
						>
							<SearchIcon className="w-4 h-4 mr-3 flex-shrink-0 text-blue-600" />
							<span className="flex-1 truncate text-sm group-hover:text-blue-700 transition-colors duration-200">
								{option}
							</span>
						</li>
					);
				}}
				slotProps={{
					paper: {
						className:
							"mt-2 rounded-xl shadow-lg border border-gray-200 bg-white overflow-hidden",
					},
					listbox: {
						className: "max-h-[60vh] py-2",
					},
				}}
			/>
		</div>
	);
};
