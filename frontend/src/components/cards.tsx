import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, RatingStars, TrustBadge } from "@/src/components/ui";
import { categoryIcon, formatPay } from "@/src/constants";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

function InfoButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      testID="card-info-button"
      style={[styles.infoBtn, { backgroundColor: "rgba(255,255,255,0.22)" }]}
    >
      <Icon name="information-outline" size={22} color={colors.onBrandPrimary} />
    </Pressable>
  );
}

function Pill({ icon, text, dark }: { icon: string; text: string; dark?: boolean }) {
  const { colors } = useTheme();
  const bg = dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.22)";
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Icon name={icon} size={14} color={colors.onBrandPrimary} />
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

export function WorkerCard({ item, onOpenDetail }: { item: any; onOpenDetail: () => void }) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: item.avatar }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(28,28,28,0.35)", "rgba(28,28,28,0.92)"]}
        locations={[0.35, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <View style={styles.catBubble}>
          <Icon name={categoryIcon(item.category)} size={20} color="#FFFFFF" />
        </View>
        <InfoButton onPress={onOpenDetail} />
      </View>

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <TrustBadge isNew={item.is_new} verified={item.verified} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.role} numberOfLines={1}>
          {item.role}
        </Text>

        {item.is_new ? (
          <Text style={styles.newHint}>Pekerja baru • beri kesempatan pertama 🙌</Text>
        ) : (
          <View style={styles.ratingRow}>
            <RatingStars rating={item.rating} size={16} />
            <Text style={styles.ratingText}>
              {item.rating.toFixed(1)} • {item.jobs_completed} kerja
            </Text>
          </View>
        )}

        <View style={styles.pillRow}>
          <Pill icon="map-marker" text={`${item.distance_km} km`} />
          <Pill icon="cash" text={formatPay(item.pay_amount, item.pay_unit)} />
          <Pill icon="briefcase-outline" text={item.experience_label} />
        </View>
      </View>
    </View>
  );
}

export function JobCard({ item, onOpenDetail }: { item: any; onOpenDetail: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[colors.brandPrimary, colors.onBrandTertiary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <View style={[styles.typeTag, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <Text style={styles.typeTagText}>{item.job_type}</Text>
        </View>
        <InfoButton onPress={onOpenDetail} />
      </View>

      <View style={styles.jobCenter}>
        <View style={styles.bigIconBubble}>
          <Icon name={categoryIcon(item.category)} size={64} color="#FFFFFF" />
        </View>
        <Text style={styles.jobCategory}>{item.category}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.business} numberOfLines={1}>
          {item.business}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.payHero}>
          <Text style={styles.payHeroText}>{formatPay(item.pay_amount, item.pay_unit)}</Text>
        </View>
        <View style={styles.pillRow}>
          <Pill icon="map-marker" text={`${item.distance_km} km`} dark />
          <Pill icon="star-outline" text={item.min_experience_label} dark />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  topRow: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  catBubble: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    gap: spacing.xs,
  },
  badgeRow: { flexDirection: "row", marginBottom: spacing.xs },
  name: { fontFamily: fonts.medium, fontSize: 28, color: "#FFFFFF" },
  role: { fontFamily: fonts.regular, fontSize: 16, color: "rgba(255,255,255,0.9)" },
  business: { fontFamily: fonts.medium, fontSize: 15, color: "rgba(255,255,255,0.85)" },
  newHint: { fontFamily: fonts.regular, fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  ratingText: { fontFamily: fonts.medium, fontSize: 14, color: "#FFFFFF" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },
  jobCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  bigIconBubble: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  jobCategory: { fontFamily: fonts.medium, fontSize: 16, color: "rgba(255,255,255,0.9)" },
  typeTag: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  typeTagText: { fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },
  payHero: { marginTop: spacing.xs },
  payHeroText: { fontFamily: fonts.medium, fontSize: 22, color: "#FFFFFF" },
});
