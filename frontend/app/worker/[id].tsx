import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, RatingStars, TrustBadge } from "@/src/components/ui";
import { categoryIcon, formatPay } from "@/src/constants";
import { fetchWorker } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function WorkerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const { data: w, isLoading } = useQuery({ queryKey: ["worker", id], queryFn: () => fetchWorker(id!) });

  if (isLoading || !w) {
    return (
      <View style={[styles.container, styles.center]} testID="worker-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  const reviews = w.reviews ?? [];

  return (
    <View style={styles.container} testID="worker-screen">
      <Pressable style={[styles.back, { top: insets.top + spacing.sm }]} onPress={() => router.back()} testID="worker-back">
        <Icon name="chevron-left" size={26} color="#FFFFFF" />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.banner}>
          <Image source={{ uri: w.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(28,28,28,0.75)"]} style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.body}>
          <View style={styles.headRow}>
            <Image source={{ uri: w.avatar }} style={styles.avatar} contentFit="cover" />
            <View style={styles.catBubble}>
              <Icon name={categoryIcon(w.category)} size={22} color={colors.onBrandTertiary} />
            </View>
          </View>

          <Text style={styles.name}>{w.name}</Text>
          <Text style={styles.role}>{w.role}</Text>
          <View style={{ flexDirection: "row", marginTop: spacing.sm }}>
            <TrustBadge isNew={w.is_new} verified={w.verified} />
          </View>

          {/* Trust stats */}
          <View style={styles.stats}>
            <Stat value={w.is_new ? "Baru" : w.rating.toFixed(1)} label="Rating" icon="star" />
            <View style={styles.statDivider} />
            <Stat value={String(w.jobs_completed)} label="Kerja selesai" icon="briefcase-check" />
            <View style={styles.statDivider} />
            <Stat value={`${w.distance_km} km`} label="Jarak" icon="map-marker" />
          </View>

          <View style={styles.payCard}>
            <Text style={styles.payLabel}>Tarif</Text>
            <Text style={styles.payValue}>
              {w.pay_display ? w.pay_display : w.pay_amount ? formatPay(w.pay_amount, w.pay_unit) : "Bisa dinegosiasi"}
            </Text>
            <Text style={styles.expLabel}>{w.experience_label} pengalaman</Text>
          </View>

          <Text style={styles.sectionTitle}>Tentang</Text>
          <Text style={styles.bio}>{w.bio}</Text>

          <Text style={styles.sectionTitle}>Ulasan {reviews.length > 0 ? `(${reviews.length})` : ""}</Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>
              {w.is_new ? "Pekerja baru — jadilah yang pertama memberi ulasan!" : "Belum ada ulasan."}
            </Text>
          ) : (
            reviews.map((r: any) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewAuthor}>{r.author}</Text>
                  <RatingStars rating={r.rating} size={14} />
                </View>
                <Text style={styles.reviewText}>&ldquo;{r.comment}&rdquo;</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  back: {
    position: "absolute",
    left: spacing.lg,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  banner: { height: 220, backgroundColor: "#222" },
  body: { paddingHorizontal: spacing.lg, marginTop: -48 },
  headRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  avatar: { width: 96, height: 96, borderRadius: radius.pill, borderWidth: 4, borderColor: colors.surface },
  catBubble: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  name: { fontFamily: fonts.medium, fontSize: 26, color: colors.onSurface, marginTop: spacing.sm },
  role: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted, marginTop: 2 },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: colors.divider },
  statValue: { fontFamily: fonts.medium, fontSize: 18, color: colors.onSurface },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  payCard: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  payLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.onBrandTertiary },
  payValue: { fontFamily: fonts.medium, fontSize: 24, color: colors.onBrandTertiary, marginTop: 2 },
  expLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.onBrandTertiary, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.medium, fontSize: 18, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.sm },
  bio: { fontFamily: fonts.regular, fontSize: 15, color: colors.onSurfaceSecondary, lineHeight: 22 },
  noReviews: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, lineHeight: 21 },
  reviewCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  reviewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  reviewAuthor: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  reviewText: { fontFamily: fonts.regular, fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 21, fontStyle: "italic" },
}));
