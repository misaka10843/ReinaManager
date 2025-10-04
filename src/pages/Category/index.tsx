import { Outlet } from "react-router";
import { useScrollRestore } from "@/hooks/useScrollRestore";

export const Category: React.FC = () => {
	useScrollRestore('/category');
	return (
		<Outlet />
	);
};