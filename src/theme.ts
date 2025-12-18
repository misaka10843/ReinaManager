import { createTheme, alpha, type ThemeOptions } from "@mui/material/styles";

export type ThemeStyle = "default" | "m3" | "fluent";

// --- Material 3 Palette ---
const m3Palette = {
  primary: {
    main: "#6750A4", // M3 Purple 40
    light: "#EADDFF", // M3 Purple 90
    dark: "#4F378B",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#625B71", // M3 Slate 40
    light: "#E8DEF8",
    dark: "#4A4458",
    contrastText: "#FFFFFF",
  },
  error: {
    main: "#B3261E",
    light: "#F9DEDC",
    dark: "#601410",
  },
  background: {
    default: "#FEF7FF", // M3 Surface
    paper: "#F3EDF7", // M3 Surface Container Low
  },
  text: {
    primary: "#1D1B20",
    secondary: "#49454F",
  },
};

const m3DarkPalette = {
  primary: {
    main: "#D0BCFF", // M3 Purple 80
    light: "#4F378B",
    dark: "#D0BCFF",
    contrastText: "#381E72", // M3 Purple 20
  },
  secondary: {
    main: "#CCC2DC",
    light: "#4A4458",
    dark: "#CCC2DC",
    contrastText: "#332D41",
  },
  background: {
    default: "#141218",
    paper: "#1D1B20",
  },
  text: {
    primary: "#E6E1E5",
    secondary: "#CAC4D0",
  },
};

// --- Fluent UI Palette ---
const fluentPalette = {
  primary: {
    main: "#0067C0", // System Accent (Light)
    light: "#4CC2FF",
    dark: "#005BA1",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#5D5D5D", // Secondary text / icons
    light: "#F3F3F3",
    dark: "#3B3B3B",
    contrastText: "#FFFFFF",
  },
  error: {
    main: "#C50F1F",
  },
  warning: {
    main: "#9D5D00",
  },
  success: {
    main: "#107C10",
  },
  background: {
    default: "#F3F3F3", // Mica / InfoBackground base (approx)
    paper: "#FFFFFF", // Layer on top
  },
  text: {
    primary: "#1B1B1B", // Primary text
    secondary: "#5D5D5D", // Secondary text
    disabled: "#A6A6A6",
  },
  action: {
    active: "#1B1B1B",
    hover: "rgba(0, 0, 0, 0.04)",
    selected: "rgba(0, 0, 0, 0.06)",
    disabled: "rgba(0, 0, 0, 0.36)",
    disabledBackground: "rgba(0, 0, 0, 0.06)",
  },
};

const fluentDarkPalette = {
  primary: {
    main: "#4CC2FF", // System Accent (Dark)
    light: "#4CC2FF",
    dark: "#0067C0",
    contrastText: "#000000",
  },
  secondary: {
    main: "#A6A6A6",
    light: "#3B3B3B",
    dark: "#F3F3F3",
    contrastText: "#000000",
  },
  error: {
    main: "#FF99A4",
  },
  background: {
    default: "#202020", // Mica dark base
    paper: "#2B2B2B", // Layer
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#A6A6A6",
  },
  action: {
    active: "#FFFFFF",
    hover: "rgba(255, 255, 255, 0.04)",
    selected: "rgba(255, 255, 255, 0.06)",
    disabled: "rgba(255, 255, 255, 0.36)",
    disabledBackground: "rgba(255, 255, 255, 0.06)",
  },
};

// --- Theme Generators ---

const getM3ThemeOptions = (mode: "light" | "dark"): ThemeOptions => {
  const isDark = mode === "dark";
  const colors = isDark ? m3DarkPalette : m3Palette;

  return {
    palette: {
      mode,
      ...colors,
    },
    shape: {
      borderRadius: 16,
    },
    typography: {
      fontFamily: '"Roboto", "Inter", "Helvetica", "Arial", sans-serif',
      button: {
        textTransform: "none",
        fontWeight: 500,
      },
      h1: { fontSize: "3.5rem", fontWeight: 400 },
      h2: { fontSize: "2.8rem", fontWeight: 400 },
      h3: { fontSize: "2.25rem", fontWeight: 400 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            padding: "10px 24px",
            boxShadow: "none",
            ":hover": {
              boxShadow: "none",
            },
          },
          contained: {
            ":hover": {
              boxShadow: "0px 1px 2px rgba(0,0,0,0.3)",
            },
          },
          outlined: {
            borderColor: isDark ? "#938F99" : "#79747E",
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: "none",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: isDark ? "#2B2930" : "#F7F2FA",
            boxShadow: "none",
            border: "none",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
          elevation1: {
            boxShadow:
              "0px 1px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.12)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#141218" : "#FEF7FF",
            color: isDark ? "#E6E1E5" : "#1D1B20",
            boxShadow: "none",
            borderBottom: `1px solid ${isDark ? "#49454F" : "#E7E0EC"}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? "#141218" : "#FEF7FF",
            borderRight: "none",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 28,
            margin: "4px 8px",
            "&.Mui-selected": {
              backgroundColor: isDark
                ? alpha("#D0BCFF", 0.12)
                : alpha("#6750A4", 0.12),
              "&:hover": {
                backgroundColor: isDark
                  ? alpha("#D0BCFF", 0.16)
                  : alpha("#6750A4", 0.16),
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 4,
          },
          notchedOutline: {
            borderColor: isDark ? "#938F99" : "#79747E",
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            width: 52,
            height: 32,
            padding: 0,
          },
          switchBase: {
            padding: 4,
            "&.Mui-checked": {
              transform: "translateX(20px)",
              color: "#fff",
              "& + .MuiSwitch-track": {
                opacity: 1,
                backgroundColor: isDark ? "#D0BCFF" : "#6750A4",
              },
            },
          },
          thumb: {
            width: 24,
            height: 24,
          },
          track: {
            borderRadius: 16,
          },
        },
      },
    },
  };
};

const getFluentThemeOptions = (mode: "light" | "dark"): ThemeOptions => {
  const isDark = mode === "dark";
  const colors = isDark ? fluentDarkPalette : fluentPalette;

  return {
    palette: {
      mode,
      ...colors,
    },
    typography: {
      fontFamily:
        '"Segoe UI Variable", "Segoe UI", "Meiryo", system-ui, sans-serif',
      button: {
        textTransform: "none",
        fontWeight: 600,
        fontSize: "0.875rem",
      },
      h1: { fontSize: "2.5rem", fontWeight: 600 },
      h2: { fontSize: "2rem", fontWeight: 600 },
      h3: { fontSize: "1.5rem", fontWeight: 600 },
      h4: { fontSize: "1.25rem", fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: {
      borderRadius: 4,
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
          disableRipple: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 4,
            padding: "6px 20px",
            transition: "background-color 0.1s, color 0.1s, box-shadow 0.1s",
            ":active": {
              transform: "scale(0.98)",
              opacity: 0.8,
            },
          },
          contained: {
            backgroundColor: colors.primary.main,
            color: colors.primary.contrastText,
            ":hover": {
              backgroundColor: isDark ? "#48B5ED" : "#005A9E",
            },
          },
          outlined: {
            borderColor: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.08)",
            backgroundColor: isDark
              ? "rgba(255,255,255,0.04)"
              : "rgba(255,255,255,0.7)",
            color: colors.text.primary,
            ":hover": {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.04)",
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.08)",
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          variant: "elevation",
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
          rounded: {
            borderRadius: 8,
          },
          elevation1: {
            boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.14)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"
              }`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? "#2B2B2B" : "#FFFFFF",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"
              }`,
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.04)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 8,
            boxShadow: "0px 8px 32px rgba(0, 0, 0, 0.24)",
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            width: 40,
            height: 20,
            padding: 0,
            display: "flex",
            overflow: "visible",
          },
          switchBase: {
            padding: 2,
            "&.Mui-checked": {
              transform: "translateX(20px)",
              color: "#fff",
              "& + .MuiSwitch-track": {
                opacity: 1,
                backgroundColor: colors.primary.main,
                border: "none",
              },
            },
          },
          thumb: {
            width: 16,
            height: 16,
            boxShadow: "none",
            backgroundColor: isDark ? "#FFF" : "#5D5D5D",
            transition: "background-color 0.2s, transform 0.2s",
          },
          track: {
            borderRadius: 10,
            opacity: 1,
            backgroundColor: "transparent",
            border: `1px solid ${isDark ? "#999" : "#777"}`,
            boxSizing: "border-box",
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          rail: {
            height: 4,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.3)"
              : "rgba(0,0,0,0.3)",
          },
          track: {
            height: 4,
            backgroundColor: colors.primary.main,
            border: "none",
          },
          thumb: {
            height: 18,
            width: 18,
            backgroundColor: colors.primary.main,
            border: `2px solid ${isDark ? "#202020" : "#F3F3F3"}`,
            "&:focus, &:hover, &.Mui-active": {
              boxShadow: "none",
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.05)"
              : "#FFFFFF",
            transition: "background-color 0.2s",
            "&:hover": {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "#FDFDFD",
            },
            "&.Mui-focused": {
              backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
            },
          },
          notchedOutline: {
            borderColor: isDark
              ? "rgba(255,255,255,0.2)"
              : "rgba(0,0,0,0.2)",
            borderWidth: "1px",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: colors.background.default,
            color: colors.text.primary,
            boxShadow: "none",
            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"
              }`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: colors.background.default,
            borderRight: "none",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            margin: "2px 4px",
            "&:hover": {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(0,0,0,0.04)",
            },
            "&.Mui-selected": {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.08)",
              "&:before": {
                content: '""',
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                height: "16px",
                width: "3px",
                backgroundColor: colors.primary.main,
                borderRadius: "2px",
              },
            },
          },
        },
      },
    },
  };
};

// --- Main Export ---

export function getTheme(style: ThemeStyle, mode: "light" | "dark") {
  switch (style) {
    case "m3":
      return createTheme(getM3ThemeOptions(mode));
    case "fluent":
      return createTheme(getFluentThemeOptions(mode));
    case "default":
    default:
      return createTheme({
        palette: { mode },
      });
  }
}

// Keep legacy exports consistent for now while refactoring if anything used them,
// but our App.tsx will be updated to use getTheme.
// Defining these just in case imports elsewhere break before update.
export const theme = createTheme(getFluentThemeOptions("light"));
export const darkTheme = createTheme(getFluentThemeOptions("dark"));
