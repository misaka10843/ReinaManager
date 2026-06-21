import { alpha, createTheme } from "@mui/material/styles";

export const reinaTheme = createTheme({
	cssVariables: {
		colorSchemeSelector: "data-toolpad-color-scheme",
	},
	colorSchemes: {
		light: {
			palette: {
				background: {
					default: "#f8fafc",
					paper: "#ffffff",
				},
				text: {
					primary: "#1d2733",
					secondary: "#657385",
				},
				divider: "rgba(120, 135, 156, 0.22)",
			},
		},
		dark: {
			palette: {
				background: {
					default: "#121820",
					paper: "#181e28",
				},
				text: {
					primary: "#eef4f7",
					secondary: "#a8b6c2",
				},
				divider: "rgba(210, 224, 236, 0.16)",
			},
		},
	},
	shape: {
		borderRadius: 20,
	},
	typography: {
		button: {
			fontWeight: 700,
			textTransform: "none",
		},
	},
	components: {
		MuiPaper: {
			styleOverrides: {
				root: {
					backgroundImage: "none",
					backgroundColor: "var(--mui-palette-background-paper)",
				},
			},
		},
		MuiCard: {
			styleOverrides: {
				root: {
					borderRadius: 20,
					backgroundColor: "var(--mui-palette-background-paper)",
					backgroundImage: "none",
				},
			},
		},
		MuiAvatar: {
			styleOverrides: {
				rounded: {
					borderRadius: 8,
				},
			},
		},
		MuiButton: {
			defaultProps: {
				disableElevation: true,
			},
			styleOverrides: {
				root: {
					borderRadius: 999,
				},
				sizeMedium: {
					minHeight: 38,
				},
				contained: ({ ownerState, theme }) => ({
					...(ownerState.size === "medium" && {
						paddingInline: 18,
					}),
					backgroundImage: "none",
					...(ownerState.color === "primary" && {
						boxShadow: `0 12px 24px ${alpha("#496c78", 0.18)}`,
					}),
					...(ownerState.color === "error" && {
						boxShadow: `0 12px 24px ${alpha(theme.palette.error.main, 0.18)}`,
					}),
				}),
				outlined: ({ ownerState }) => ({
					...(ownerState.size === "medium" && {
						paddingInline: 18,
					}),
					backgroundColor: "transparent",
					...(ownerState.color === "primary" && {
						borderColor: "var(--mui-palette-divider)",
						color: "var(--mui-palette-text-primary)",
						"&:hover": {
							backgroundColor: "rgba(111, 143, 159, 0.08)",
							borderColor: "var(--mui-palette-primary-main)",
							color: "var(--mui-palette-primary-main)",
						},
					}),
				}),
			},
		},
		MuiIconButton: {
			styleOverrides: {
				root: ({ theme }) => ({
					borderRadius: 12,
					transition: "all 0.2s ease-in-out",
					"&:hover": {
						backgroundColor: "rgba(0,0,0,0.08)",
					},
					...theme.applyStyles("dark", {
						"&:hover": {
							backgroundColor: "rgba(255,255,255,0.12)",
						},
					}),
				}),
			},
		},
		MuiDialog: {
			styleOverrides: {
				paper: ({ theme }) => ({
					outline: 0,
					"&:focus": {
						outline: 0,
					},
					"&:focus-visible": {
						outline: 0,
					},
					borderRadius: 24,
					backgroundImage: "none",
					backgroundColor: "var(--mui-palette-background-paper)",
					border: "1px solid var(--mui-palette-divider)",
					boxShadow: `0 24px 64px ${alpha("#587083", 0.16)}`,
					...theme.applyStyles("dark", {
						boxShadow: `0 24px 64px ${alpha("#020617", 0.4)}`,
					}),
				}),
			},
		},
		MuiDialogTitle: {
			styleOverrides: {
				root: {
					fontWeight: 700,
					padding: "24px 24px 16px 24px",
				},
			},
		},
		MuiDialogContent: {
			styleOverrides: {
				root: {
					padding: "16px 24px",
				},
			},
		},
		MuiDialogActions: {
			styleOverrides: {
				root: {
					padding: "16px 24px 24px 24px",
				},
			},
		},
		MuiAppBar: {
			defaultProps: {
				elevation: 0,
			},
			styleOverrides: {
				root: {
					backgroundColor: "var(--mui-palette-background-paper)",
					backgroundImage: "none",
					borderBottom: "1px solid var(--mui-palette-divider)",
					color: "var(--mui-palette-text-primary)",
				},
			},
		},
		MuiMenu: {
			styleOverrides: {
				paper: {
					borderRadius: 8,
					padding: 4,
				},
				list: {
					paddingBlock: 4,
				},
			},
		},
		MuiPopover: {
			styleOverrides: {
				paper: {
					borderRadius: 8,
				},
			},
		},
		MuiAutocomplete: {
			styleOverrides: {
				paper: {
					borderRadius: 8,
				},
			},
		},
		MuiOutlinedInput: {
			styleOverrides: {
				root: {
					"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
						borderWidth: "1px",
					},
				},
			},
		},
		MuiAccordion: {
			styleOverrides: {
				root: {
					backgroundImage: "none",
					backgroundColor: "var(--mui-palette-background-paper)",
					boxShadow: "none",
					border: "1px solid var(--mui-palette-divider)",
					"&:before": {
						display: "none",
					},
				},
			},
		},
		MuiTooltip: {
			styleOverrides: {
				tooltip: {
					backgroundColor: "var(--mui-palette-text-primary)",
					color: "var(--mui-palette-background-default)",
					borderRadius: 8,
				},
			},
		},
		MuiSwitch: {
			styleOverrides: {
				root: {
					width: 40,
					height: 24,
					padding: 0,
					margin: "0 8px",
					display: "flex",
					"&:active": {
						"& .MuiSwitch-thumb": {
							width: 24,
						},
						"& .MuiSwitch-switchBase.Mui-checked": {
							transform: "translateX(12px)",
						},
					},
				},
				sizeSmall: {
					width: 32,
					height: 20,
					margin: "0 4px",
					"& .MuiSwitch-switchBase": {
						padding: 2,
						"&.Mui-checked": {
							transform: "translateX(12px)",
						},
					},
					"& .MuiSwitch-thumb": {
						width: 16,
						height: 16,
					},
					"&:active": {
						"& .MuiSwitch-thumb": {
							width: 20,
						},
						"& .MuiSwitch-switchBase.Mui-checked": {
							transform: "translateX(8px)",
						},
					},
				},
				switchBase: ({ theme }) => ({
					padding: 2,
					"&.Mui-checked": {
						transform: "translateX(16px)",
						color: "#fff",
						"& + .MuiSwitch-track": {
							opacity: 1,
							backgroundColor: "var(--mui-palette-primary-main)",
							...theme.applyStyles("dark", {
								backgroundColor: "var(--mui-palette-primary-main)",
							}),
						},
					},
				}),
				thumb: {
					width: 20,
					height: 20,
					borderRadius: 10,
					boxShadow: "0 2px 4px 0 rgb(0 35 11 / 20%)",
					transition: "width 200ms",
				},
				track: ({ theme }) => ({
					borderRadius: 12,
					opacity: 1,
					backgroundColor: "rgba(0,0,0,.2)",
					boxSizing: "border-box",
					...theme.applyStyles("dark", {
						backgroundColor: "rgba(255,255,255,.35)",
					}),
				}),
			},
		},
		MuiMenuItem: {
			styleOverrides: {
				root: {
					borderRadius: 6,
					gap: 10,
					marginBlock: 2,
					marginLeft: 4,
					marginRight: 4,
					paddingLeft: 8,
					paddingRight: 8,
					minHeight: 32,
					"& .MuiSwitch-root": {
						margin: 0,
					},
				},
			},
		},
		MuiSelect: {
			styleOverrides: {
				root: {
					borderRadius: 14,
				},
			},
		},
		MuiBreadcrumbs: {
			styleOverrides: {
				root: {
					"& .MuiBreadcrumbs-separator": {
						color: "var(--mui-palette-text-secondary)",
					},
				},
				li: {
					"& .MuiLink-root": {
						color: "var(--mui-palette-text-primary)",
						textDecoration: "none",
						transition: "color 0.2s ease-in-out",
						fontWeight: 400,
						cursor: "pointer",
						"&:hover": {
							color: "var(--mui-palette-primary-main)",
							textDecoration: "none",
						},
					},
					"& .MuiTypography-root:not(.MuiLink-root)": {
						color: "var(--mui-palette-text-primary)",
						fontWeight: 700,
					},
				},
			},
		},
		MuiInputBase: {
			styleOverrides: {
				root: {
					"& .MuiInputAdornment-root": {
						userSelect: "none",
						WebkitUserSelect: "none",
					},
				},
				input: {
					"&::placeholder": {
						userSelect: "none",
						WebkitUserSelect: "none",
					},
				},
			},
		},
	},
});
