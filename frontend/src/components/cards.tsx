import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, RatingStars, TrustBadge } from "@/src/components/ui";
import { categoryColor, categoryIcon, formatPay } from "@/src/constants";
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

function Pill({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: "rgba(0,0,0,0.28)" }]}>
      <Icon name={icon} size={14} color="#FFFFFF" />
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

const SCRIM = ["rgba(0,0,0,0)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.82)"] as const;

export function WorkerCard({ item, onOpenDetail }: { item: any; onOpenDetail: () => void }) {
  const hasPhoto = !!item.avatar;
  const color = categoryColor(item.category);
  return (
    <View style={[styles.card, { backgroundColor: color }]}>
      {hasPhoto ? (
        <Image source={{ uri: item.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : null}
      <LinearGradient colors={SCRIM} locations={[0.35, 0.6, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.topRow}>
        <View style={styles.catBubble}>
          <Icon name={categoryIcon(item.category)} size={20} color="#FFFFFF" />
        </View>
        <InfoButton onPress={onOpenDetail} />
      </View>

      {!hasPhoto ? (
        <View style={styles.center}>
          <View style={styles.bigIconBubble}>
            <Icon name={categoryIcon(item.category)} size={68} color="#FFFFFF" />
          </View>
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <TrustBadge isNew={item.is_new} verified={item.verified} />
        </View>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.role} numberOfLines={1}>{item.role}</Text>

        {item.is_new ? (
          <Text style={styles.newHint}>Pekerja baru • beri kesempatan pertama 🙌</Text>
        ) : (
          <View style={styles.ratingRow}>
            <RatingStars rating={item.rating} size={16} />
            <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)} • {item.jobs_completed} kerja</Text>
          </View>
        )}

        <View style={styles.pillRow}>
          {item.distance_km > 0 ? <Pill icon="map-marker" text={`${item.distance_km} km`} /> : null}
          {item.pay_display ? (
            <Pill icon="cash" text={item.pay_display} />
          ) : item.pay_amount ? (
            <Pill icon="cash" text={formatPay(item.pay_amount, item.pay_unit)} />
          ) : null}
          <Pill icon="briefcase-outline" text={item.experience_label} />
        </View>
      </View>
    </View>
  );
}

export function JobCard({ item, onOpenDetail }: { item: any; onOpenDetail: () => void }) {
  const color = categoryColor(item.category);
  return (
    <View style={[styles.card, { backgroundColor: color }]}>
      <LinearGradient colors={SCRIM} locations={[0.35, 0.6, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.topRow}>
        <View style={[styles.typeTag, { backgroundColor: "rgba(0,0,0,0.28)" }]}>
          <Text style={styles.typeTagText}>{item.job_type}</Text>
        </View>
        <InfoButton onPress={onOpenDetail} />
      </View>

      <View style={styles.center}>
        <View style={styles.bigIconBubble}>
          <Icon name={categoryIcon(item.category)} size={68} color="#FFFFFF" />
        </View>
        <Text style={styles.jobCategory}>{item.category}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.business} numberOfLines={1}>{item.business}</Text>
        <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
        <View style={styles.payHero}>
          <Text style={styles.payHeroText}>{formatPay(item.pay_amount, item.pay_unit)}</Text>
        </View>
        <View style={styles.pillRow}>
          <Pill icon="map-marker" text={`${item.distance_km} km`} />
          <Pill icon="star-outline" text={item.min_experience_label} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.lg, overflow: "hidden" },
  topRow: {
    position: "absolute", top: spacing.lg, left: spacing.lg, right: spacing.lg,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 2,
  },
  catBubble: {
    width: 42, height: 42, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  infoBtn: { width: 42, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  bigIconBubble: {
    width: 120, height: 120, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  jobCategory: { fontFamily: fonts.medium, fontSize: 16, color: "rgba(255,255,255,0.92)" },
  content: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: spacing.xl, gap: spacing.xs },
  badgeRow: { flexDirection: "row", marginBottom: spacing.xs },
  name: { fontFamily: fonts.medium, fontSize: 28, color: "#FFFFFF" },
  role: { fontFamily: fonts.regular, fontSize: 16, color: "rgba(255,255,255,0.9)" },
  business: { fontFamily: fonts.medium, fontSize: 15, color: "rgba(255,255,255,0.85)" },
  newHint: { fontFamily: fonts.regular, fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  ratingText: { fontFamily: fonts.medium, fontSize: 14, color: "#FFFFFF" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },
  typeTag: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  typeTagText: { fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },
  payHero: { marginTop: spacing.xs },
  payHeroText: { fontFamily: fonts.medium, fontSize: 22, color: "#FFFFFF" },
});
