import { CardsGrid } from "@/components/Cards";
import { useScrollRestore } from "@/hooks/common/useScrollRestore";
import { useGameListFacade } from "@/hooks/features/games/useGameListFacade";

export const Libraries: React.FC = () => {
	const { gameIds, isLoading } = useGameListFacade();
	useScrollRestore("/libraries", { isLoading });
	return <CardsGrid gameIds={gameIds} />;
};
