import { useEffect } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Icon, PrimaryButton } from "@/src/components/ui";
import { categoryIcon } from "@/src/constants";
import { APP_MAX_WIDTH } from "@/src/layout/phone-frame";
import { fonts, spacing, useTheme } from "@/src/theme";

export function MatchOverlay({
  visible,
  match,
  onMessage,
  onKeepSwiping,
}: {
  visible: boolean;
  match: any;
  onMessage: () => void;
  onKeepSwiping: () => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withDelay(60, withSpring(1, { damping: 12, stiffness: 160 }));
    } else {
      scale.value = 0.6;
      opacity.value = 0;
    }
  }, [visible, scale, opacity]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!match) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepSwiping}>
      <View style={[styles.backdrop, { backgroundColor: "rgba(28,28,28,0.94)" }]} testID="match-overlay">
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.matchHeading}>
            <Icon name="heart" size={28} color={colors.brandPrimary} />
            <Text style={[styles.match, { color: colors.brandPrimary }]}>Cocok!</Text>
          </View>
          <View style={styles.graphic}>
            <View style={[styles.gBadge, styles.gLeft, { backgroundColor: colors.brandPrimary, borderColor: colors.surfaceInverse }]}>
              <Icon name="hand-wave" size={40} color={colors.onBrandPrimary} />
            </View>
            <View style={[styles.gBadge, styles.gRight, { backgroundColor: colors.brandTertiary, borderColor: colors.surfaceInverse }]}>
              <Icon name={categoryIcon(match.category)} size={40} color={colors.brandPrimary} />
            </View>
          </View>
          <Text style={[styles.title, { color: colors.onBrandPrimary }]}>{match.title}</Text>
          <Text style={[styles.sub, { color: "rgba(255,255,255,0.75)" }]}>{match.subtitle}</Text>
          <Text style={[styles.hint, { color: "rgba(255,255,255,0.6)" }]}>
            Kalian saling cocok. Mulai ngobrol sekarang!
          </Text>
        </Animated.View>

        <View style={styles.actions}>
          <PrimaryButton testID="match-message-button" label="Kirim Pesan" icon="message-text" onPress={onMessage} />
          <PrimaryButton
            testID="match-keep-button"
            label="Lanjut Swipe"
            variant="outline"
            textColor={colors.onBrandPrimary}
            onPress={onKeepSwiping}
            style={{ borderColor: "rgba(255,255,255,0.4)" }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { alignItems: "center", width: "100%", maxWidth: APP_MAX_WIDTH },
  matchHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  match: { fontFamily: fonts.bold, fontSize: 34, textAlign: "center" },
  image: { width: 220, height: 220, borderRadius: 24, marginBottom: spacing.lg },
  graphic: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 120, marginBottom: spacing.lg },
  gBadge: {
    width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center",
    borderWidth: 4,
  },
  gLeft: { marginRight: -18, zIndex: 2 },
  gRight: { marginLeft: -18 },
  title: { fontFamily: fonts.medium, fontSize: 24, textAlign: "center" },
  sub: { fontFamily: fonts.regular, fontSize: 16, marginTop: 2, textAlign: "center" },
  hint: { fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.md, textAlign: "center" },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing["3xl"],
    width: "100%",
    maxWidth: APP_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
});
