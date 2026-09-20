import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/auth-context";
import { fetchProfileHistory } from "@/src/features/profile/services/profile-service";
import { BrandLockup, CategoryAvatar, Icon, PrimaryButton } from "@/src/components/ui";
import { categoryIcon } from "@/src/constants";
import { usesNativeTabs } from "@/src/utils/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type ProfileTab = "employer" | "worker";

const BACKDROP_ICONS = [
  { icon: "broom", top: 18, left: -15, size: 50, tone: 0, rotate: "-10deg" },
  { icon: "hammer-wrench", top: 48, right: -12, size: 46, tone: 1, rotate: "8deg" },
  { icon: "car", top: 118, left: -12, size: 42, tone: 2, rotate: "-5deg" },
  { icon: "motorbike", top: 142, right: -8, size: 48, tone: 0, rotate: "7deg" },
  { icon: "chef-hat", top: 220, left: -14, size: 46, tone: 1, rotate: "-7deg" },
  { icon: "laptop", top: 230, right: -14, size: 50, tone: 2, rotate: "6deg" },
  { icon: "sprout", top: 302, left: 12, size: 42, tone: 0, rotate: "-5deg" },
  { icon: "wrench-outline", top: 304, right: 17, size: 40, tone: 1, rotate: "9deg" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  open: "Masih dibuka",
  full: "Sudah terpenuhi",
  closed: "Ditutup",
  matched: "Diminati",
  aligned: "Cocok",
  scheduled: "Terjadwal",
  completed: "Selesai",
};

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;
  const [tab, setTab] = useState<ProfileTab>("employer");
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const scrollOffset = useRef(0);
  const scrollStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const indicatorTranslateY = useRef(new Animated.Value(0)).current;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile-history"],
    queryFn: fetchProfileHistory,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
      refreshUserRef.current();
    }, [refetch]),
  );

  const profile = data?.worker_profile;
  const ratings = data?.ratings;
  const employerJobs = data?.employer_jobs ?? [];
  const workerJobs = data?.worker_jobs ?? [];
  const ratingsGiven = data?.ratings_given ?? [];
  const ratingsReceived = data?.ratings_received ?? [];
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const verification = verificationDisplay(user?.verification_status, colors);
  const completeness = profileCompleteness(profile, user);
  const isScrollable = contentHeight > viewportHeight + spacing.sm;

  useEffect(() => {
    const visible = isScrollable && !isScrolling && !atBottom;
    Animated.timing(indicatorOpacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 140,
      useNativeDriver: true,
    }).start();

    if (!visible) {
      indicatorTranslateY.setValue(0);
      return;
    }

    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(indicatorTranslateY, {
          toValue: 3,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(indicatorTranslateY, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    bob.start();
    return () => bob.stop();
  }, [atBottom, indicatorOpacity, indicatorTranslateY, isScrollable, isScrolling]);

  useEffect(() => () => {
    if (scrollStopTimer.current) clearTimeout(scrollStopTimer.current);
  }, []);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scrollOffset.current = contentOffset.y;
    const reachedBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - spacing.md;
    setAtBottom(reachedBottom);
    setIsScrolling(true);
    if (scrollStopTimer.current) clearTimeout(scrollStopTimer.current);
    scrollStopTimer.current = setTimeout(() => setIsScrolling(false), 180);
  }

  function handleContentSizeChange(height: number) {
    setContentHeight(height);
    setAtBottom(scrollOffset.current + viewportHeight >= height - spacing.md);
  }

  function handleViewportLayout(height: number) {
    setViewportHeight(height);
    setAtBottom(scrollOffset.current + height >= contentHeight - spacing.md);
  }

  function stopScrolling() {
    if (scrollStopTimer.current) clearTimeout(scrollStopTimer.current);
    setIsScrolling(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="profile-screen">
      <View style={styles.stickyHero}>
        <ProfileBackdrop />
        <View style={styles.brandRow}>
          <BrandLockup compact />
        </View>

        <LinearGradient
          colors={[colors.brandPrimary, colors.brandDeep, colors.onSurface]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={[styles.heroDecoration, styles.heroDecorationLeft]}>
            <Icon name="camera-outline" size={20} color={colors.onBrandPrimary} />
          </View>
          <View style={[styles.heroDecoration, styles.heroDecorationRight]}>
            <Icon name="store-outline" size={21} color={colors.onBrandPrimary} />
          </View>
          <View style={[styles.heroDecoration, styles.heroDecorationBottom]}>
            <Icon name="school-outline" size={18} color={colors.onBrandPrimary} />
          </View>
          <View style={styles.avatarShell}>
            <CategoryAvatar
              category={profile?.category}
              photo={profile?.photo_url || user?.picture}
              size={104}
              variant="inverse"
            />
          </View>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>Senang ketemu kamu</Text>
            <Icon name="hand-wave-outline" size={15} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.name}>{user?.name || "Teman Kerjo"}</Text>
          <Text style={styles.email}>{user?.email}</Text>

          <Pressable
            style={({ pressed }) => [
              styles.verifyButton,
              { backgroundColor: verification.background },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/verification")}
            testID="profile-verification-status"
          >
            <Icon name={verification.icon} size={16} color={verification.iconColor} />
            <Text style={[styles.verifyText, { color: verification.textColor }]}>
              {verification.label}
            </Text>
            {verification.showChevron ? (
              <Icon name="chevron-right" size={16} color={verification.chevronColor} />
            ) : null}
          </Pressable>

          {ratings?.combined?.count ? (
            <View style={styles.ratingLine}>
              <View style={styles.ratingBadge}>
                <Icon name="star" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.ratingValue}>{ratings.combined.average.toFixed(1)}</Text>
              </View>
              <Text style={styles.ratingCopy}>
                {ratings.combined.count} ulasan · {ratingBreakdownText(ratings)}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.scrollAffordance,
            {
              opacity: indicatorOpacity,
              transform: [{ translateY: indicatorTranslateY }],
            },
          ]}
        >
          <View style={styles.scrollAffordanceBar} />
          <Icon name="chevron-down" size={16} color={colors.brandPrimary} />
        </Animated.View>
      </View>

      <ScrollView
        style={styles.contentScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomChrome + spacing["2xl"] },
        ]}
        onLayout={(event) => handleViewportLayout(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => handleContentSizeChange(height)}
        onScroll={handleScroll}
        onScrollBeginDrag={() => setIsScrolling(true)}
        onMomentumScrollBegin={() => setIsScrolling(true)}
        onMomentumScrollEnd={stopScrolling}
        scrollEventThrottle={16}
      >
        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>Kamu di Kerjo sebagai</Text>
          <View style={styles.tabs} testID="profile-role-tabs">
            <ProfileTabButton
              icon="account-hard-hat-outline"
              label="Pencari Kerja"
              active={tab === "worker"}
              onPress={() => setTab("worker")}
              testID="profile-tab-worker"
            />
            <ProfileTabButton
              icon="storefront-outline"
              label="Pemberi Kerja"
              active={tab === "employer"}
              onPress={() => setTab("employer")}
              testID="profile-tab-employer"
            />
          </View>
          <Text style={styles.roleHelper}>Role ini menentukan ringkasan yang kamu lihat di sini.</Text>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Lagi menyiapkan data dirimu…</Text>
          </View>
        ) : tab === "worker" ? (
          <WorkerView
            profile={profile}
            jobs={workerJobs}
            reviews={ratingsReceived}
            completeness={completeness}
            onEditProfile={() => router.push("/onboarding")}
          />
        ) : (
          <EmployerView jobs={employerJobs} reviews={ratingsGiven} ratings={ratings} />
        )}

        <View style={styles.accountActions}>
          <PrimaryButton
            label="Keluar"
            icon="logout"
            onPress={signOut}
            testID="logout-button"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ProfileBackdrop() {
  const styles = useStyles();
  const { colors } = useTheme();
  const iconPalette = [
    { color: colors.onBrandPrimary, background: colors.brandPrimary },
    { color: colors.onBrandPrimary, background: colors.brandDeep },
    { color: colors.onSurface, background: colors.surface },
  ];
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.backdrop}
    >
      <LinearGradient
        colors={[colors.surface, colors.surfaceTertiary, colors.surface]}
        locations={[0, 0.58, 1]}
        style={styles.backdropGradient}
      />
      <View style={[styles.colorBlob, styles.blobRed]} />
      <View style={[styles.colorBlob, styles.blobOrange]} />
      <View style={[styles.colorBlob, styles.blobLavender]} />
      <View style={[styles.colorBlob, styles.blobBlue]} />
      {BACKDROP_ICONS.map((item) => {
        const tone = iconPalette[item.tone];
        return (
          <View
            key={item.icon}
            style={[
              styles.backdropIcon,
              {
                top: item.top,
                left: "left" in item ? item.left : undefined,
                right: "right" in item ? item.right : undefined,
                width: item.size,
                height: item.size,
                borderRadius: item.size / 2,
                backgroundColor: tone.background,
                transform: [{ rotate: item.rotate }],
              },
            ]}
          >
            <Icon name={item.icon} size={Math.round(item.size * 0.43)} color={tone.color} />
          </View>
        );
      })}
    </View>
  );
}

function verificationDisplay(status: string | undefined, colors: any) {
  switch (status) {
    case "approved":
      return {
        label: "Terverifikasi",
        icon: "check-decagram",
        iconColor: colors.onSuccess,
        textColor: colors.onSuccess,
        chevronColor: colors.onSuccess,
        background: colors.success,
        showChevron: false,
      };
    case "pending":
      return {
        label: "Verifikasi sedang diperiksa",
        icon: "clock-outline",
        iconColor: colors.brandDeep,
        textColor: colors.onSurface,
        chevronColor: colors.muted,
        background: colors.surface,
        showChevron: true,
      };
    case "rejected":
      return {
        label: "Verifikasi perlu diperbaiki",
        icon: "alert-circle-outline",
        iconColor: colors.error,
        textColor: colors.onSurface,
        chevronColor: colors.muted,
        background: colors.surface,
        showChevron: true,
      };
    default:
      return {
        label: "Verifikasi",
        icon: "alert",
        iconColor: colors.onSurface,
        textColor: colors.onSurface,
        chevronColor: colors.onSurface,
        background: colors.attention,
        showChevron: true,
      };
  }
}

function ProfileTabButton({
  icon,
  label,
  active,
  onPress,
  testID,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.tabButton,
        active && styles.tabButtonActive,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      testID={testID}
    >
      <Icon name={icon} size={20} color={active ? colors.brandPrimary : colors.muted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function WorkerView({
  profile,
  jobs,
  reviews,
  completeness,
  onEditProfile,
}: {
  profile: any;
  jobs: any[];
  reviews: any[];
  completeness: number;
  onEditProfile: () => void;
}) {
  const matched = jobs.filter((job) => ["aligned", "scheduled", "completed"].includes(job.status)).length;
  return (
    <>
      <ProfileProgress value={completeness} onPress={onEditProfile} />
      <WorkerProfileCard profile={profile} onEditProfile={onEditProfile} />
      <ActivityStrip
        items={[
          { icon: "heart-outline", value: jobs.length, label: "Diminati" },
          { icon: "handshake-outline", value: matched, label: "Cocok" },
          { icon: "star-outline", value: reviews.length, label: "Ulasan" },
        ]}
      />
      <JourneySection
        title="Yang Pernah Kamu Kerjakan"
        subtitle="Cerita kerja kamu tersimpan rapi di sini."
        emptyTitle="Belum ada riwayat."
        emptyCopy="Yuk mulai dari satu pekerjaan pertama."
      >
        {jobs.map((job) => (
          <HistoryItem
            key={`${job.id}-${job.match_id ?? "swipe"}`}
            icon="briefcase-outline"
            title={job.title}
            subtitle={job.business}
            status={job.status}
          />
        ))}
      </JourneySection>
      {reviews.length ? (
        <ReviewsSection title="Cerita dari Pemberi Kerja" reviews={reviews} />
      ) : null}
    </>
  );
}

function EmployerView({ jobs, reviews, ratings }: { jobs: any[]; reviews: any[]; ratings: any }) {
  const applicantCount = jobs.reduce((total, job) => total + Number(job.applicant_count || 0), 0);
  const matchCount = jobs.reduce((total, job) => total + Number(job.match_count || 0), 0);
  const latestBusiness = jobs[0]?.business;
  const employerRating = ratings?.employer;
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <>
      <View style={styles.profileCard}>
        <View style={styles.profileCardHead}>
          <View style={styles.profileCardIcon}>
            <Icon name="storefront-outline" size={22} color={colors.brandPrimary} />
          </View>
          <View style={styles.profileCardCopy}>
            <Text style={styles.profileCardTitle}>Data Pemberi Kerja</Text>
            <Text style={styles.profileCardSubtitle}>
              Tempat kamu melihat lowongan dan orang-orang yang tertarik.
            </Text>
          </View>
        </View>
        <View style={styles.employerSummary}>
          <DetailRow
            icon="store-outline"
            label="Usaha / keluarga"
            value={latestBusiness || "Belum ada lowongan"}
          />
          <DetailRow
            icon="star-outline"
            label="Rating"
            value={employerRating?.count ? `${employerRating.average.toFixed(1)} dari ${employerRating.count} ulasan` : "Belum ada ulasan"}
          />
        </View>
      </View>

      <ActivityStrip
        items={[
          { icon: "briefcase-outline", value: jobs.length, label: "Lowongan" },
          { icon: "account-heart-outline", value: applicantCount, label: "Pelamar" },
          { icon: "handshake-outline", value: matchCount, label: "Cocok" },
        ]}
      />

      <JourneySection
        title="Lowongan yang Kamu Pasang"
        subtitle="Pantau perjalanan lowonganmu dengan santai."
        emptyTitle="Belum ada lowongan."
        emptyCopy="Kalau sudah siap, pasang pekerjaan pertamamu."
      >
        {jobs.map((job) => (
          <View key={job.id} style={styles.historyCard}>
            <View style={styles.historyMain}>
              <View style={styles.historyIcon}>
                <Icon name="briefcase-outline" size={19} color={colors.brandPrimary} />
              </View>
              <View style={styles.historyCopy}>
                <Text style={styles.itemTitle}>{job.title}</Text>
                <Text style={styles.itemSubtitle}>{job.business}</Text>
              </View>
              <StatusPill status={job.status} />
            </View>
            <View style={styles.metrics}>
              <Metric icon="account-check-outline" value={`${job.people_filled}/${job.people_needed}`} label="terisi" />
              <Metric icon="account-multiple-outline" value={String(job.applicant_count)} label="pelamar" />
              <Metric icon="handshake-outline" value={String(job.match_count)} label="cocok" />
            </View>
          </View>
        ))}
      </JourneySection>

      {reviews.length ? (
        <ReviewsSection title="Ulasan yang Kamu Berikan" reviews={reviews} />
      ) : null}
    </>
  );
}

function ProfileProgress({ value, onPress }: { value: number; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressTop}>
        <View>
          <Text style={styles.progressTitle}>Data diri kamu</Text>
          <Text style={styles.progressCopy}>
            {value === 100
              ? "Sip, data dirimu sudah lengkap."
              : "Lengkapi sedikit lagi biar match-nya lebih pas."}
          </Text>
        </View>
        <Text style={styles.progressValue}>{value}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${value}%` as `${number}%` }]} />
      </View>
      {value < 100 ? (
        <Pressable style={({ pressed }) => [styles.progressLink, pressed && styles.pressed]} onPress={onPress}>
          <Text style={styles.progressLinkText}>Lengkapi sekarang</Text>
          <Icon name="arrow-right" size={17} color={colors.brandPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function WorkerProfileCard({ profile, onEditProfile }: { profile: any; onEditProfile: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.profileCard}>
      <View style={styles.profileCardHead}>
        <View style={styles.profileCardIcon}>
          <Icon name="account-hard-hat-outline" size={22} color={colors.brandPrimary} />
        </View>
        <View style={styles.profileCardCopy}>
          <Text style={styles.profileCardTitle}>Data Kerja</Text>
          <Text style={styles.profileCardSubtitle}>
            Lengkapi data diri biar orang yang cocok lebih gampang menemukan kamu.
          </Text>
        </View>
      </View>

      <View style={styles.profileDetails}>
        <InfoTile
          icon={categoryIcon(profile?.category)}
          label="Kategori"
          value={profile?.category || "Belum diisi"}
        />
        <InfoTile icon="cash" label="Tarif" value={profile?.rate || "Belum diisi"} />
        <InfoTile
          icon="briefcase-outline"
          label="Pengalaman"
          value={profile?.experience_label || "Belum diisi"}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        onPress={onEditProfile}
        testID="edit-profile"
      >
        <Icon name="pencil-outline" size={18} color={colors.brandPrimary} />
        <Text style={styles.editButtonText}>{profile ? "Edit Data" : "Lengkapi Data"}</Text>
      </Pressable>
    </View>
  );
}

function ActivityStrip({
  items,
}: {
  items: { icon: string; value: number; label: string }[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.activitySection}>
      <Text style={styles.sectionTitle}>Aktivitas Kamu</Text>
      <View style={styles.activityCard}>
        {items.map((item, index) => (
          <View key={item.label} style={[styles.activityItem, index > 0 && styles.activityDivider]}>
            <Icon name={item.icon} size={20} color={colors.brandPrimary} />
            <Text style={styles.activityValue}>{item.value}</Text>
            <Text style={styles.activityLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function JourneySection({
  title,
  subtitle,
  emptyTitle,
  emptyCopy,
  children,
}: {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyCopy: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <View style={styles.journeySection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      {count ? (
        <View style={styles.historyList}>{children}</View>
      ) : (
        <View style={styles.emptyJourney}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyCopy}>{emptyCopy}</Text>
        </View>
      )}
    </View>
  );
}

function HistoryItem({
  icon,
  title,
  subtitle,
  status,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.historyCard}>
      <View style={styles.historyMain}>
        <View style={styles.historyIcon}>
          <Icon name={icon} size={19} color={colors.brandPrimary} />
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemSubtitle}>{subtitle}</Text>
        </View>
        <StatusPill status={status} />
      </View>
    </View>
  );
}

function ReviewsSection({ title, reviews }: { title: string; reviews: any[] }) {
  const styles = useStyles();
  return (
    <View style={styles.journeySection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.historyList}>
        {reviews.map((review) => <ReviewRow key={review.id} review={review} />)}
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.status}>
      <Icon
        name={status === "completed" ? "check-circle-outline" : "circle-medium"}
        size={14}
        color={colors.brandPrimary}
      />
      <Text style={styles.statusText}>{STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

function Metric({ icon, value, label }: { icon: string; value: string; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <Icon name={icon} size={16} color={colors.brandPrimary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ReviewRow({ review }: { review: any }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewAvatar}>
        <Icon name="account-outline" size={19} color={colors.brandPrimary} />
      </View>
      <View style={styles.reviewCopy}>
        <Text style={styles.itemTitle}>{review.counterparty}</Text>
        {review.comment ? <Text style={styles.itemSubtitle}>{review.comment}</Text> : null}
      </View>
      <View style={styles.reviewRating}>
        <Icon name="star" size={14} color={colors.warning} />
        <Text style={styles.reviewRatingText}>{review.rating.toFixed(1)}</Text>
      </View>
    </View>
  );
}

function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.infoTile}>
      <Icon name={icon} size={19} color={colors.brandPrimary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Icon name={icon} size={18} color={colors.brandPrimary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function profileCompleteness(profile: any, user: any) {
  const values = [
    user?.name,
    profile?.photo_url || user?.picture,
    profile?.category,
    profile?.experience_label,
    profile?.availability,
    profile?.rate,
    profile?.phone,
    profile?.bio,
  ];
  return Math.round((values.filter((value) => String(value ?? "").trim()).length / values.length) * 100);
}

function ratingBreakdownText(ratings: any) {
  return [
    ratings?.worker?.count ? `${ratings.worker.average.toFixed(1)} pekerja` : "",
    ratings?.employer?.count ? `${ratings.employer.average.toFixed(1)} pemberi kerja` : "",
  ].filter(Boolean).join(" · ");
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  stickyHero: {
    position: "relative",
    zIndex: 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.075,
    shadowRadius: 14,
    elevation: 4,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  backdropGradient: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  colorBlob: {
    position: "absolute",
    borderRadius: radius.pill,
  },
  blobRed: {
    width: 260,
    height: 260,
    top: -105,
    right: -115,
    backgroundColor: colors.brandPrimary,
    opacity: 0.11,
  },
  blobOrange: {
    width: 210,
    height: 210,
    top: 190,
    left: -125,
    backgroundColor: colors.brandDeep,
    opacity: 0.08,
  },
  blobLavender: {
    width: 210,
    height: 210,
    top: 125,
    right: -145,
    backgroundColor: colors.onSurface,
    opacity: 0.045,
  },
  blobBlue: {
    width: 190,
    height: 190,
    bottom: -90,
    left: -90,
    backgroundColor: colors.brandPrimary,
    opacity: 0.05,
  },
  backdropIcon: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.64,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 1,
  },
  contentScroll: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  brandRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.brandDeep,
    marginTop: spacing.xs,
    overflow: "hidden",
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 2,
  },
  heroDecoration: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    opacity: 0.9,
  },
  heroDecorationLeft: {
    top: 30,
    left: -8,
    transform: [{ rotate: "-9deg" }],
  },
  heroDecorationRight: {
    top: 73,
    right: -7,
    transform: [{ rotate: "8deg" }],
  },
  heroDecorationBottom: {
    bottom: 22,
    left: 18,
    width: 40,
    height: 40,
    transform: [{ rotate: "5deg" }],
  },
  scrollAffordance: {
    position: "absolute",
    left: "50%",
    bottom: -13,
    width: 38,
    height: 28,
    marginLeft: -19,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 3,
  },
  scrollAffordanceBar: {
    width: 13,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    marginBottom: -3,
  },
  avatarShell: {
    width: 114,
    height: 114,
    borderRadius: 57,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.surfaceSecondary,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 3,
  },
  greeting: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.onBrandPrimary,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.45,
    color: colors.onBrandPrimary,
    marginTop: 2,
    textAlign: "center",
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onBrandPrimary,
    opacity: 0.72,
    marginTop: 1,
  },
  verifyButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    marginTop: spacing.md,
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  verifyText: { fontFamily: fonts.semibold, fontSize: 12 },
  ratingLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.onBrandPrimary,
  },
  ratingCopy: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.onBrandPrimary,
    opacity: 0.72,
  },
  roleSection: {
    paddingHorizontal: 0,
    marginBottom: spacing.md,
  },
  roleLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: radius.medium,
    backgroundColor: colors.brandSurfaceSubtle,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    borderColor: colors.brandPrimary,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 2,
  },
  tabText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  tabTextActive: {
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  roleHelper: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  loading: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  progressCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSurfaceSubtle,
    marginBottom: spacing.md,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  progressTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.onSurface,
  },
  progressCopy: {
    maxWidth: 245,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 2,
  },
  progressValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.brandPrimary,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  progressLink: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: spacing.sm,
  },
  progressLinkText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.brandPrimary,
  },
  profileCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.xl,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 2,
  },
  profileCardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  profileCardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSurfaceSubtle,
  },
  profileCardCopy: { flex: 1 },
  profileCardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
    color: colors.onSurface,
  },
  profileCardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 2,
  },
  profileDetails: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  infoTile: {
    flex: 1,
    minHeight: 94,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  infoLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.muted,
    marginTop: 6,
  },
  infoValue: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    color: colors.onSurface,
    marginTop: 2,
  },
  editButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.brandSurfaceSubtle,
    marginTop: spacing.md,
  },
  editButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.brandPrimary,
  },
  employerSummary: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.muted,
  },
  detailValue: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurface,
    marginTop: 1,
  },
  activitySection: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.25,
    color: colors.onSurface,
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 2,
  },
  activityCard: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    marginTop: spacing.sm,
  },
  activityItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  activityDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.divider,
  },
  activityValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.onSurface,
    marginTop: 2,
  },
  activityLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.muted,
  },
  journeySection: { marginBottom: spacing.xl },
  historyList: { gap: spacing.sm, marginTop: spacing.md },
  historyCard: {
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
  },
  historyMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSurfaceSubtle,
  },
  historyCopy: { flex: 1 },
  itemTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurface,
  },
  itemSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 1,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSurfaceSubtle,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.brandPrimary,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  metric: { flexDirection: "row", alignItems: "center", gap: 3 },
  metricValue: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.onSurface,
  },
  metricLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.muted,
  },
  emptyJourney: {
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.onSurface,
  },
  emptyCopy: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 2,
  },
  reviewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
  },
  reviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSurfaceSubtle,
  },
  reviewCopy: { flex: 1 },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reviewRatingText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.onSurface,
  },
  accountActions: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingTop: spacing.sm,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
}));
