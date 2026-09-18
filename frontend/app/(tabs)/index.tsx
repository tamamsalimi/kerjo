import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JobCard, WorkerCard } from "@/src/components/cards";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { MatchOverlay } from "@/src/components/match-overlay";
import { SwipeDeck, type SwipeDeckRef } from "@/src/components/swipe-deck";
import { Chip, Icon, PrimaryButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import {
  CATEGORIES,
  DEFAULT_FILTERS,
  DISTANCE_OPTIONS,
  EXPERIENCE_OPTIONS,
  PAY_OPTIONS,
  TYPE_OPTIONS,
  activeFilterCount,
  categoryIcon,
  formatPay,
  type Filters,
} from "@/src/constants";
import { fetchJobs, fetchWorkers, postSwipe } from "@/src/api";
import { useLocation } from "@/src/hooks/use-location";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Mode = "work" | "hire";

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const deckRef = useRef<SwipeDeckRef>(null);

  const [mode, setMode] = useState<Mode>("work");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [cards, setCards] = useState<any[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [jobDetail, setJobDetail] = useState<any | null>(null);
  const [match, setMatch] = useState<any | null>(null);
  const [showMatch, setShowMatch] = useState(false);

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["browse", mode, filters],
    queryFn: () => (mode === "work" ? fetchJobs(filters) : fetchWorkers(filters)),
  });

  useEffect(() => {
    if (data) setCards(data);
  }, [data]);

  async function handleSwipe(item: any, dir: "left" | "right") {
    setCards((prev) => prev.filter((c) => c.id !== item.id));
    if (Platform.OS !== "web") {
      Haptics.impactAsync(dir === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const res = await postSwipe(mode === "work" ? "job" : "worker", item.id, dir);
      if (res.matched && res.match) {
        setMatch(res.match);
        setShowMatch(true);
        queryClient.invalidateQueries({ queryKey: ["matches"] });
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // silent
    }
  }

  function openDetail(item: any) {
    if (mode === "work") setJobDetail(item);
    else router.push(`/worker/${item.id}`);
  }

  async function onLocationPress() {
    if (location.status === "granted") {
      toast("Lokasi kamu aktif 📍", "success");
      return;
    }
    const r = await location.request();
    if (r === "granted") toast("Lokasi diaktifkan. Kerja terdekat diprioritaskan!", "success");
    else if (r === "blocked") toast("Aktifkan lokasi di Pengaturan untuk hasil terdekat", "info");
    else toast("Tanpa lokasi, jarak tetap ditampilkan dari data", "info");
  }

  const setFilter = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const fCount = activeFilterCount(filters);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="home-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.toggle}>
          <ModeTab label="🔍 Cari Kerja" active={mode === "work"} onPress={() => setMode("work")} testID="mode-work" />
          <ModeTab label="💼 Merekrut" active={mode === "hire"} onPress={() => setMode("hire")} testID="mode-hire" />
        </View>
        <Pressable style={styles.iconBtn} onPress={onLocationPress} testID="location-button">
          <Icon
            name={location.status === "granted" ? "map-marker-check" : "map-marker-outline"}
            size={22}
            color={location.status === "granted" ? colors.success : colors.onSurfaceTertiary}
          />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => setFilterOpen(true)} testID="filter-button">
          <Icon name="tune-variant" size={22} color={colors.onSurfaceTertiary} />
          {fCount > 0 ? (
            <View style={styles.filterDot}>
              <Text style={styles.filterDotText}>{fCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Category chip row (single horizontal scroller) */}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContent}
        >
          <Chip
            label="Semua"
            active={filters.category === "Semua"}
            onPress={() => setFilter({ category: "Semua" })}
            testID="cat-semua"
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              icon={categoryIcon(c)}
              active={filters.category === c}
              onPress={() => setFilter({ category: filters.category === c ? "Semua" : c })}
              testID={`cat-${c}`}
            />
          ))}
        </ScrollView>
      </View>

      {/* Deck */}
      <View style={[styles.deckArea, { paddingBottom: 108 + bottomChrome }]}>
        {isLoading ? (
          <View style={styles.center}>
            <View style={styles.skeleton}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
              <Text style={styles.stateText}>Memuat pilihan di dekatmu…</Text>
            </View>
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Icon name="wifi-off" size={48} color={colors.muted} />
            <Text style={styles.stateTitle}>Gagal memuat</Text>
            <Text style={styles.stateText}>Periksa koneksi internetmu.</Text>
            <PrimaryButton label="Coba Lagi" onPress={() => refetch()} style={{ marginTop: spacing.lg }} />
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyBubble}>
              <Icon name="check-all" size={44} color={colors.brandPrimary} />
            </View>
            <Text style={styles.stateTitle}>Sudah habis untuk sekarang</Text>
            <Text style={styles.stateText}>
              {mode === "work" ? "Belum ada lowongan lain" : "Belum ada pekerja lain"} sesuai filtermu.
            </Text>
            <PrimaryButton
              label="Muat Ulang"
              variant="inverse"
              loading={isFetching}
              onPress={() => refetch()}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        ) : (
          <SwipeDeck
            ref={deckRef}
            data={cards}
            keyExtractor={(i) => i.id}
            likeLabel={mode === "work" ? "LAMAR" : "SIMPAN"}
            nopeLabel="LEWAT"
            onSwipe={handleSwipe}
            renderCard={(item) =>
              mode === "work" ? (
                <JobCard item={item} onOpenDetail={() => openDetail(item)} />
              ) : (
                <WorkerCard item={item} onOpenDetail={() => openDetail(item)} />
              )
            }
          />
        )}
      </View>

      {/* Floating action buttons */}
      {cards.length > 0 && !isLoading && !isError ? (
        <View style={[styles.fabRow, { bottom: bottomChrome + spacing.lg }]}>
          <Pressable
            style={[styles.fab, styles.fabSmall]}
            onPress={() => deckRef.current?.swipeLeft()}
            testID="pass-button"
          >
            <Icon name="close" size={30} color={colors.error} />
          </Pressable>
          <Pressable
            style={[styles.fab, styles.fabLarge, { backgroundColor: colors.brandPrimary }]}
            onPress={() => deckRef.current?.swipeRight()}
            testID="like-button"
          >
            <Icon name={mode === "work" ? "hand-heart" : "bookmark-check"} size={34} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      ) : null}

      {/* Filter sheet */}
      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter" testID="filter-sheet">
        <ScrollView showsVerticalScrollIndicator={false}>
          <FilterGroup title="Jarak">
            {DISTANCE_OPTIONS.map((o) => (
              <Chip
                key={o.label}
                label={o.label}
                active={filters.max_distance === o.value}
                onPress={() => setFilter({ max_distance: o.value })}
                testID={`dist-${o.value}`}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="Bayaran">
            {PAY_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={filters.pay_bracket === o.value}
                onPress={() => setFilter({ pay_bracket: o.value })}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="Pengalaman">
            {EXPERIENCE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={filters.experience === o.value}
                onPress={() => setFilter({ experience: o.value })}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="Tipe Kerja">
            {TYPE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={filters.job_type === o.value}
                onPress={() => setFilter({ job_type: o.value })}
              />
            ))}
          </FilterGroup>
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
            <PrimaryButton
              label="Reset"
              variant="outline"
              onPress={() => setFilters({ ...DEFAULT_FILTERS, category: filters.category })}
              style={{ flex: 1 }}
            />
            <PrimaryButton label="Terapkan" onPress={() => setFilterOpen(false)} style={{ flex: 1 }} testID="apply-filter" />
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Job detail sheet */}
      <BottomSheet
        visible={!!jobDetail}
        onClose={() => setJobDetail(null)}
        title={jobDetail?.title}
        testID="job-detail-sheet"
      >
        {jobDetail ? (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.detailBiz}>
              <View style={[styles.detailIcon, { backgroundColor: colors.brandTertiary }]}>
                <Icon name={categoryIcon(jobDetail.category)} size={24} color={colors.onBrandTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailBizName}>{jobDetail.business}</Text>
                <Text style={styles.detailMeta}>{jobDetail.category} • {jobDetail.job_type}</Text>
              </View>
            </View>
            <Text style={styles.detailPay}>{formatPay(jobDetail.pay_amount, jobDetail.pay_unit)}</Text>
            <View style={styles.detailPills}>
              <DetailPill icon="map-marker" text={`${jobDetail.distance_km} km`} />
              <DetailPill icon="star-outline" text={jobDetail.min_experience_label} />
            </View>
            <Text style={styles.detailDesc}>{jobDetail.description}</Text>
            <PrimaryButton
              label="Lamar Sekarang"
              icon="hand-heart"
              testID="detail-apply"
              onPress={() => {
                const item = jobDetail;
                setJobDetail(null);
                handleSwipe(item, "right");
              }}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : null}
      </BottomSheet>

      <MatchOverlay
        visible={showMatch}
        match={match}
        onMessage={() => {
          setShowMatch(false);
          if (match) router.push(`/chat/${match.id}`);
        }}
        onKeepSwiping={() => setShowMatch(false)}
      />
    </View>
  );
}

function ModeTab({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.modeTab, active && { backgroundColor: colors.brandPrimary }]} testID={testID}>
      <Text style={[styles.modeText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>{label}</Text>
    </Pressable>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupChips}>{children}</View>
    </View>
  );
}

function DetailPill({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.dPill}>
      <Icon name={icon} size={15} color={colors.onSurfaceTertiary} />
      <Text style={styles.dPillText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  toggle: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    padding: 4,
  },
  modeTab: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  modeText: { fontFamily: fonts.medium, fontSize: 13 },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDotText: { fontFamily: fonts.medium, fontSize: 10, color: colors.onBrandPrimary },
  chipRow: { height: 56, justifyContent: "center" },
  chipContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  deckArea: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  skeleton: { alignItems: "center", gap: spacing.md },
  emptyBubble: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  stateTitle: { fontFamily: fonts.medium, fontSize: 20, color: colors.onSurface, marginTop: spacing.sm },
  stateText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4 },
  fabRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  fab: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabSmall: { width: 62, height: 62 },
  fabLarge: { width: 70, height: 70 },
  groupTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface, marginBottom: spacing.sm },
  groupChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  detailBiz: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  detailIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  detailBizName: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  detailMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  detailPay: { fontFamily: fonts.medium, fontSize: 22, color: colors.brandPrimary, marginTop: spacing.sm },
  detailPills: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  dPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dPillText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurfaceTertiary },
  detailDesc: { fontFamily: fonts.regular, fontSize: 15, color: colors.onSurfaceSecondary, lineHeight: 22, marginTop: spacing.sm },
}));
