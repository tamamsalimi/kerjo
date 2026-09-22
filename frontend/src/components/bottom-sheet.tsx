import { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/ui";
import { APP_MAX_WIDTH } from "@/src/layout/phone-frame";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scrollEnabled = true,
  testID,
}: PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  scrollEnabled?: boolean;
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
      <View style={styles.frame} pointerEvents="box-none">
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
              <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12} testID="sheet-close">
                <Icon name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          {Platform.OS === "web" ? (
            <View style={[styles.body, styles.webBody]}>{children}</View>
          ) : (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={scrollEnabled}
            >
              {children}
            </ScrollView>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    zIndex: 1,
    width: "100%",
    maxWidth: APP_MAX_WIDTH,
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
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4 },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: spacing.sm },
  webBody: {
    maxHeight: 520,
    overflow: "auto",
    paddingBottom: spacing.sm,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F0F0F0",
  },
});
