import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { Icon, RatingStars, TrustBadge } from "@/src/components/ui";
import { categoryIcon, employerTypeLabel, formatPay } from "@/src/constants";
import { useAppLayout } from "@/src/layout/phone-frame";
import { mediaUrl } from "@/src/services/http-client";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

const CORNER_FILL = "rgba(230, 36, 41, 0.42)";
const CORNER_BORDER = "rgba(255, 255, 255, 0.9)";

function useCardLayout() {
  const { width, height } = useAppLayout();
  const compact = width < 430;
  const short = height < 760;
  return {
    compact,
    short,
    nameSize: compact ? 21 : 28,
    nameLineHeight: compact ? 26 : 34,
    roleSize: compact ? 14 : 16,
    paySize: compact ? 17 : 22,
    contentPad: compact ? spacing.lg : spacing.xl,
    iconSize: compact || short ? 52 : 68,
    bubbleSize: compact || short ? 88 : 120,
    showExpandedPanel: width >= 700,
  };
}

function InfoButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      testID="card-info-button"
      style={[styles.cornerBtn, { backgroundColor: CORNER_FILL, borderColor: CORNER_BORDER }]}
    >
      <Icon name="arrow-expand" size={18} color={colors.surface} />
    </Pressable>
  );
}

function Pill({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: "rgba(0,0,0,0.28)" }]}>
      <Icon name={icon} size={13} color="#FFFFFF" />
      <Text style={styles.pillText} numberOfLines={1}>{text}</Text>
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
  const layout = useCardLayout();
  const primaryPhoto = [item.avatar, ...(Array.isArray(item.photo_urls) ? item.photo_urls : [])].find(Boolean) || "";
  const hasPhoto = !!primaryPhoto;
  const color = colors.brandPrimary;
  const [expanded, setExpanded] = useState(false);
  const showExpanded = layout.showExpandedPanel && Platform.OS === "web" && (hovered || expanded);
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
        <Image
          source={{ uri: mediaUrl(primaryPhoto) }}
          style={styles.photoLayer}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : null}
      <LinearGradient
        colors={SCRIM}
        locations={[0.35, 0.6, 1]}
        style={[styles.photoLayer, styles.photoScrim]}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={[styles.cornerBtn, { backgroundColor: CORNER_FILL, borderColor: CORNER_BORDER }]}>
          <Icon name={categoryIcon(item.category)} size={20} color={colors.surface} />
        </View>
        <InfoButton onPress={onOpenDetail} />
      </View>

      <View style={styles.body}>
        {!hasPhoto ? (
          <View style={styles.center}>
            <View style={[styles.bigIconBubble, { width: layout.bubbleSize, height: layout.bubbleSize }]}>
              <Icon name={categoryIcon(item.category)} size={layout.iconSize} color="#FFFFFF" />
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.content, { paddingHorizontal: layout.contentPad, paddingBottom: layout.contentPad }]}>
        <View style={styles.badgeRow}>
          <TrustBadge isNew={item.is_new} verified={item.verified} />
        </View>
        <Text style={[styles.name, { fontSize: layout.nameSize, lineHeight: layout.nameLineHeight }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.role, { fontSize: layout.roleSize }]} numberOfLines={1}>{item.role}</Text>

        {item.is_new ? (
          <View style={styles.newHintRow}>
            <Icon name="account-heart-outline" size={16} color="#FFFFFF" />
            <Text style={styles.newHint} numberOfLines={1}>Pekerja baru • beri kesempatan pertama</Text>
          </View>
        ) : (
          <View style={styles.ratingRow}>
            <RatingStars rating={item.rating} size={16} />
            <Text style={styles.ratingText} numberOfLines={1}>{Number(item.rating).toFixed(1)} • {item.jobs_completed} kerja</Text>
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
  const layout = useCardLayout();
  const color = colors.brandPrimary;
  const [expanded, setExpanded] = useState(false);
  const showExpanded = layout.showExpandedPanel && Platform.OS === "web" && (hovered || expanded);
  const distance = Number.isFinite(Number(item.distance_km)) ? `${item.distance_km} km` : "Belum tersedia";
  const payment = item.pay_amount ? formatPay(item.pay_amount, item.pay_unit) : "Belum diisi";
  const primaryPhoto = [
    ...(Array.isArray(item.photo_urls) ? item.photo_urls : []),
    item.photo_url,
  ].find((url: string) => url && !String(url).includes("/profiles/")) || "";
  const typeLabel = layout.compact || !primaryPhoto
    ? item.job_type
    : `${item.category} · ${item.job_type}`;
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
      {primaryPhoto ? (
        <Image
          source={{ uri: mediaUrl(primaryPhoto) }}
          style={styles.photoLayer}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : null}
      <LinearGradient
        colors={SCRIM}
        locations={[0.35, 0.6, 1]}
        style={[styles.photoLayer, styles.photoScrim]}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={[styles.typeTag, { backgroundColor: CORNER_FILL, borderColor: CORNER_BORDER }]}>
          <Text style={[styles.typeTagText, { color: colors.surface }]} numberOfLines={1}>
            {typeLabel}
          </Text>
        </View>
        <View style={styles.topActions}>
          {onOpenApplicants ? (
            <Pressable
              onPress={onOpenApplicants}
              hitSlop={8}
              style={[styles.applicantsButton, { backgroundColor: CORNER_FILL, borderColor: CORNER_BORDER }]}
              testID="job-applicants-button"
            >
              <Icon name="account-multiple-check" size={17} color={colors.surface} />
              {layout.compact ? (
                applicantCount > 0 ? (
                  <Text style={[styles.applicantsText, { color: colors.surface }]}>{applicantCount}</Text>
                ) : null
              ) : (
                <Text style={[styles.applicantsText, { color: colors.surface }]}>
                  Pelamar{applicantCount > 0 ? ` ${applicantCount}` : ""}
                </Text>
              )}
            </Pressable>
          ) : null}
          <InfoButton onPress={onOpenDetail} />
        </View>
      </View>

      <View style={styles.body}>
        {!primaryPhoto ? (
          <View style={styles.center}>
            <View style={[styles.bigIconBubble, { width: layout.bubbleSize, height: layout.bubbleSize }]}>
              <Icon name={categoryIcon(item.category)} size={layout.iconSize} color="#FFFFFF" />
            </View>
            <Text style={styles.jobCategory} numberOfLines={1}>{item.category}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.content, { paddingHorizontal: layout.contentPad, paddingBottom: layout.contentPad }]}>
        <Text style={styles.business} numberOfLines={1}>
          {employerTypeLabel(item.employer_type)} · {item.business}
        </Text>
        <Text
          style={[styles.name, { fontSize: layout.nameSize, lineHeight: layout.nameLineHeight }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={styles.payHero}>
          <Text style={[styles.payHeroText, { fontSize: layout.paySize }]} numberOfLines={1}>{payment}</Text>
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
  card: { flex: 1, position: "relative", borderRadius: radius.lg, overflow: "hidden" },
  photoLayer: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", zIndex: 0 },
  photoScrim: { zIndex: 1 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  body: { flex: 1, minHeight: 0 },
  cornerBtn: {
    padding: 4,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  bigIconBubble: {
    borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  jobCategory: { fontFamily: fonts.medium, fontSize: 15, color: "rgba(255,255,255,0.92)", textAlign: "center" },
  content: { zIndex: 2, gap: spacing.xs },
  badgeRow: { flexDirection: "row", marginBottom: spacing.xs },
  name: { fontFamily: fonts.medium, color: "#FFFFFF" },
  role: { fontFamily: fonts.regular, color: "rgba(255,255,255,0.9)" },
  business: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  newHint: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: "rgba(255,255,255,0.9)" },
  newHintRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  ratingText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pillText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: "#FFFFFF" },
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
  typeTag: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "58%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  typeTagText: { fontFamily: fonts.medium, fontSize: 12 },
  topActions: { flexDirection: "row", alignItems: "center", flexShrink: 0, gap: spacing.sm },
  applicantsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  applicantsText: { fontFamily: fonts.medium, fontSize: 13 },
  payHero: { marginTop: spacing.xs },
  payHeroText: { fontFamily: fonts.medium, color: "#FFFFFF" },
});
