/**
 * @file 分组分类相关类型定义
 */

/**
 * 分组（Group）- 一级容器
 */
export interface Group {
	id: number;
	name: string;
	icon?: string;
	sort_order: number;
	created_at?: number;
	updated_at?: number;
}

/**
 * 分类（Category）- 二级容器
 */
export interface Category {
	id: number;
	name: string;
	icon?: string;
	sort_order: number;
	game_count: number;
}

/**
 * 分组与分类的树形结构
 */
export interface GroupWithCategories {
	id: number;
	name: string;
	icon?: string;
	sort_order: number;
	categories: Category[];
}

/**
 * 默认分组类型枚举
 */
export enum DefaultGroup {
	DEVELOPER = "default_developer",
	PLAY_STATUS = "default_play_status",
}

/**
 * 游戏状态枚举（基于 games.clear 字段）
 * 未来 games.clear 将从 1/0 改为 1-5 的枚举值
 */
export enum PlayStatus {
	WISH = 1, // 想玩
	PLAYING = 2, // 在玩
	PLAYED = 3, // 玩过
	ON_HOLD = 4, // 搁置
	DROPPED = 5, // 弃坑
}

/**
 * 游戏状态 i18n key 映射
 */
export const PLAY_STATUS_I18N_KEYS: Record<PlayStatus, string> = {
	[PlayStatus.WISH]: "category.playStatus.wish",
	[PlayStatus.PLAYING]: "category.playStatus.playing",
	[PlayStatus.PLAYED]: "category.playStatus.played",
	[PlayStatus.ON_HOLD]: "category.playStatus.onHold",
	[PlayStatus.DROPPED]: "category.playStatus.dropped",
};

/**
 * 获取游戏状态多语言文案
 */
export function getPlayStatusLabel(
	t: (key: string) => string,
	status: PlayStatus,
): string {
	return t(PLAY_STATUS_I18N_KEYS[status]);
}
