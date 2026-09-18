import { Image } from "expo-image";
import { useEffect } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { PrimaryButton } from "@/src/components/ui";
import { fonts, spacing, useTheme } from "@/src/theme";

const HANDSHAKE =
  "https://images.unsplash.com/photo-1638262052640-82e94d64664a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwxfHxoYW5kc2hha2UlMjBzdWNjZXNzJTIwbWF0Y2h8ZW58MHx8fHwxNzg5NzczNzIxfDA&ixlib=rb-4.1.0&q=85&w=800";

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
          <Text style={[styles.match, { color: colors.brandPrimary }]}>It&apos;s a Match! 🎉</Text>
          <Image source={{ uri: HANDSHAKE }} style={styles.image} contentFit="cover" />
          <Text style={styles.title}>{match.title}</Text>
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
            textColor="#FFFFFF"
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
  card: { alignItems: "center", width: "100%" },
  match: { fontFamily: fonts.medium, fontSize: 34, marginBottom: spacing.xl, textAlign: "center" },
  image: { width: 220, height: 220, borderRadius: 24, marginBottom: spacing.lg },
  title: { fontFamily: fonts.medium, fontSize: 24, color: "#FFFFFF", textAlign: "center" },
  sub: { fontFamily: fonts.regular, fontSize: 16, marginTop: 2, textAlign: "center" },
  hint: { fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.md, textAlign: "center" },
  actions: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing["3xl"],
    gap: spacing.md,
  },
});
