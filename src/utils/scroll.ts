import { setScrollPosition } from "@/hooks/common/useScrollRestore";

export const saveScrollPosition = (path: string) => {
	const SCROLL_CONTAINER_SELECTOR = "main";
	const container = document.querySelector<HTMLElement>(
		SCROLL_CONTAINER_SELECTOR,
	);

	if (container && container.scrollHeight > container.clientHeight) {
		setScrollPosition(path, container.scrollTop);
	}
};
