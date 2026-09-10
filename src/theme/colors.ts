export type ThemeName = "light" | "dark";

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  danger: string;
  success: string;
  chartLine: string;
  chartFill: string;
  chartGrid: string;
  mapRoute: string;
  scrim: string;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    background: "#F6F7F4",
    surface: "#FFFFFF",
    surfaceAlt: "#EDEFE9",
    border: "#dde0d74c",
    text: "#171A16",
    textMuted: "#5F6B5C",
    textInverse: "#FFFFFF",
    primary: "#2F6B4F",
    primaryMuted: "#DCE9E1",
    accent: "#C8632B",
    danger: "#B3261E",
    success: "#2F6B4F",
    chartLine: "#2F6B4F",
    chartFill: "#9FC7B0",
    chartGrid: "#DDE0D7",
    mapRoute: "#C8632B",
    scrim: "rgba(0,0,0,0.35)",
  },
  dark: {
    background: "#101310",
    surface: "#1A1E19",
    surfaceAlt: "#232821",
    border: "#333A31",
    text: "#ECEFE8",
    textMuted: "#9AA595",
    textInverse: "#101310",
    primary: "#7FC59B",
    primaryMuted: "#223129",
    accent: "#E2884F",
    danger: "#F2B8B5",
    success: "#7FC59B",
    chartLine: "#7FC59B",
    chartFill: "#2C4739",
    chartGrid: "#333A31",
    mapRoute: "#E2884F",
    scrim: "rgba(0,0,0,0.6)",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
