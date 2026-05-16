import i18next from "i18next";

export const getLocalDateString = (timestamp?: number): string => {
	const date = timestamp ? new Date(timestamp * 1000) : new Date();
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function formatRelativeTime(time: string | number | Date): string {
	const now = new Date();
	const target =
		time instanceof Date
			? time
			: typeof time === "number"
				? new Date(time * (time.toString().length === 10 ? 1000 : 1))
				: new Date(time);

	const diff = (now.getTime() - target.getTime()) / 1000;

	if (diff < 60) return i18next.t("utils.relativetime.justNow", "刚刚");
	if (diff < 3600) {
		const minutes = Math.floor(diff / 60);
		return i18next.t("utils.relativetime.minutesAgo", "{{count}}分钟前", {
			count: minutes,
		});
	}
	if (diff < 86400) {
		const hours = Math.floor(diff / 3600);
		return i18next.t("utils.relativetime.hoursAgo", "{{count}}小时前", {
			count: hours,
		});
	}
	if (diff < 7 * 86400) {
		const days = Math.floor(diff / 86400);
		return i18next.t("utils.relativetime.daysAgo", "{{count}}天前", {
			count: days,
		});
	}

	const nowWeek = getWeekNumber(now);
	const targetWeek = getWeekNumber(target);
	if (
		now.getFullYear() === target.getFullYear() &&
		nowWeek - targetWeek === 1
	) {
		return i18next.t("utils.relativetime.lastWeek", "上周");
	}

	return target.toLocaleDateString();
}

function getWeekNumber(date: Date): number {
	const firstDay = new Date(date.getFullYear(), 0, 1);
	const dayOfYear = (date.getTime() - firstDay.getTime()) / 86400000 + 1;
	return Math.ceil(dayOfYear / 7);
}

export function formatPlayTime(minutes: number): string {
	if (!minutes)
		return i18next.t("utils.formatPlayTime.minutes", "{{count}}分钟", {
			count: 0,
		});

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;

	if (hours >= 100) {
		const totalHoursAsFloat = Math.floor((minutes / 60) * 10) / 10;
		return i18next.t("utils.formatPlayTime.hours", "{{count}}小时", {
			count: totalHoursAsFloat,
		});
	}

	if (hours === 0) {
		return i18next.t("utils.formatPlayTime.minutes", "{{count}}分钟", {
			count: mins,
		});
	}

	if (mins > 0) {
		return i18next.t(
			"utils.formatPlayTime.hoursAndMinutes",
			"{{hours}}小时{{minutes}}分钟",
			{
				hours,
				minutes: mins,
			},
		);
	}
	return i18next.t("utils.formatPlayTime.hours", "{{count}}小时", {
		count: hours,
	});
}
