import { Platform } from "react-native";

// iOS 26+ uses native tabs (liquid glass). Everything else uses classic JS tabs.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
