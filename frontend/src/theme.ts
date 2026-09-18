// Design tokens for Kerjo. Light theme (Indonesian red + white).
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDFDFD",
  onSurface: "#111111",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#111111",
  surfaceTertiary: "#F7F7F7",
  onSurfaceTertiary: "#333333",
  surfaceInverse: "#1C1C1C",
  onSurfaceInverse: "#FFFFFF",
  muted: "#737373",

  brand: "#E62429",
  onBrand: "#FFFFFF",
  brandPrimary: "#E62429",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FFEBED",
  onBrandSecondary: "#D31225",
  brandTertiary: "#FFF0F2",
  onBrandTertiary: "#C00F21",

  success: "#059669",
  onSuccess: "#FFFFFF",
  warning: "#EAB308",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#0284C7",
  onInfo: "#FFFFFF",

  border: "#E5E5E5",
  borderStrong: "#D4D4D4",
  divider: "#F0F0F0",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// Font families (max weight 500 per design guidelines — never use bold).
export const fonts = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
};

// Spacing + radius tokens from design_guidelines.json
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 24,
  pill: 999,
};

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
