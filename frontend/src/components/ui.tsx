import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { Image } from "expo-image";
import {
  ActivityIndicator, Pressable, Text, TextInput, View,
  type ImageStyle, type StyleProp, type TextInputProps, type ViewStyle,
} from "react-native";
import { useState, type ReactNode } from "react";

import { categoryIcon } from "@/src/constants";
import { mediaUrl } from "@/src/services/http-client";
import { controlSize, fonts, makeStyles, radius, softShadow, spacing, typeScale, useTheme } from "@/src/theme";

// Default avatar: category icon in a colored circular badge; a photo replaces it when present.
export function CategoryAvatar({
  category,
  photo,
  size = 56,
  style,
  variant = "default",
}: {
  category?: string;
  photo?: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
  variant?: "default" | "inverse" | "subtle";
}) {
  const { colors } = useTheme();
  if (photo) {
    return (
      <Image
        source={{ uri: mediaUrl(photo) }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor:
            variant === "inverse"
              ? colors.surface
              : variant === "subtle"
                ? colors.brandSurfaceSubtle
                : colors.brandTertiary,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <MaterialDesignIcons
        name={categoryIcon(category) as any}
        size={Math.round(size * 0.5)}
        color={colors.brandPrimary}
      />
    </View>
  );
}

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

export function VerificationTrustBadge({ label }: { label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.verificationTrustBadge}>
      <Icon name="check-decagram" size={16} color={colors.success} />
      <Text style={styles.verificationTrustText}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  testID,
  variant = "default",
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: string;
  testID?: string;
  variant?: "default" | "outlined";
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        active ? styles.chipActive : variant === "outlined" ? styles.chipOutlined : styles.chipInactive,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={15}
          color={active ? colors.onBrandPrimary : variant === "outlined" ? colors.brandPrimary : colors.onSurfaceTertiary}
        />
      ) : null}
      <Text
        style={[
          styles.chipText,
          {
            color: active
              ? colors.onBrandPrimary
              : variant === "outlined"
                ? colors.brandPrimary
                : colors.onSurfaceTertiary,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.brandLockup}>
      <View style={[styles.brandMark, compact && styles.brandMarkCompact]}>
        <Icon name="hand-wave" size={compact ? 18 : 21} color={colors.onBrandPrimary} />
      </View>
      <Text style={[styles.brandWordmark, compact && styles.brandWordmarkCompact]}>Kerjo</Text>
    </View>
  );
}

export function SectionCard({
  icon,
  title,
  children,
  style,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionCard, style]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Icon name={icon} size={19} color={colors.brandPrimary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function FormField({
  label,
  helper,
  children,
  last = false,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
  last?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={!last ? styles.formField : undefined}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
      {helper ? <Text style={styles.formHelper}>{helper}</Text> : null}
    </View>
  );
}

export function FormInput({
  style,
  onFocus,
  onBlur,
  multiline,
  ...props
}: TextInputProps) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      multiline={multiline}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.formInput,
        multiline && styles.formTextarea,
        focused && styles.formInputFocused,
        style,
      ]}
    />
  );
}

export function CompactSelect({
  value,
  onPress,
  testID,
}: {
  value: string;
  onPress: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.compactSelect, pressed && styles.btnPressed]}
      onPress={onPress}
      testID={testID}
    >
      <Text style={styles.compactSelectText}>{value}</Text>
      <Icon name="chevron-down" size={20} color={colors.muted} />
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  children,
}: {
  icon: string;
  title: string;
  message: string;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyBubble}>
        <Icon name={icon} size={42} color={colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {children}
    </View>
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
  verificationTrustBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  verificationTrustText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.onSurface,
  },
  chip: {
    height: 36,
    alignSelf: "flex-start",
    flexShrink: 0,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipInactive: { backgroundColor: colors.surfaceTertiary },
  chipOutlined: { backgroundColor: colors.surface, borderColor: colors.brandPrimary },
  chipText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
  },
  brandMarkCompact: { width: 32, height: 32, borderRadius: radius.md },
  brandWordmark: {
    fontFamily: fonts.headline,
    fontSize: 26,
    letterSpacing: -0.7,
    color: colors.brandPrimary,
  },
  brandWordmarkCompact: { fontSize: 23 },
  sectionCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: colors.brandPrimary,
    ...softShadow,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTertiary,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: typeScale.section,
    lineHeight: 23,
    letterSpacing: -0.25,
    color: colors.onSurface,
  },
  formField: { marginBottom: spacing.xl },
  formLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  formHelper: {
    fontFamily: fonts.regular,
    fontSize: typeScale.caption,
    lineHeight: 18,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  formInput: {
    minHeight: controlSize.input,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: typeScale.input,
    lineHeight: 22,
    color: colors.onSurface,
  },
  formTextarea: { minHeight: 104, textAlignVertical: "top" },
  formInputFocused: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.surface,
  },
  compactSelect: {
    minHeight: controlSize.input,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  compactSelectText: {
    fontFamily: fonts.medium,
    fontSize: typeScale.input,
    color: colors.onSurface,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyBubble: {
    width: 92,
    height: 92,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 27,
    color: colors.onSurface,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: typeScale.body,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
}));
