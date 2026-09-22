import { type ReactNode } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

import { useTheme } from "@/src/theme";

export const APP_MAX_WIDTH = 430;

export function useAppLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width: Platform.OS === "web" ? Math.min(width, APP_MAX_WIDTH) : width,
    height,
  };
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  if (Platform.OS !== "web") {
    return children;
  }
  return (
    <View style={{ flex: 1, width: "100%", backgroundColor: colors.surfaceTertiary, alignItems: "center" }}>
      <View
        style={{
          width: "100%",
          maxWidth: APP_MAX_WIDTH,
          flex: 1,
          overflow: "hidden",
          backgroundColor: colors.surface,
        }}
      >
        {children}
      </View>
    </View>
  );
}
