import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, radius, spacing, useTheme } from "@/src/theme";

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType } | null;

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      setToast({ message, type });
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setToast(null));
    },
    [opacity],
  );

  const bg =
    toast?.type === "success"
      ? colors.success
      : toast?.type === "error"
      ? colors.error
      : colors.surfaceInverse;
  const fg =
    toast?.type === "success"
      ? colors.onSuccess
      : toast?.type === "error"
      ? colors.onError
      : colors.onSurfaceInverse;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + spacing.sm, opacity }]}
        >
          <View style={[styles.toast, { backgroundColor: bg, shadowColor: colors.brandPrimary }]} testID="toast">
            <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    paddingHorizontal: spacing.lg,
  },
  toast: {
    maxWidth: 440,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { fontFamily: fonts.medium, fontSize: 14, textAlign: "center" },
});
