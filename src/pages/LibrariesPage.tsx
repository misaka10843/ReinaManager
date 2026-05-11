import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { VirtualCardsGrid } from "@/components/Cards";
import { useGameListFacade } from "@/hooks/features/games/useGameListFacade";
import { getUserErrorMessage } from "@/utils/errors";

export const Libraries: React.FC = () => {
	const { t } = useTranslation();
	const { gameIds, isLoading, isError, error } = useGameListFacade();

	if (isLoading) {
		return (
			<Box className="flex flex-1 items-center justify-center">
				<CircularProgress />
			</Box>
		);
	}

	if (isError) {
		return (
			<Alert severity="error" className="m-4">
				{getUserErrorMessage(error, t)}
			</Alert>
		);
	}

	return <VirtualCardsGrid gameIds={gameIds} />;
};
