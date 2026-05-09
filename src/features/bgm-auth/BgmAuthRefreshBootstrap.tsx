import { useEffect } from "react";
import { initBgmAuthRefresh } from "./bgmAuthSession";

export const BgmAuthRefreshBootstrap = () => {
	useEffect(() => {
		void initBgmAuthRefresh();
	}, []);

	return null;
};
