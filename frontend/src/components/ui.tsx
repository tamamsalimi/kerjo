import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// Central icon wrapper so we can swap sets in one place.
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <MaterialDesignIcons name={name as any} size={size} color={color ?? colors.onSurface} />
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
  testID,
  style,
  textColor: textColorOverride,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "inverse";
  icon?: string;
  testID?: string;
  style?: ViewStyle;
  textColor?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isOutline = variant === "outline";
  const isInverse = variant === "inverse";
  const textColor =
    textColorOverride ??
    (isOutline ? colors.onSurface : isInverse ? colors.onSurface : colors.onBrandPrimary);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isOutline && styles.btnOutline,
        isInverse && styles.btnInverse,
        (disabled || loading) && styles.btnDisabled,
        pressed && styles.btnPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Icon name={icon} size={20} color={textColor} /> : null}
          <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function RatingStars({ rating, size = 16 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  const full = Math.round(rating);
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <MaterialDesignIcons
          key={i}
          name={i <= full ? "star" : "star-outline"}
          size={size}
          color={colors.warning}
        />
      ))}
    </View>
  );
}

export function TrustBadge({ isNew, verified }: { isNew?: boolean; verified?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (isNew) {
    return (
      <View style={[styles.badge, { backgroundColor: colors.info }]} testID="badge-new">
        <Text style={[styles.badgeText, { color: colors.onInfo }]}>🆕 Baru di Kerjo</Text>
      </View>
    );
  }
  if (verified) {
    return (
      <View style={[styles.badge, { backgroundColor: colors.success }]} testID="badge-verified">
        <MaterialDesignIcons name="check-decagram" size={13} color={colors.onSuccess} />
        <Text style={[styles.badgeText, { color: colors.onSuccess }]}>Terverifikasi</Text>
      </View>
    );
  }
  return null;
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: string;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={15}
          color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary}
        />
      ) : null}
      <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  btnInverse: {
    backgroundColor: colors.surfaceTertiary,
  },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontFamily: fonts.medium, fontSize: 16 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  badgeText: { fontFamily: fonts.medium, fontSize: 12 },
  chip: {
    height: 36,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipInactive: { backgroundColor: colors.brandTertiary },
  chipText: { fontFamily: fonts.medium, fontSize: 13 },
}));
