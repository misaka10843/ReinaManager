import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import type { SxProps, Theme } from "@mui/material/styles";
import type { apiSourceType } from "@/types";

interface ApiSourceRadioGroupProps {
	value: apiSourceType;
	onChange: (value: apiSourceType) => void;
	disabled?: boolean;
	row?: boolean;
	sx?: SxProps<Theme>;
}

const API_SOURCE_OPTIONS: { value: apiSourceType; label: string }[] = [
	{ value: "bgm", label: "Bangumi" },
	{ value: "vndb", label: "VNDB" },
	{ value: "ymgal", label: "YMGal" },
	{ value: "kun", label: "Kun" },
	{ value: "mixed", label: "Mixed" },
];

export function ApiSourceRadioGroup({
	value,
	onChange,
	disabled = false,
	row = true,
	sx,
}: ApiSourceRadioGroupProps) {
	return (
		<RadioGroup
			row={row}
			value={value}
			sx={sx}
			onChange={(event) => onChange(event.target.value as apiSourceType)}
		>
			{API_SOURCE_OPTIONS.map((option) => (
				<FormControlLabel
					key={option.value}
					value={option.value}
					control={<Radio />}
					label={option.label}
					disabled={disabled}
				/>
			))}
		</RadioGroup>
	);
}
