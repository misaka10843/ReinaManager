import { useStore } from "@/store";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Box, TextField, Button, Stack, Select, MenuItem, InputLabel, FormControl, CircularProgress } from "@mui/material"; // 添加 CircularProgress
import { fetchFromBgm } from "@/api/bgm";
import { fetchFromVNDB } from "@/api/vndb";
import type { GameData } from "@/types";
import { ViewUpdateGameBox } from "@/components/AlertBox";
import { handleDirectory } from "@/utils";
import { updateGameLocalPath } from "@/utils/repository";

/**
 * Edit 组件
 * 游戏信息编辑页面，加载指定游戏数据并展示（当前仅展示名称）。
 *
 * @component
 * @returns {JSX.Element} 编辑页面
 */
export const Edit = (): JSX.Element => {
    const { bgmToken, getGameById, updateGame } = useStore();
    const [bgmId, setBgmId] = useState<string>("");
    const [vndbId, setVndbId] = useState<string>("");
    // 移除了 gameID 状态，因为它可以在 fetch 函数内部派生
    const [gameData, setGameData] = useState<GameData | string | null>(null); // 用于存储获取到的游戏数据或错误信息
    const [idType, setIdType] = useState<string>("");
    const [openViewBox, setOpenViewBox] = useState(false); // 控制预览弹窗的打开状态
    const [isLoading, setIsLoading] = useState(false); // 添加加载状态
    const [fetchError, setFetchError] = useState<string | null>(null); // 可选：用于存储和显示获取错误
    const [localPath, setLocalPath] = useState<string>(""); // 用于存储可执行文件路径

    const id = Number(useLocation().pathname.split('/').pop()); // 从 URL 获取游戏 ID

    // 重构的数据获取逻辑：现在只负责获取数据并返回 GameData 或错误字符串
    const fetchGameData = async (): Promise<GameData | string> => {
        let fetchedData: GameData | string | null = null;
        const currentBgmId = bgmId; // 直接使用 state 中的 ID
        const currentVndbId = vndbId; // 直接使用 state 中的 ID

        switch (idType) {
            case "bgm": {
                if (!currentBgmId) return "Bangumi ID 不能为空"; // 处理 ID 为空的情况
                try {
                    // 确保 fetchFromBgm 能正确处理 ID
                    fetchedData = await fetchFromBgm(currentBgmId, bgmToken, currentBgmId); // 正确传递 bgmId
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "未知错误";
                    console.error("Bangumi 数据获取失败:", errorMessage);
                    fetchedData = `Bangumi 获取错误: ${errorMessage}`; // 返回错误信息
                }
                break;
            }
            case "vndb": {
                if (!currentVndbId) return "VNDB ID 不能为空"; // 处理 ID 为空的情况
                try {
                    // 确保 fetchFromVNDB 能正确处理 ID
                    fetchedData = await fetchFromVNDB(currentVndbId, currentVndbId); // 正确传递 vndbId
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "未知错误";
                    console.error("VNDB 数据获取失败:", errorMessage);
                    fetchedData = `VNDB 获取错误: ${errorMessage}`; // 返回错误信息
                }
                break;
            }
            // case "mixed": {
            //  // 如果需要，实现 mixed 逻辑，确保返回 GameData 或 string
            //  fetchedData = "混合模式未实现";
            //  break;
            // }
            case "custom": {
                fetchedData = "自定义模式无法从数据源更新。";
                break;
            }
            default:
                fetchedData = "选择了无效的数据源。"; // 默认错误
                break;
        }

        // 确保总是返回 GameData 或字符串错误信息
        return fetchedData ?? "未获取到数据或数据源无效。";
    };

    // Effect：用于加载初始的游戏 ID
    useEffect(() => {
        getGameById(id)
            .then(data => {
                if (data) {
                    setBgmId(data.bgm_id || "");
                    setVndbId(data.vndb_id || "");
                    setIdType(data.id_type || "");
                    setLocalPath(data.localpath || ""); // 设置初始的可执行文件路径
                } else {
                    console.error("未找到游戏数据");
                    setFetchError("未找到指定 ID 的游戏数据"); // 可以设置错误状态
                }
            })
            .catch(error => {
                console.error('获取初始游戏数据失败:', error);
                setFetchError(`获取初始数据失败: ${error instanceof Error ? error.message : error}`); // 设置错误状态
            });
    }, [id, getGameById]); // 依赖项：仅在 id 或 getGameById 变化时执行

    // Effect：用于在 gameData 状态成功更新 *之后* 打开对话框
    useEffect(() => {
        // 仅当 gameData 更新为一个有效的 GameData 对象 (非 null, 非 string) 且不在加载中时打开
        if (gameData && typeof gameData !== 'string' && !isLoading) {
            setOpenViewBox(true);
            setFetchError(null); // 如果成功获取，清除之前的错误
        } else if (typeof gameData === 'string' && !isLoading) {
            // 处理 gameData 是错误字符串的情况
            console.error("获取错误:", gameData);
            setFetchError(gameData); // 设置错误状态，以便在 UI 中显示
            setOpenViewBox(false); // 确保错误时不打开对话框
        }
        // 这里特意没有将 isLoading 作为依赖项，
        // 因为我们只想在 gameData *本身* 发生变化时触发此效果。
        // !isLoading 的检查是为了防止在新的获取请求可能刚开始时就打开对话框。

    }, [gameData, isLoading]); // 依赖项：仅在 gameData 变化时执行

    // 按钮点击处理函数：启动获取流程并设置状态
    const handleUpdateClick = async () => {
        setIsLoading(true); // 设置加载状态为 true
        setFetchError(null); // 清除之前的错误信息
        setGameData(null); // 清除旧数据，确保 useEffect 能检测到变化
        setOpenViewBox(false); // 如果对话框已打开，先关闭

        const result = await fetchGameData(); // 获取数据

        // 设置结果（可能是 GameData 或错误字符串）
        // 上面的 useEffect Hook 会根据这个结果来决定是否打开对话框
        setGameData(result);

        setIsLoading(false); // 设置加载状态为 false
    };

    // 添加一个处理修改可执行文件路径的函数
    const handleUpdateLocalPath = async () => {
        if (!localPath) {
            console.error("路径不能为空");
            return;
        }
        try {
            await updateGameLocalPath(id, localPath);
            console.log("可执行文件路径已更新");
        } catch (error) {
            console.error("更新可执行文件路径失败:", error);
        }
    };

    // 添加一个处理选择可执行文件路径的函数
    const handleSelectLocalPath = async () => {
        const selectedPath = await handleDirectory();
        if (selectedPath) {
            setLocalPath(selectedPath);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* 如果有获取错误，显示错误信息 */}
            {fetchError && <p style={{ color: 'red' }}>错误: {fetchError}</p>}

            <ViewUpdateGameBox
                open={openViewBox}
                setOpen={setOpenViewBox}
                onConfirm={() => {
                    if (gameData && typeof gameData !== 'string') {
                        updateGame(id, gameData).then(() => {
                        });
                        setOpenViewBox(false); // 确认后关闭对话框
                    }
                }}
                // 传递 gameData state。ViewUpdateGameBox 需要能正确处理 null/string 的情况。
                game={gameData}
            />
            <Stack spacing={3}>
                {/* ID 类型选择框 */}
                <FormControl fullWidth disabled={isLoading}> {/* 加载时禁用 */}
                    <InputLabel id="id-type-label">数据源</InputLabel>
                    <Select
                        labelId="id-type-label"
                        value={idType}
                        onChange={(e) => setIdType(e.target.value)}
                        label="数据源" // 保持和 InputLabel 一致
                    >
                        <MenuItem value="bgm">Bangumi</MenuItem>
                        <MenuItem value="vndb">VNDB</MenuItem>
                        {/* <MenuItem value="mixed">Mixed</MenuItem> */}
                        <MenuItem value="custom">Custom</MenuItem>
                    </Select>
                </FormControl>

                {/* Bangumi ID 编辑框 */}
                {idType !== "vndb" && idType !== "custom" && (
                    <TextField
                        label="Bangumi ID"
                        variant="outlined"
                        fullWidth
                        value={bgmId}
                        onChange={(e) => setBgmId(e.target.value)}
                        disabled={isLoading} // 加载时禁用
                    />
                )}

                {/* VNDB ID 编辑框 */}
                {idType !== "bgm" && idType !== "custom" && (
                    <TextField
                        label="VNDB ID"
                        variant="outlined"
                        fullWidth
                        value={vndbId}
                        onChange={(e) => setVndbId(e.target.value)}
                        disabled={isLoading} // 加载时禁用
                    />
                )}
                {/* 更新按钮 */}
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    disabled={idType === "custom" || isLoading} // Custom 模式或加载时禁用
                    onClick={handleUpdateClick} // 使用新的处理函数
                    startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null} // 显示加载图标
                >
                    {isLoading ? "正在获取..." : "从数据源更新数据"}
                </Button>

                {/* 显示和修改可执行文件路径 */}
                <TextField
                    label="可执行文件路径"
                    variant="outlined"
                    fullWidth
                    value={localPath}
                    onClick={handleSelectLocalPath} // 点击时打开文件选择对话框
                    InputProps={{ readOnly: true }} // 设置为只读
                    disabled={isLoading} // 加载时禁用
                />


                {/* 确保在更新路径的按钮中调用 handleUpdateLocalPath */}
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleUpdateLocalPath} // 调用更新路径函数
                    disabled={isLoading || !localPath} // 加载时禁用或路径为空时禁用
                >
                    更新可执行文件路径
                </Button>
            </Stack>
        </Box>
    );
};