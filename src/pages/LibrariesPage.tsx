import { VirtualCardsGrid } from "@/components/Cards";
import { useGameListFacade } from "@/hooks/features/games/useGameListFacade";

export const Libraries: React.FC = () => {
	const { gameIds } = useGameListFacade();
	return <VirtualCardsGrid gameIds={gameIds} />;
};
