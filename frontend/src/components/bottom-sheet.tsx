import { useEffect, useRef, type PropsWithChildren } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/ui";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  testID?: string;
}>) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    } else {
      translateY.setValue(600);
    }
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="sheet-backdrop" />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
        {title ? (
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} testID="sheet-close">
              <Icon name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.semibold, fontSize: 20 },
});
