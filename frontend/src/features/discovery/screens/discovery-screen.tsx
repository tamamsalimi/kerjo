import Slider from "@react-native-community/slider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/auth-context";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { Chip, EmptyState, Icon, PrimaryButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import {
  CATEGORIES,
  DEFAULT_FILTERS,
  FILTER_LIMITS,
  TYPE_OPTIONS,
  activeFilterCount,
  categoryIcon,
  formatPay,
  type Filters,
} from "@/src/constants";
import { fetchJob, fetchJobs, fetchWorkers } from "@/src/features/discovery/services/discovery-service";
import { JobCard, WorkerCard } from "@/src/features/discovery/components/cards";
import {
  SwipeDeck,
  type SwipeDeckRef,
} from "@/src/features/discovery/components/swipe-deck";
import {
  fetchApplicants,
  postSwipe,
  undoSwipe,
} from "@/src/features/matching/services/matching-service";
import { MatchOverlay } from "@/src/features/matching/components/match-overlay";
import { useLocation } from "@/src/hooks/use-location";
import { ApiError } from "@/src/services/http-client";
import { usesNativeTabs } from "@/src/utils/navigation";
import { setRecentJob, useRecentJob } from "@/src/features/jobs/recent-job";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type CardType = "job" | "worker";
type BrowseFilter = "workers" | "jobs";
type FeedCard = { id: string; _cardType: CardType; [key: string]: any };

function withCardType(items: any[], cardType: CardType): FeedCard[] {
  return items.map((item) => ({ ...item, _cardType: cardType }));
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const location = useLocation();
  const deckRef = useRef<SwipeDeckRef>(null);

  const registrationComplete = Boolean(user);
  const [browseFilter, setBrowseFilter] = useState<BrowseFilter>("jobs");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [jobDetail, setJobDetail] = useState<any | null>(null);
  const [match, setMatch] = useState<any | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [screening, setScreening] = useState<{ item: any; answers: string[] } | null>(null);

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const justPostedJob = useRecentJob();

  const { data, error, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["browse", browseFilter, filters, location.coords],
    queryFn: async () => {
      if (browseFilter === "jobs") return withCardType(await fetchJobs(filters, location.coords), "job");
      const workerFilters = { ...filters, job_type: "Semua" };
      return withCardType(await fetchWorkers(workerFilters, location.coords), "worker");
    },
    enabled: registrationComplete,
    retry: (failureCount, queryError) =>
      queryError instanceof ApiError && queryError.status === 409 ? false : failureCount < 2,
    refetchInterval: registrationComplete ? 5000 : false,
  });
  const accessBlocked = isError && error instanceof ApiError && error.status === 409;

  useFocusEffect(
    useCallback(() => {
      if (registrationComplete) void refetch();
    }, [registrationComplete, refetch]),
  );

  const { error: recentJobError } = useQuery({
    queryKey: ["recent-job-visibility", justPostedJob?.id],
    queryFn: () => fetchJob(justPostedJob!.id),
    enabled: registrationComplete && Boolean(justPostedJob?.id),
    refetchInterval: registrationComplete && justPostedJob?.id ? 5000 : false,
    retry: false,
  });

  const { data: applicants } = useQuery({
    queryKey: ["applicants"],
    queryFn: fetchApplicants,
    enabled: registrationComplete,
    refetchInterval: registrationComplete ? 8000 : false,
  });
  const applicantCount = applicants?.length ?? 0;

  useEffect(() => {
    const feed = data ?? [];
    const recentJob =
      justPostedJob?.owner_user_id === user?.user_id
        ? { ...justPostedJob, _cardType: "job" as const }
        : null;
    if (browseFilter === "workers" || !recentJob) {
      setCards(feed);
      return;
    }
    setCards([recentJob, ...feed.filter((item) => item.id !== recentJob.id)]);
  }, [browseFilter, data, justPostedJob, user?.user_id]);

  useEffect(() => {
    if (justPostedJob) setBrowseFilter("jobs");
  }, [justPostedJob]);

  useEffect(() => {
    if (justPostedJob && recentJobError instanceof ApiError && recentJobError.status === 404) {
      setRecentJob(null);
    }
  }, [justPostedJob, recentJobError]);

  useEffect(() => {
    if (!registrationComplete) router.replace("/onboarding");
  }, [registrationComplete, router]);

  async function doSwipe(item: any, dir: "left" | "right", answers?: string[]) {
    const cardType = item._cardType as CardType;
    try {
      const res = await postSwipe(cardType, item.id, dir, answers);
      if (res.matched && res.match) {
        setMatch(res.match);
        setShowMatch(true);
        setUndoStack([]); // can't undo a swipe that produced a match
        queryClient.invalidateQueries({ queryKey: ["matches"] });
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setUndoStack((prev) => [...prev, { item, type: cardType }]);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setCards((prev) => (prev.some((card) => card.id === item.id) ? prev : [item, ...prev]));
        toast(
          cardType === "job"
            ? "Lengkapi Profil Kerja dulu untuk swipe Lowongan"
            : "Pasang Lowongan dulu untuk swipe Pekerja",
          "info",
        );
        void refetch();
        return;
      }
      if (
        cardType === "job" &&
        error instanceof ApiError &&
        (error.status === 404 || error.status === 422)
      ) {
        setCards((prev) => prev.filter((card) => card.id !== item.id));
        setJobDetail((current: any | null) => (current?.id === item.id ? null : current));
        toast("Lowongan ini sudah ditutup", "info");
        return;
      }
      setCards((prev) => (prev.some((card) => card.id === item.id) ? prev : [item, ...prev]));
      toast("Swipe gagal diproses. Coba lagi.", "error");
    }
  }

  function handleSwipe(item: any, dir: "left" | "right") {
    setCards((prev) => prev.filter((c) => c.id !== item.id));
    if (Platform.OS !== "web") {
      Haptics.impactAsync(dir === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    }
    // If applying to a job that has screening questions, collect answers first.
    if (item._cardType === "job" && dir === "right" && Array.isArray(item.screening_questions) && item.screening_questions.length) {
      setScreening({ item, answers: item.screening_questions.map(() => "") });
      return;
    }
    doSwipe(item, dir);
  }

  async function handleUndo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((prev) => prev.slice(0, -1));
    try {
      await undoSwipe(last.type, last.item.id);
    } catch {
      // silent
    }
    setCards((prev) => (prev.some((c) => c.id === last.item.id) ? prev : [last.item, ...prev]));
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }

  function openDetail(item: any) {
    if (item._cardType === "job") setJobDetail(item);
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
  const toggleCategory = (category: string) =>
    setFilters((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((value) => value !== category)
        : [...current.categories, category],
    }));
  const openCategoryPopup = () => {
    setFilterOpen(false);
    setTimeout(() => setCategoryOpen(true), 120);
  };
  const closeCategoryPopup = () => {
    setCategoryOpen(false);
    setTimeout(() => setFilterOpen(true), 120);
  };
  const fCount = activeFilterCount(filters);
  const advancedFilterCount = fCount + (location.status === "granted" ? 1 : 0);
  const activeCard = cards[0];
  const activeCardType = activeCard?._cardType;
  if (!registrationComplete) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
        <Text style={styles.stateText}>Menyiapkan halaman jelajah…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="home-screen">
      <View style={styles.topFilters} testID="browse-filter">
        <TopFilterButton
          label="Pekerja"
          icon="account-hard-hat"
          active={browseFilter === "workers"}
          onPress={() => setBrowseFilter("workers")}
          testID="browse-filter-workers"
        />
        <TopFilterButton
          label="Lowongan"
          icon="briefcase"
          active={browseFilter === "jobs"}
          onPress={() => setBrowseFilter("jobs")}
          testID="browse-filter-jobs"
        />
        <TopFilterButton
          label="Filter"
          icon="filter"
          active={advancedFilterCount > 0}
          onPress={() => setFilterOpen(true)}
          testID="filter-button"
        />
      </View>

      {/* Job posting is contextual to the Lowongan scope. */}
      {browseFilter === "jobs" ? (
        <View style={styles.hireBar}>
          <Pressable
            style={[styles.hireBtn, styles.hireBtnPrimary]}
            onPress={() => router.push("/post-job")}
            testID="post-shortcut"
          >
            <Icon name="plus" size={18} color={colors.onBrandPrimary} />
            <Text style={[styles.hireBtnText, { color: colors.onBrandPrimary }]}>Pasang Kerja</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Deck */}
      <View style={[styles.deckArea, { paddingBottom: 108 + bottomChrome }]}>
        {isLoading ? (
          <View style={styles.center}>
            <View style={styles.skeleton}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
              <Text style={styles.stateText}>Memuat pilihan di dekatmu…</Text>
            </View>
          </View>
        ) : accessBlocked ? (
          <EmptyState
            icon={browseFilter === "jobs" ? "account-edit" : "briefcase-plus"}
            title={browseFilter === "jobs" ? "Lengkapi Profil Kerja dulu" : "Pasang Lowongan dulu"}
            message={
              browseFilter === "jobs"
                ? "Isi profil pekerja supaya lowongan yang kamu lihat lebih relevan."
                : "Buat minimal satu lowongan aktif supaya kamu bisa mencari pekerja yang sesuai."
            }
          >
            <PrimaryButton
              label={browseFilter === "jobs" ? "Lengkapi Profil" : "Pasang Lowongan"}
              icon={browseFilter === "jobs" ? "account-edit" : "plus"}
              onPress={() => router.push(browseFilter === "jobs" ? "/onboarding" : "/post-job")}
              style={{ marginTop: spacing.lg }}
              testID="browse-requirement-action"
            />
          </EmptyState>
        ) : isError ? (
          <View style={styles.center}>
            <Icon name="wifi-off" size={48} color={colors.muted} />
            <Text style={styles.stateTitle}>Gagal memuat</Text>
            <Text style={styles.stateText}>Periksa koneksi internetmu.</Text>
            <PrimaryButton label="Coba Lagi" onPress={() => refetch()} style={{ marginTop: spacing.lg }} />
          </View>
        ) : cards.length === 0 ? (
          <EmptyState
            icon="check-all"
            title="Data tidak ditemukan"
            message={`${browseFilter === "jobs"
                ? "Belum ada lowongan lain"
                : browseFilter === "workers"
                  ? "Belum ada pekerja lain"
                  : "Belum ada kartu lain"} sesuai filtermu.`}
          >
            <PrimaryButton
              label="Muat Ulang"
              variant="inverse"
              loading={isFetching}
              onPress={() => refetch()}
              style={{ marginTop: spacing.lg }}
            />
          </EmptyState>
        ) : (
          <SwipeDeck
            ref={deckRef}
            data={cards}
            keyExtractor={(item) => `${item._cardType}-${item.id}`}
            likeLabel={activeCardType === "job" ? "LAMAR" : "SIMPAN"}
            nopeLabel="LEWAT"
            onSwipe={handleSwipe}
            renderCard={(item, hovered) =>
              item._cardType === "job" ? (
                <JobCard
                  item={item}
                  hovered={hovered}
                  onOpenDetail={() => openDetail(item)}
                  onOpenApplicants={
                    item.owner_user_id === user?.user_id ? () => router.push("/applicants") : undefined
                  }
                  applicantCount={item.owner_user_id === user?.user_id ? applicantCount : 0}
                />
              ) : (
                <WorkerCard item={item} hovered={hovered} onOpenDetail={() => openDetail(item)} />
              )
            }
          />
        )}
      </View>

      {/* Floating action buttons */}
      {cards.length > 0 && !isLoading && !isError ? (
        <View style={[styles.fabRow, { bottom: bottomChrome + spacing.lg }]}>
          {undoStack.length > 0 ? (
            <Pressable
              style={[styles.fab, styles.fabTiny]}
              onPress={handleUndo}
              testID="undo-button"
            >
              <Icon name="undo-variant" size={24} color={colors.brandPrimary} />
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.fab, styles.fabSmall]}
            onPress={() => deckRef.current?.swipeLeft()}
            testID="pass-button"
          >
            <Icon name="close" size={30} color={colors.onSurfaceTertiary} />
          </Pressable>
          <Pressable
            style={[styles.fab, styles.fabLarge, { backgroundColor: colors.brandPrimary }]}
            onPress={() => deckRef.current?.swipeRight()}
            testID="like-button"
          >
            <Icon
              name={activeCardType === "job" ? "hand-heart" : "bookmark-check"}
              size={34}
              color={colors.onBrandPrimary}
            />
          </Pressable>
        </View>
      ) : null}

      {/* Filter sheet */}
      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter" testID="filter-sheet">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Pressable
            style={({ pressed }) => [styles.categoryPicker, pressed && styles.pressed]}
            onPress={openCategoryPopup}
            testID="category-popup-trigger"
          >
            <CategoryMark />
            <View style={styles.categoryPickerCopy}>
              <Text style={styles.categoryPickerTitle}>Kategori</Text>
              <Text style={styles.categoryPickerValue} numberOfLines={1}>
                {filters.categories.length === 0
                  ? "Semua kategori"
                  : filters.categories.length === 1
                    ? filters.categories[0]
                    : `${filters.categories.length} kategori dipilih`}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.locationFilter, pressed && styles.pressed]}
            onPress={onLocationPress}
            testID="location-button"
          >
            <View style={styles.locationFilterIcon}>
              <Icon
                name={location.status === "granted" ? "map-marker-check" : "map-marker-outline"}
                size={22}
                color={colors.brandPrimary}
              />
            </View>
            <View style={styles.locationFilterCopy}>
              <Text style={styles.locationFilterTitle}>Lokasi</Text>
              <Text style={styles.locationFilterText}>
                {location.status === "granted"
                  ? "Aktif · hasil terdekat diprioritaskan"
                  : "Aktifkan untuk hasil kerja terdekat"}
              </Text>
            </View>
            <Icon
              name={location.status === "granted" ? "check-circle" : "chevron-right"}
              size={20}
              color={location.status === "granted" ? colors.brandPrimary : colors.muted}
            />
          </Pressable>
          <ContinuousFilterSlider
            title="Jarak"
            value={filters.max_distance}
            minimumValue={FILTER_LIMITS.distance.min}
            maximumValue={FILTER_LIMITS.distance.max}
            formatValue={(value) => `${value.toFixed(1)} km`}
            onChange={(max_distance) => setFilter({ max_distance: Math.round(max_distance * 10) / 10 })}
            testID="distance-slider"
          />
          <ContinuousFilterSlider
            title="Bayaran"
            value={filters.max_pay}
            minimumValue={FILTER_LIMITS.pay.min}
            maximumValue={FILTER_LIMITS.pay.max}
            formatValue={formatSliderPay}
            onChange={(max_pay) => setFilter({ max_pay: Math.round(max_pay) })}
            testID="pay-slider"
          />
          <ContinuousFilterSlider
            title="Pengalaman"
            value={filters.max_experience}
            minimumValue={FILTER_LIMITS.experience.min}
            maximumValue={FILTER_LIMITS.experience.max}
            formatValue={(value) => `${value.toFixed(1)} tahun`}
            onChange={(max_experience) => setFilter({ max_experience: Math.round(max_experience * 10) / 10 })}
            testID="experience-slider"
          />
          <FilterGroup title="Tipe Kerja">
            {TYPE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={filters.job_type === o.value}
                onPress={() => setFilter({ job_type: o.value })}
                variant="outlined"
              />
            ))}
          </FilterGroup>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <PrimaryButton
              label="Reset"
              variant="outline"
              onPress={() => setFilters({ ...DEFAULT_FILTERS, categories: [] })}
              style={{ flex: 1 }}
            />
            <PrimaryButton label="Terapkan" onPress={() => setFilterOpen(false)} style={{ flex: 1 }} testID="apply-filter" />
          </View>
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={categoryOpen}
        onClose={closeCategoryPopup}
        title="Pilih kategori"
        testID="category-popup"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.categoryPopupHint}>Kamu bisa memilih lebih dari satu kategori.</Text>
          <View style={styles.groupChips}>
            {CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={category}
                icon={categoryIcon(category)}
                active={filters.categories.includes(category)}
                onPress={() => toggleCategory(category)}
                testID={`filter-category-${category}`}
              />
            ))}
          </View>
          <View style={styles.categoryPopupActions}>
            <PrimaryButton
              label="Reset"
              variant="outline"
              onPress={() => setFilter({ categories: [] })}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Selesai"
              onPress={closeCategoryPopup}
              style={{ flex: 1 }}
              testID="category-popup-done"
            />
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
          if (user?.verification_status !== "approved") {
            toast("Verifikasi identitas untuk membuka Chat", "info");
            router.push("/verification");
          } else if (match) {
            router.push(`/chat/${match.id}`);
          }
        }}
        onKeepSwiping={() => setShowMatch(false)}
      />

      {/* Screening questions sheet */}
      <BottomSheet
        visible={!!screening}
        onClose={() => {
          if (screening) doSwipe(screening.item, "right", screening.answers);
          setScreening(null);
        }}
        title="Pertanyaan Screening"
        testID="screening-sheet"
      >
        {screening ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.screenHint}>
              Jawab beberapa pertanyaan dari pemberi kerja agar lamaranmu lebih dilirik.
            </Text>
            {screening.item.screening_questions.map((q: string, i: number) => (
              <View key={i} style={{ marginBottom: spacing.md }}>
                <Text style={styles.screenQ}>{i + 1}. {q}</Text>
                <TextInput
                  style={styles.screenInput}
                  value={screening.answers[i]}
                  onChangeText={(t) =>
                    setScreening((s) =>
                      s ? { ...s, answers: s.answers.map((a, idx) => (idx === i ? t : a)) } : s,
                    )
                  }
                  placeholder="Jawabanmu…"
                  placeholderTextColor={colors.muted}
                  multiline
                  testID={`screening-answer-${i}`}
                />
              </View>
            ))}
            <PrimaryButton
              label="Kirim Lamaran"
              icon="send"
              testID="screening-submit"
              onPress={() => {
                const s = screening;
                setScreening(null);
                if (s) doSwipe(s.item, "right", s.answers);
              }}
              style={{ marginTop: spacing.sm }}
            />
          </ScrollView>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function TopFilterButton({
  label,
  icon,
  active,
  onPress,
  testID,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.topFilterButton,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      testID={testID}
    >
      <Icon
        name={icon}
        size={23}
        color={active ? colors.brandPrimary : colors.muted}
      />
      <View style={styles.topFilterLabelRow}>
        <Text
          style={[styles.topFilterText, active && styles.topFilterTextActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupChips}>{children}</View>
    </View>
  );
}

function CategoryMark() {
  const styles = useStyles();
  const { colors } = useTheme();
  const petals = [
    { petal: styles.categoryPetalTopLeft, facet: styles.categoryFacetTopLeft, shade: colors.brandDeep },
    { petal: styles.categoryPetalTopRight, facet: styles.categoryFacetTopRight, shade: colors.onBrandSecondary },
    { petal: styles.categoryPetalBottomLeft, facet: styles.categoryFacetBottomLeft, shade: colors.onBrandSecondary },
    { petal: styles.categoryPetalBottomRight, facet: styles.categoryFacetBottomRight, shade: colors.brandDeep },
  ];

  return (
    <View style={styles.categoryMark} accessible={false}>
      {petals.map((item, index) => (
        <View key={index} style={[styles.categoryPetal, item.petal, { backgroundColor: colors.brandPrimary }]}>
          <View style={[styles.categoryFacet, item.facet, { backgroundColor: item.shade }]} />
        </View>
      ))}
    </View>
  );
}

function ContinuousFilterSlider({
  title,
  value,
  minimumValue,
  maximumValue,
  formatValue,
  onChange,
  testID,
}: {
  title: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  formatValue: (value: number) => string;
  onChange: (value: number) => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => setDraftValue(value), [value]);
  const displayedValue = Math.max(minimumValue, Math.min(maximumValue, draftValue));

  return (
    <View style={styles.sliderGroup}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.groupTitle, styles.sliderTitle]}>{title}</Text>
        <View style={styles.sliderValue}>
          <Text style={styles.sliderValueText}>Maks. {formatValue(displayedValue)}</Text>
        </View>
      </View>
      <Slider
        testID={testID}
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        value={draftValue}
        minimumTrackTintColor={colors.brandPrimary}
        maximumTrackTintColor={colors.borderStrong}
        thumbTintColor={colors.brandPrimary}
        onValueChange={setDraftValue}
        onSlidingComplete={onChange}
        accessibilityLabel={`Filter ${title}`}
        accessibilityValue={{
          min: minimumValue,
          max: maximumValue,
          now: displayedValue,
          text: formatValue(displayedValue),
        }}
      />
      <View style={styles.sliderLabels}>
        <Text style={[styles.sliderLabel, styles.sliderLabelFirst]}>{formatValue(minimumValue)}</Text>
        <Text style={[styles.sliderLabel, styles.sliderLabelLast]}>{formatValue(maximumValue)}</Text>
      </View>
    </View>
  );
}

function formatSliderPay(value: number): string {
  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })}jt`;
  }
  return `Rp${Math.round(value / 1_000).toLocaleString("id-ID")}rb`;
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
  topFilters: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  topFilterButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: spacing.xs,
  },
  topFilterText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 82,
  },
  topFilterTextActive: { fontFamily: fonts.semibold, color: colors.brandPrimary },
  topFilterLabelRow: {
    minHeight: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  categoryPicker: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  categoryMark: {
    width: 28,
    height: 28,
    position: "relative",
    marginHorizontal: 3,
  },
  categoryPetal: {
    position: "absolute",
    width: 13,
    height: 13,
    overflow: "hidden",
  },
  categoryPetalTopLeft: {
    left: 0,
    top: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 3,
  },
  categoryPetalTopRight: {
    right: 0,
    top: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 8,
  },
  categoryPetalBottomLeft: {
    left: 0,
    bottom: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 8,
  },
  categoryPetalBottomRight: {
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 10,
  },
  categoryFacet: {
    position: "absolute",
    width: 10,
    height: 10,
    transform: [{ rotate: "45deg" }],
  },
  categoryFacetTopLeft: { right: -6, bottom: -6 },
  categoryFacetTopRight: { left: -6, bottom: -6 },
  categoryFacetBottomLeft: { right: -6, top: -6 },
  categoryFacetBottomRight: { left: -6, top: -6 },
  categoryPickerCopy: { flex: 1 },
  categoryPickerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
  },
  categoryPickerValue: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 1,
  },
  categoryPopupHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  categoryPopupActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  locationFilter: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  locationFilterIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  locationFilterCopy: { flex: 1 },
  locationFilterTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  locationFilterText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 1,
  },
  deckArea: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  skeleton: { alignItems: "center", gap: spacing.md },
  stateTitle: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface, marginTop: spacing.sm },
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
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabSmall: { width: 62, height: 62 },
  fabLarge: { width: 70, height: 70 },
  fabTiny: { width: 52, height: 52 },
  hireBar: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  hireBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  hireBtnPrimary: { backgroundColor: colors.brandPrimary },
  hireBtnText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brandPrimary },
  screenHint: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
  screenQ: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface, marginBottom: spacing.xs },
  screenInput: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.onSurface,
    minHeight: 56,
    textAlignVertical: "top",
  },
  groupTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface, marginBottom: spacing.sm },
  groupChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  sliderGroup: { marginBottom: spacing.md },
  sliderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sliderTitle: { marginBottom: 0 },
  sliderValue: {
    paddingLeft: spacing.sm,
  },
  sliderValueText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.brandPrimary },
  slider: { width: "100%", height: 30, marginTop: 2 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between" },
  sliderLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  sliderLabelFirst: { textAlign: "left" },
  sliderLabelLast: { textAlign: "right" },
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
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
}));
