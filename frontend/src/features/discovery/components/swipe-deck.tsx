import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { fonts, radius, spacing, useTheme } from "@/src/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const THRESHOLD = SCREEN_W * 0.26;
const OUT = SCREEN_W * 1.5;

export type SwipeDeckRef = {
  swipeLeft: () => void;
  swipeRight: () => void;
};

type Props<T> = {
  data: T[];
  renderCard: (item: T, hovered: boolean) => ReactNode;
  onSwipe: (item: T, direction: "left" | "right") => void;
  keyExtractor: (item: T) => string;
  likeLabel?: string;
  nopeLabel?: string;
};

function SwipeDeckInner<T>(
  { data, renderCard, onSwipe, keyExtractor, likeLabel = "SUKA", nopeLabel = "LEWAT" }: Props<T>,
  ref: React.Ref<SwipeDeckRef>,
) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const busy = useRef(false);
  const [hovered, setHovered] = useState(false);

  const dataRef = useRef(data);
  dataRef.current = data;

  function finish(dir: "left" | "right") {
    const item = dataRef.current[0];
    translateX.value = 0;
    translateY.value = 0;
    busy.current = false;
    if (item) onSwipe(item, dir);
  }

  function programmatic(dir: "left" | "right") {
    if (busy.current || !dataRef.current[0]) return;
    busy.current = true;
    translateX.value = withTiming(dir === "right" ? OUT : -OUT, { duration: 260 }, (f) => {
      if (f) runOnJS(finish)(dir);
    });
  }

  useImperativeHandle(ref, () => ({
    swipeLeft: () => programmatic("left"),
    swipeRight: () => programmatic("right"),
  }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > THRESHOLD) {
        const dir = e.translationX > 0 ? "right" : "left";
        translateX.value = withTiming(dir === "right" ? OUT : -OUT, { duration: 220 }, (f) => {
          if (f) runOnJS(finish)(dir);
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const topStyle = useAnimatedStyle(() => {
    const rot = interpolate(translateX.value, [-SCREEN_W, 0, SCREEN_W], [-9, 0, 9], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rot}deg` },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const top = data[0];
  const behind = data[1];

  return (
    <View style={styles.deck}>
      {behind ? (
        <View key={keyExtractor(behind)} style={[styles.cardWrap, styles.behind, { pointerEvents: "none" }]}>
          {renderCard(behind, false)}
        </View>
      ) : null}
      {top ? (
        <GestureDetector key={keyExtractor(top)} gesture={pan}>
          <Animated.View
            style={[styles.cardWrap, topStyle]}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            testID="swipe-card-top"
          >
            {renderCard(top, hovered)}
            <Animated.View style={[styles.stamp, styles.stampLike, { borderColor: colors.success }, likeStyle]}>
              <Text style={[styles.stampText, { color: colors.success }]}>{likeLabel}</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampNope, { borderColor: colors.error }, nopeStyle]}>
              <Text style={[styles.stampText, { color: colors.error }]}>{nopeLabel}</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

export const SwipeDeck = forwardRef(SwipeDeckInner) as <T>(
  props: Props<T> & { ref?: React.Ref<SwipeDeckRef> },
) => ReturnType<typeof SwipeDeckInner>;

const styles = StyleSheet.create({
  deck: { flex: 1 },
  cardWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  behind: {
    transform: [{ scale: 0.94 }, { translateY: 12 }],
  },
  stamp: {
    position: "absolute",
    top: 36,
    borderWidth: 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  stampLike: { left: 24, transform: [{ rotate: "-16deg" }] },
  stampNope: { right: 24, transform: [{ rotate: "16deg" }] },
  stampText: { fontFamily: fonts.medium, fontSize: 30, letterSpacing: 2 },
});
