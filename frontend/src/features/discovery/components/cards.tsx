import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

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

function Pill({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: "rgba(0,0,0,0.28)" }]}>
      <Icon name={icon} size={14} color="#FFFFFF" />
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

function KeyInfoPanel({
  distance,
  payment,
  experience,
}: {
  distance: string;
  payment: string;
  experience: string;
}) {
  return (
    <View style={styles.keyInfoPanel} testID="card-key-info-overlay">
      <KeyInfo icon="map-marker" label="Jarak" value={distance} />
      <KeyInfo icon="cash" label="Bayaran" value={payment} />
      <KeyInfo icon="briefcase-outline" label="Pengalaman" value={experience} />
    </View>
  );
}

function KeyInfo({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.keyInfo}>
      <Icon name={icon} size={16} color="#FFFFFF" />
      <Text style={styles.keyInfoLabel}>{label}</Text>
      <Text style={styles.keyInfoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const SCRIM = ["rgba(0,0,0,0)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.82)"] as const;

export function WorkerCard({
  item,
  hovered = false,
  onOpenDetail,
}: {
  item: any;
  hovered?: boolean;
  onOpenDetail: () => void;
}) {
  const { colors } = useTheme();
  const hasPhoto = !!item.avatar;
  const color = colors.brandPrimary;
  const [expanded, setExpanded] = useState(false);
  const showExpanded = Platform.OS === "web" && (hovered || expanded);
  const distance = Number.isFinite(Number(item.distance_km)) ? `${item.distance_km} km` : "Belum tersedia";
  const payment = item.pay_display || (item.pay_amount ? formatPay(item.pay_amount, item.pay_unit) : "Belum diisi");
  return (
    <Pressable
      style={[styles.card, { backgroundColor: color }]}
      onHoverIn={() => setExpanded(true)}
      onHoverOut={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
      accessible
      tabIndex={0}
      accessibilityLabel={`${item.name}, ${item.role}`}
    >
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
          <View style={styles.newHintRow}>
            <Icon name="account-heart-outline" size={16} color="#FFFFFF" />
            <Text style={styles.newHint}>Pekerja baru • beri kesempatan pertama</Text>
          </View>
        ) : (
          <View style={styles.ratingRow}>
            <RatingStars rating={item.rating} size={16} />
            <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)} • {item.jobs_completed} kerja</Text>
          </View>
        )}

        {showExpanded ? (
          <KeyInfoPanel distance={distance} payment={payment} experience={item.experience_label || "Belum diisi"} />
        ) : (
          <View style={styles.pillRow}>
            <Pill icon="map-marker" text={distance} />
            <Pill icon="cash" text={payment} />
            <Pill icon="briefcase-outline" text={item.experience_label || "Belum diisi"} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function JobCard({
  item,
  hovered = false,
  onOpenDetail,
  onOpenApplicants,
  applicantCount = 0,
}: {
  item: any;
  hovered?: boolean;
  onOpenDetail: () => void;
  onOpenApplicants?: () => void;
  applicantCount?: number;
}) {
  const { colors } = useTheme();
  const color = colors.brandPrimary;
  const [expanded, setExpanded] = useState(false);
  const showExpanded = Platform.OS === "web" && (hovered || expanded);
  const distance = Number.isFinite(Number(item.distance_km)) ? `${item.distance_km} km` : "Belum tersedia";
  const payment = item.pay_amount ? formatPay(item.pay_amount, item.pay_unit) : "Belum diisi";
  return (
    <Pressable
      style={[styles.card, { backgroundColor: color }]}
      onHoverIn={() => setExpanded(true)}
      onHoverOut={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
      accessible
      tabIndex={0}
      accessibilityLabel={`${item.title}, ${item.business}`}
    >
      <LinearGradient colors={SCRIM} locations={[0.35, 0.6, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.topRow}>
        <View style={[styles.typeTag, { backgroundColor: "rgba(0,0,0,0.28)" }]}>
          <Text style={styles.typeTagText}>{item.job_type}</Text>
        </View>
        <View style={styles.topActions}>
          {onOpenApplicants ? (
            <Pressable
              onPress={onOpenApplicants}
              hitSlop={8}
              style={styles.applicantsButton}
              testID="job-applicants-button"
            >
              <Icon name="account-multiple-check" size={17} color="#FFFFFF" />
              <Text style={styles.applicantsText}>
                Pelamar{applicantCount > 0 ? ` ${applicantCount}` : ""}
              </Text>
            </Pressable>
          ) : null}
          <InfoButton onPress={onOpenDetail} />
        </View>
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
        {showExpanded ? (
          <KeyInfoPanel
            distance={distance}
            payment={payment}
            experience={item.min_experience_label || "Tidak wajib"}
          />
        ) : (
          <View style={styles.pillRow}>
            <Pill icon="map-marker" text={distance} />
            <Pill icon="cash" text={payment} />
            <Pill icon="briefcase-outline" text={item.min_experience_label || "Tidak wajib"} />
            {item.workers_needed > 1 ? (
              <Pill icon="account-group" text={`Butuh ${item.workers_needed} orang`} />
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
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
  newHint: { fontFamily: fonts.regular, fontSize: 14, color: "rgba(255,255,255,0.9)" },
  newHintRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  ratingText: { fontFamily: fonts.medium, fontSize: 14, color: "#FFFFFF" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },
  keyInfoPanel: {
    flexDirection: "row",
    marginTop: spacing.md,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "rgba(0,0,0,0.48)",
    gap: spacing.sm,
  },
  keyInfo: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    gap: 3,
  },
  keyInfoLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
  },
  keyInfoValue: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: "#FFFFFF",
  },
  typeTag: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  typeTagText: { fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  applicantsButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  applicantsText: { fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },
  payHero: { marginTop: spacing.xs },
  payHeroText: { fontFamily: fonts.medium, fontSize: 22, color: "#FFFFFF" },
});
