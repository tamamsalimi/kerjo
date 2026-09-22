import { useCallback, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import { useTheme } from "@/src/theme";

const THUMB = 28;
const TRACK = 4;

type RangeSliderProps = {
  minimumValue: number;
  maximumValue: number;
  lowValue: number;
  highValue: number;
  step?: number;
  onChange: (range: { low: number; high: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  testID?: string;
};

export function RangeSlider({
  minimumValue,
  maximumValue,
  lowValue,
  highValue,
  step = 1,
  onChange,
  onDragStart,
  onDragEnd,
  testID,
}: RangeSliderProps) {
  const { colors } = useTheme();
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const originX = useRef(0);
  const span = Math.max(maximumValue - minimumValue, step);
  const usable = Math.max(trackWidth - THUMB, 1);
  const lowRef = useRef(lowValue);
  const highRef = useRef(highValue);
  lowRef.current = lowValue;
  highRef.current = highValue;

  const snap = useCallback(
    (value: number) => {
      const snapped = Math.round(value / step) * step;
      return Math.min(maximumValue, Math.max(minimumValue, Number(snapped.toFixed(4))));
    },
    [maximumValue, minimumValue, step],
  );

  const valueFromPageX = useCallback(
    (pageX: number) => {
      const x = Math.min(usable, Math.max(0, pageX - originX.current - THUMB / 2));
      return snap(minimumValue + (x / usable) * span);
    },
    [minimumValue, snap, span, usable],
  );

  const emit = useCallback(
    (low: number, high: number) => {
      const nextLow = Math.min(low, high - step);
      const nextHigh = Math.max(high, low + step);
      onChange({
        low: snap(Math.max(minimumValue, nextLow)),
        high: snap(Math.min(maximumValue, nextHigh)),
      });
    },
    [maximumValue, minimumValue, onChange, snap, step],
  );

  const lowX = ((lowValue - minimumValue) / span) * usable;
  const highX = ((highValue - minimumValue) / span) * usable;

  const bindThumb = useCallback(
    (which: "low" | "high") =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          onDragStart?.();
          const value = valueFromPageX(event.nativeEvent.pageX);
          if (which === "low") emit(value, highRef.current);
          else emit(lowRef.current, value);
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          const value = valueFromPageX(event.nativeEvent.pageX);
          if (which === "low") emit(value, highRef.current);
          else emit(lowRef.current, value);
        },
        onPanResponderRelease: () => onDragEnd?.(),
        onPanResponderTerminate: () => onDragEnd?.(),
      }),
    [emit, onDragEnd, onDragStart, valueFromPageX],
  );

  const lowPan = useMemo(() => bindThumb("low"), [bindThumb]);
  const highPan = useMemo(() => bindThumb("high"), [bindThumb]);

  function onTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
    trackRef.current?.measureInWindow((x) => {
      originX.current = x;
    });
  }

  return (
    <View
      ref={trackRef}
      testID={testID}
      style={styles.wrap}
      onLayout={onTrackLayout}
    >
      <View style={[styles.track, { backgroundColor: colors.border }]} />
      <View
        pointerEvents="none"
        style={[
          styles.active,
          {
            backgroundColor: colors.brandPrimary,
            left: lowX + THUMB / 2,
            width: Math.max(highX - lowX, 0),
          },
        ]}
      />
      <View
        {...lowPan.panHandlers}
        testID={testID ? `${testID}-low` : undefined}
        style={[
          styles.thumb,
          {
            left: lowX,
            backgroundColor: colors.brandPrimary,
            borderColor: colors.surface,
            shadowColor: colors.brandPrimary,
          },
        ]}
      />
      <View
        {...highPan.panHandlers}
        testID={testID ? `${testID}-high` : undefined}
        style={[
          styles.thumb,
          {
            left: highX,
            backgroundColor: colors.brandPrimary,
            borderColor: colors.surface,
            shadowColor: colors.brandPrimary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 36,
    justifyContent: "center",
  },
  track: {
    height: TRACK,
    borderRadius: 99,
  },
  active: {
    position: "absolute",
    height: TRACK,
    borderRadius: 99,
  },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 3,
  },
});
