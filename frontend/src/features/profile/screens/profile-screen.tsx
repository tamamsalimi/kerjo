import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/auth-context";
import { fetchProfileHistory } from "@/src/features/profile/services/profile-service";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { BrandLockup, CategoryAvatar, Icon, PrimaryButton } from "@/src/components/ui";
import { categoryIcon, employerTypeLabel } from "@/src/constants";
import { useAppLayout } from "@/src/layout/phone-frame";
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
  { icon: "wrench", top: 304, right: 17, size: 40, tone: 1, rotate: "9deg" },
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
  const { width } = useAppLayout();
  const fit = Math.min(1, Math.max(0.86, width / 430));
  const sideInset = Math.round(Math.max(22, Math.min(32, width * 0.07)));
  const boxSize = Math.round(Math.min(width - sideInset * 2, 276));
  const pad = Math.round(14 * fit);
  const stackGap = Math.round(8 * fit);
  const avatarSize = Math.round(76 * fit);
  const shellSize = Math.round(84 * fit);
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;
  const [tab, setTab] = useState<ProfileTab>("employer");

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

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="profile-screen">
      <View style={[styles.stickyHero, { paddingHorizontal: sideInset }]}>
        <ProfileBackdrop />
        <View style={styles.brandRow}>
          <BrandLockup compact />
        </View>

        <LinearGradient
          colors={[colors.brandPrimary, colors.brandDeep, colors.onSurface]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.hero,
            {
              width: boxSize,
              height: boxSize,
              paddingTop: pad,
              paddingBottom: pad,
              paddingHorizontal: pad,
            },
          ]}
        >
          <View style={[styles.heroDecoration, styles.heroDecorationLeft, { width: Math.round(36 * fit), height: Math.round(36 * fit) }]}>
            <Icon name="camera" size={Math.round(16 * fit)} color={colors.onBrandPrimary} />
          </View>
          <View style={[styles.heroDecoration, styles.heroDecorationRight, { width: Math.round(36 * fit), height: Math.round(36 * fit) }]}>
            <Icon name="store" size={Math.round(16 * fit)} color={colors.onBrandPrimary} />
          </View>
          <View style={[styles.heroDecoration, styles.heroDecorationBottom, { width: Math.round(30 * fit), height: Math.round(30 * fit) }]}>
            <Icon name="school" size={Math.round(14 * fit)} color={colors.onBrandPrimary} />
          </View>
          <View style={[styles.avatarShell, { width: shellSize, height: shellSize, borderRadius: shellSize / 2 }]}>
            <CategoryAvatar
              category={profile?.category}
              photo={profile?.photo_url || user?.picture}
              size={avatarSize}
              variant="inverse"
            />
          </View>
          <View style={[styles.greetingRow, { marginTop: stackGap }]}>
            <Text style={[styles.greeting, { fontSize: Math.round(11 * fit) }]}>Senang ketemu kamu</Text>
            <Icon name="hand-wave" size={Math.round(13 * fit)} color={colors.onBrandPrimary} />
          </View>
          <Text style={[styles.name, { fontSize: Math.round(19 * fit), lineHeight: Math.round(24 * fit), marginTop: 2 }]} numberOfLines={2}>
            {profile?.name || user?.name || "Teman Kerjo"}
          </Text>
          <Text style={[styles.email, { fontSize: Math.round(11 * fit), lineHeight: Math.round(15 * fit) }]} numberOfLines={1}>
            {user?.email}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.verifyButton,
              { backgroundColor: verification.background, marginTop: stackGap },
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
            <View style={[styles.ratingLine, { marginTop: stackGap }]}>
              <View style={styles.ratingBadge}>
                <Icon name="star" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.ratingValue}>{ratings.combined.average.toFixed(1)}</Text>
              </View>
              <Text style={styles.ratingCopy} numberOfLines={2}>
                {ratings.combined.count} ulasan · {ratingBreakdownText(ratings)}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.contentScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomChrome + spacing["2xl"] },
        ]}
      >
        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>Kamu di Kerjo sebagai</Text>
          <View style={styles.tabs} testID="profile-role-tabs">
            <ProfileTabButton
              icon="account-hard-hat"
              label="Pencari Kerja"
              active={tab === "worker"}
              onPress={() => setTab("worker")}
              testID="profile-tab-worker"
            />
            <ProfileTabButton
              icon="storefront"
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
          <EmployerView
            profile={profile}
            jobs={employerJobs}
            reviews={ratingsGiven}
            ratings={ratings}
            onEditJob={(jobID) => router.push(`/post-job?jobId=${encodeURIComponent(jobID)}`)}
            onOpenApplicants={(jobID) => router.push(jobID ? `/applicants?jobId=${encodeURIComponent(jobID)}` : "/applicants")}
            onOpenWorker={(workerID) => router.push(`/worker/${encodeURIComponent(workerID)}`)}
          />
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
        icon: "clock",
        iconColor: colors.brandDeep,
        textColor: colors.onSurface,
        chevronColor: colors.muted,
        background: colors.surface,
        showChevron: true,
      };
    case "rejected":
      return {
        label: "Verifikasi perlu diperbaiki",
        icon: "alert-circle",
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
  const styles = useStyles();
  const { colors } = useTheme();
  const [detail, setDetail] = useState<any | null>(null);
  const matched = jobs.filter((job) => ["aligned", "scheduled", "completed"].includes(job.status)).length;
  const profileSummary = [profile?.category, profile?.rate].filter(Boolean).join(" · ") || "Lengkapi data diri kamu";
  return (
    <>
      <ProfileProgress value={completeness} onPress={onEditProfile} />
      <SummaryRow
        icon="account-hard-hat"
        title="Data Kerja"
        subtitle={profileSummary}
        onPress={() => setDetail({ type: "profile" })}
        testID="worker-profile-summary"
      />
      <ActivityStrip
        items={[
          { icon: "heart", value: jobs.length, label: "Diminati" },
          { icon: "handshake", value: matched, label: "Cocok" },
          { icon: "star", value: reviews.length, label: "Ulasan" },
        ]}
      />
      <JourneySection
        title="Yang Pernah Kamu Kerjakan"
        subtitle="Orang dan tempat kerja yang pernah kamu minati."
        emptyTitle="Belum ada riwayat."
        emptyCopy="Yuk mulai dari satu pekerjaan pertama."
      >
        {jobs.map((job) => (
          <PersonCard
            key={`${job.id}-${job.match_id ?? "swipe"}`}
            name={job.employer_name || job.business}
            photo={job.employer_photo}
            subtitle={[job.title, job.business].filter(Boolean).join(" · ")}
            status={job.status}
            onPress={() => setDetail({ type: "person", side: "employer", job })}
            testID={`worker-history-${job.id}`}
          />
        ))}
      </JourneySection>
      {reviews.length ? (
        <JourneySection title="Cerita dari Pemberi Kerja" subtitle="" emptyTitle="" emptyCopy="">
          {reviews.map((review) => (
            <SummaryRow
              key={review.id}
              icon="account"
              title={review.counterparty}
              subtitle={review.comment || "Tidak ada komentar"}
              meta={`${Number(review.rating).toFixed(1)} ★`}
              onPress={() => setDetail({ type: "review", review })}
              testID={`review-history-${review.id}`}
            />
          ))}
        </JourneySection>
      ) : null}
      <BottomSheet
        visible={!!detail}
        title={
          detail?.type === "profile"
            ? "Data Kerja"
            : detail?.type === "person"
              ? detail.job.employer_name || detail.job.business
              : detail?.review?.counterparty
        }
        onClose={() => setDetail(null)}
        testID="worker-detail-sheet"
      >
        {detail?.type === "profile" ? (
          <View style={styles.detailStack}>
            <DetailRow icon={categoryIcon(profile?.category)} label="Kategori" value={profile?.category || "Belum diisi"} />
            <DetailRow icon="cash" label="Tarif" value={profile?.rate || "Belum diisi"} />
            <DetailRow icon="briefcase" label="Pengalaman" value={profile?.experience_label || "Belum diisi"} />
            {profile?.last_education ? (
              <DetailRow icon="school" label="Pendidikan" value={profile.last_education} />
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
              onPress={() => {
                setDetail(null);
                onEditProfile();
              }}
              testID="edit-profile"
            >
              <Icon name="pencil" size={18} color={colors.brandPrimary} />
              <Text style={styles.editButtonText}>{profile ? "Edit Data" : "Lengkapi Data"}</Text>
            </Pressable>
          </View>
        ) : null}
        {detail?.type === "person" ? (
          <PersonDetail
            name={detail.job.employer_name || detail.job.business}
            photo={detail.job.employer_photo}
            facts={[
              { icon: employerTypeIcon(detail.job.employer_type), label: "Tipe", value: employerTypeLabel(detail.job.employer_type) },
              { icon: "store", label: "Usaha", value: detail.job.business },
              { icon: "briefcase", label: "Lowongan", value: detail.job.title },
              { icon: "circle-medium", label: "Status", value: STATUS_LABELS[detail.job.status] ?? detail.job.status },
            ]}
            questions={detail.job.screening_questions}
            answers={detail.job.screening_answers}
          />
        ) : null}
        {detail?.type === "review" ? (
          <View style={styles.detailStack}>
            <DetailRow icon="star" label="Rating" value={Number(detail.review.rating).toFixed(1)} />
            <Text style={styles.reviewDetailComment}>
              {detail.review.comment || "Tidak ada komentar"}
            </Text>
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

function EmployerView({
  profile,
  jobs,
  reviews,
  ratings,
  onEditJob,
  onOpenApplicants,
  onOpenWorker,
}: {
  profile: any;
  jobs: any[];
  reviews: any[];
  ratings: any;
  onEditJob: (jobID: string) => void;
  onOpenApplicants: (jobID?: string) => void;
  onOpenWorker: (workerID: string) => void;
}) {
  const applicantCount = jobs.reduce((total, job) => total + Number(job.applicant_count || 0), 0);
  const matchCount = jobs.reduce((total, job) => total + Number(job.match_count || 0), 0);
  const latestBusiness = jobs[0]?.business;
  const employerType = jobs[0]?.employer_type ?? profile?.employer_type;
  const employerRating = ratings?.employer;
  const styles = useStyles();
  const { colors } = useTheme();
  const [detail, setDetail] = useState<any | null>(null);
  const ratingLabel = employerRating?.count
    ? `${employerRating.average.toFixed(1)} dari ${employerRating.count} ulasan`
    : "Belum ada ulasan";
  const profileSummary = [employerTypeLabel(employerType), latestBusiness].filter(Boolean).join(" · ")
    || "Belum ada data";
  const applicants = jobs.flatMap((job) =>
    (job.applicant_responses ?? []).map((person: any, index: number) => ({
      ...person,
      job,
      key: `${person.worker_id ?? person.worker_name}-${job.id}-${index}`,
    })),
  );

  return (
    <>
      <SummaryRow
        icon="storefront"
        title="Data Pemberi Kerja"
        subtitle={profileSummary}
        onPress={() => setDetail({ type: "profile" })}
        testID="employer-profile-summary"
      />
      <ActivityStrip
        items={[
          { icon: "briefcase", value: jobs.length, label: "Lowongan" },
          { icon: "account-heart", value: applicantCount, label: "Pelamar", onPress: () => onOpenApplicants() },
          { icon: "handshake", value: matchCount, label: "Cocok" },
        ]}
      />
      <JourneySection
        title="Lowongan yang Kamu Pasang"
        subtitle="Pantau lowonganmu tanpa scroll panjang."
        emptyTitle="Belum ada lowongan."
        emptyCopy="Kalau sudah siap, pasang pekerjaan pertamamu."
      >
        {jobs.map((job) => (
          <SummaryRow
            key={job.id}
            icon="briefcase"
            title={job.title}
            subtitle={job.business}
            status={job.status}
            meta={`${job.people_filled}/${job.people_needed} terisi · ${job.applicant_count} pelamar`}
            onPress={() => setDetail({ type: "job", job })}
            testID={`employer-history-${job.id}`}
          />
        ))}
      </JourneySection>
      <JourneySection
        title="Pelamar"
        subtitle="Setiap orang tampil singkat. Ketuk untuk lihat detail."
        emptyTitle="Belum ada pelamar."
        emptyCopy="Kalau sudah ada yang tertarik, namanya muncul di sini."
      >
        {applicants.map((person) => (
          <PersonCard
            key={person.key}
            name={person.worker_name || "Pelamar"}
            photo={person.photo_url}
            category={person.category}
            subtitle={[person.category, person.job?.title].filter(Boolean).join(" · ")}
            onPress={() => setDetail({ type: "person", side: "worker", person, job: person.job })}
            testID={`employer-applicant-${person.key}`}
          />
        ))}
      </JourneySection>
      {reviews.length ? (
        <JourneySection title="Ulasan yang Kamu Berikan" subtitle="" emptyTitle="" emptyCopy="">
          {reviews.map((review) => (
            <SummaryRow
              key={review.id}
              icon="account"
              title={review.counterparty}
              subtitle={review.comment || "Tidak ada komentar"}
              meta={`${Number(review.rating).toFixed(1)} ★`}
              onPress={() => setDetail({ type: "review", review })}
              testID={`review-history-${review.id}`}
            />
          ))}
        </JourneySection>
      ) : null}
      <BottomSheet
        visible={!!detail}
        title={
          detail?.type === "profile"
            ? "Data Pemberi Kerja"
            : detail?.type === "job"
              ? detail.job.title
              : detail?.type === "person"
                ? detail.person?.worker_name || "Pelamar"
                : detail?.review?.counterparty
        }
        onClose={() => setDetail(null)}
        testID="employer-detail-sheet"
      >
        {detail?.type === "profile" ? (
          <View style={styles.detailStack}>
            <DetailRow
              icon={employerType === "usaha_perusahaan" ? "office-building" : "account"}
              label="Tipe pemberi kerja"
              value={employerTypeLabel(employerType)}
            />
            <DetailRow icon="store" label="Usaha / keluarga" value={latestBusiness || "Belum ada lowongan"} />
            <DetailRow icon="star" label="Rating" value={ratingLabel} />
          </View>
        ) : null}
        {detail?.type === "job" ? (
          <View style={styles.detailStack}>
            <DetailRow icon="store" label="Usaha" value={detail.job.business} />
            <DetailRow icon="circle-medium" label="Status" value={STATUS_LABELS[detail.job.status] ?? detail.job.status} />
            <View style={styles.metrics}>
              <Metric icon="account-check" value={`${detail.job.people_filled}/${detail.job.people_needed}`} label="terisi" />
              <Pressable
                onPress={() => {
                  const jobID = detail.job.id;
                  setDetail(null);
                  onOpenApplicants(jobID);
                }}
                testID={`history-applicants-${detail.job.id}`}
              >
                <Metric icon="account-multiple" value={String(detail.job.applicant_count)} label="pelamar" />
              </Pressable>
              <Metric icon="handshake" value={String(detail.job.match_count)} label="cocok" />
            </View>
            {(detail.job.applicant_responses ?? []).length ? (
              <View style={styles.personList}>
                {detail.job.applicant_responses.map((person: any, index: number) => (
                  <PersonCard
                    key={`${person.worker_id ?? person.worker_name}-${index}`}
                    name={person.worker_name || "Pelamar"}
                    photo={person.photo_url}
                    category={person.category}
                    subtitle={[person.category, person.experience_label].filter(Boolean).join(" · ")}
                    onPress={() => setDetail({ type: "person", side: "worker", person, job: detail.job })}
                    testID={`job-applicant-${person.worker_id ?? index}`}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.itemSubtitle}>Belum ada pelamar.</Text>
            )}
            <Pressable
              style={styles.editJobButton}
              onPress={() => {
                const jobID = detail.job.id;
                setDetail(null);
                onEditJob(jobID);
              }}
            >
              <Icon name="pencil" size={16} color={colors.brandPrimary} />
              <Text style={styles.editJobText}>Edit lowongan</Text>
            </Pressable>
          </View>
        ) : null}
        {detail?.type === "person" ? (
          <PersonDetail
            name={detail.person.worker_name || "Pelamar"}
            photo={detail.person.photo_url}
            category={detail.person.category}
            facts={[
              { icon: categoryIcon(detail.person.category), label: "Kategori", value: detail.person.category || "Belum diisi" },
              { icon: "briefcase", label: "Pengalaman", value: detail.person.experience_label || "Belum diisi" },
              { icon: "school", label: "Pendidikan", value: detail.person.last_education || "Belum diisi" },
              { icon: "cash", label: "Tarif", value: detail.person.rate || "Belum diisi" },
              { icon: "store", label: "Melamar", value: detail.job?.title || "-" },
            ]}
            bio={detail.person.bio}
            questions={detail.person.screening_questions}
            answers={detail.person.screening_answers}
            action={detail.person.worker_id ? {
              label: "Lihat profil",
              onPress: () => {
                const workerID = detail.person.worker_id;
                setDetail(null);
                onOpenWorker(workerID);
              },
            } : undefined}
          />
        ) : null}
        {detail?.type === "review" ? (
          <View style={styles.detailStack}>
            <DetailRow icon="star" label="Rating" value={Number(detail.review.rating).toFixed(1)} />
            <Text style={styles.reviewDetailComment}>
              {detail.review.comment || "Tidak ada komentar"}
            </Text>
          </View>
        ) : null}
      </BottomSheet>
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

function ProfileSummaryCard({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.profileCard, styles.profileSummaryCard, pressed && styles.pressed]}
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.profileSummaryHead}>
        <View style={styles.profileCardIcon}>
          <Icon name={icon} size={22} color={colors.brandPrimary} />
        </View>
        <View style={styles.profileCardCopy}>
          <Text style={styles.profileCardTitle}>{title}</Text>
          <Text style={styles.profileCardSubtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Icon name="chevron-right" size={22} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function WorkerProfileCard({ profile, onEditProfile }: { profile: any; onEditProfile: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const summary = [profile?.category, profile?.rate].filter(Boolean).join(" · ")
    || "Lengkapi data diri kamu";
  return (
    <>
      <ProfileSummaryCard
        icon="account-hard-hat"
        title="Data Kerja"
        subtitle={summary}
        onPress={() => setOpen(true)}
        testID="worker-profile-summary"
      />
      <HistoryDetailSheet
        visible={open}
        title="Data Kerja"
        onClose={() => setOpen(false)}
        testID="worker-profile-detail"
      >
        <View style={styles.employerSummary}>
          <DetailRow
            icon={categoryIcon(profile?.category)}
            label="Kategori"
            value={profile?.category || "Belum diisi"}
          />
          <DetailRow icon="cash" label="Tarif" value={profile?.rate || "Belum diisi"} />
          <DetailRow
            icon="briefcase"
            label="Pengalaman"
            value={profile?.experience_label || "Belum diisi"}
          />
          {profile?.last_education ? (
            <DetailRow icon="school" label="Pendidikan" value={profile.last_education} />
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          onPress={() => {
            setOpen(false);
            onEditProfile();
          }}
          testID="edit-profile"
        >
          <Icon name="pencil" size={18} color={colors.brandPrimary} />
          <Text style={styles.editButtonText}>{profile ? "Edit Data" : "Lengkapi Data"}</Text>
        </Pressable>
      </HistoryDetailSheet>
    </>
  );
}

function ActivityStrip({
  items,
}: {
  items: { icon: string; value: number; label: string; onPress?: () => void }[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.activitySection}>
      <Text style={styles.sectionTitle}>Aktivitas Kamu</Text>
      <View style={styles.activityCard}>
        {items.map((item, index) => {
          const body = (
            <>
              <Icon name={item.icon} size={20} color={colors.brandPrimary} />
              <Text style={styles.activityValue}>{item.value}</Text>
              <Text style={styles.activityLabel}>{item.label}</Text>
            </>
          );
          return item.onPress ? (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={[styles.activityItem, index > 0 && styles.activityDivider]}
              testID={`activity-${item.label.toLowerCase()}`}
            >
              {body}
            </Pressable>
          ) : (
            <View key={item.label} style={[styles.activityItem, index > 0 && styles.activityDivider]}>
              {body}
            </View>
          );
        })}
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
  children: ReactNode;
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

function SummaryRow({
  icon,
  title,
  subtitle,
  status,
  meta,
  onPress,
  testID,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status?: string;
  meta?: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.historyMain}>
        <View style={styles.historyIcon}>
          <Icon name={icon} size={19} color={colors.brandPrimary} />
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>{subtitle}</Text>
          {meta ? <Text style={styles.itemMeta} numberOfLines={1}>{meta}</Text> : null}
        </View>
        {status ? <StatusPill status={status} /> : null}
        <Icon name="chevron-right" size={20} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function employerTypeIcon(value?: string) {
  return value === "usaha_perusahaan" ? "office-building" : "account";
}

function PersonCard({
  name,
  photo,
  category,
  subtitle,
  status,
  onPress,
  testID,
}: {
  name: string;
  photo?: string;
  category?: string;
  subtitle?: string;
  status?: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.personCard, pressed && styles.pressed]}
      onPress={onPress}
      testID={testID}
    >
      <CategoryAvatar category={category} photo={photo} size={44} />
      <View style={styles.historyCopy}>
        <Text style={styles.itemTitle} numberOfLines={1}>{name}</Text>
        {subtitle ? <Text style={styles.itemSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {status ? <StatusPill status={status} /> : null}
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}

function PersonDetail({
  name,
  photo,
  category,
  facts,
  bio,
  questions,
  answers,
  action,
}: {
  name: string;
  photo?: string;
  category?: string;
  facts: { icon: string; label: string; value: string }[];
  bio?: string;
  questions?: string[];
  answers?: string[];
  action?: { label: string; onPress: () => void };
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.detailStack}>
      <View style={styles.personRow}>
        <CategoryAvatar category={category} photo={photo} size={52} />
        <View style={styles.historyCopy}>
          <Text style={styles.itemTitle}>{name}</Text>
          {category ? <Text style={styles.itemSubtitle}>{category}</Text> : null}
        </View>
      </View>
      {facts.map((fact) => (
        <DetailRow key={fact.label} icon={fact.icon} label={fact.label} value={fact.value} />
      ))}
      {bio ? <Text style={styles.reviewDetailComment}>{bio}</Text> : null}
      <ScreeningHistory questions={questions} answers={answers} />
      {action ? (
        <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.pressed]} onPress={action.onPress}>
          <Icon name="account" size={18} color={colors.brandPrimary} />
          <Text style={styles.editButtonText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HistoryDetailSheet({
  visible,
  title,
  onClose,
  testID,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  testID: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} testID={testID}>
      <ScrollView
        style={styles.historyDetailScroll}
        contentContainerStyle={styles.historyDetailContent}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </BottomSheet>
  );
}

function PersonRow({
  name,
  photo,
  category,
  subtitle,
  onPress,
}: {
  name: string;
  photo?: string;
  category?: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const body = (
    <View style={styles.personRow}>
      <CategoryAvatar category={category} photo={photo} size={44} />
      <View style={styles.historyCopy}>
        <Text style={styles.itemTitle} numberOfLines={1}>{name}</Text>
        {subtitle ? <Text style={styles.itemSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron-right" size={20} color={colors.muted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable style={({ pressed }) => [pressed && styles.pressed]} onPress={onPress}>
      {body}
    </Pressable>
  );
}

function ScreeningHistory({
  questions,
  answers,
  responses,
}: {
  questions?: string[];
  answers?: string[];
  responses?: { worker_name?: string; screening_questions?: string[]; screening_answers?: string[] }[];
}) {
  const styles = useStyles();
  if (Array.isArray(responses) && responses.length) {
    return (
      <View style={styles.screeningHistory} testID="screening-history">
        {responses.map((response, index) => (
          <View key={`${response.worker_name ?? "pelamar"}-${index}`} style={styles.screeningBlock}>
            {response.worker_name ? (
              <Text style={styles.screeningName}>{response.worker_name}</Text>
            ) : null}
            <ScreeningPairs questions={response.screening_questions} answers={response.screening_answers} />
          </View>
        ))}
      </View>
    );
  }
  if (!Array.isArray(questions) || questions.length === 0) return null;
  return (
    <View style={styles.screeningHistory} testID="screening-history">
      <ScreeningPairs questions={questions} answers={answers} />
    </View>
  );
}

function ScreeningPairs({ questions, answers }: { questions?: string[]; answers?: string[] }) {
  const styles = useStyles();
  const items = (questions ?? []).length ? questions ?? [] : (answers ?? []).map((_, index) => `Pertanyaan ${index + 1}`);
  return (
    <>
      {items.map((question, index) => (
        <View key={`${question}-${index}`} style={styles.screeningPair}>
          <Text style={styles.screeningQuestion}>{question}</Text>
          <Text style={styles.screeningAnswer}>
            {answers?.[index]?.trim() ? answers[index] : "— tidak dijawab —"}
          </Text>
        </View>
      ))}
    </>
  );
}

function ReviewsSection({ title, reviews }: { title: string; reviews: any[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  return (
    <View style={styles.journeySection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.historyList}>
        {reviews.map((review) => (
          <ReviewRow key={review.id} review={review} onPress={() => setSelectedReview(review)} />
        ))}
      </View>
      <HistoryDetailSheet
        visible={!!selectedReview}
        title={selectedReview?.counterparty}
        onClose={() => setSelectedReview(null)}
        testID="review-history-detail"
      >
        {selectedReview ? (
          <View style={styles.historyCard}>
            <View style={styles.historyMain}>
              <View style={styles.reviewAvatar}>
                <Icon name="account" size={19} color={colors.brandPrimary} />
              </View>
              <View style={styles.historyCopy}>
                <Text style={styles.itemTitle}>{selectedReview.counterparty}</Text>
                <View style={styles.reviewRating}>
                  <Icon name="star" size={14} color={colors.warning} />
                  <Text style={styles.reviewRatingText}>{Number(selectedReview.rating).toFixed(1)}</Text>
                </View>
              </View>
            </View>
            {selectedReview.comment ? (
              <Text style={styles.reviewDetailComment}>{selectedReview.comment}</Text>
            ) : (
              <Text style={styles.itemSubtitle}>Tidak ada komentar</Text>
            )}
          </View>
        ) : null}
      </HistoryDetailSheet>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.status}>
      <Icon
        name={status === "completed" ? "check-circle" : "circle-medium"}
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

function ReviewRow({ review, onPress }: { review: any; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.reviewCard, pressed && styles.pressed]}
      onPress={onPress}
      testID={`review-history-${review.id}`}
    >
      <View style={styles.reviewAvatar}>
        <Icon name="account" size={19} color={colors.brandPrimary} />
      </View>
      <View style={styles.reviewCopy}>
        <Text style={styles.itemTitle} numberOfLines={1}>{review.counterparty}</Text>
        {review.comment ? (
          <Text style={styles.itemSubtitle} numberOfLines={1}>{review.comment}</Text>
        ) : null}
      </View>
      <View style={styles.reviewRating}>
        <Icon name="star" size={14} color={colors.warning} />
        <Text style={styles.reviewRatingText}>{review.rating.toFixed(1)}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
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
    profile?.name || user?.name,
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
    width: "100%",
    maxWidth: "100%",
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  stickyHero: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    paddingHorizontal: 24,
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
    width: "100%",
    maxWidth: "100%",
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
    alignSelf: "center",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
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
    top: 22,
    left: -8,
    transform: [{ rotate: "-9deg" }],
  },
  heroDecorationRight: {
    top: 22,
    right: -8,
    transform: [{ rotate: "8deg" }],
  },
  heroDecorationBottom: {
    bottom: 22,
    left: 18,
    width: 40,
    height: 40,
    transform: [{ rotate: "5deg" }],
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
    marginTop: 10,
  },
  name: {
    width: "100%",
    maxWidth: "100%",
    fontFamily: fonts.bold,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.45,
    color: colors.onBrandPrimary,
    marginTop: 2,
    textAlign: "center",
    paddingHorizontal: 0,
  },
  email: {
    width: "100%",
    maxWidth: "100%",
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onBrandPrimary,
    opacity: 0.72,
    marginTop: 1,
    textAlign: "center",
    paddingHorizontal: 0,
  },
  verifyButton: {
    maxWidth: "100%",
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    marginTop: 10,
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  verifyText: { fontFamily: fonts.semibold, fontSize: 12 },
  ratingLine: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: 8,
    paddingHorizontal: 0,
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
  profileSummaryCard: {
    marginBottom: spacing.md,
  },
  profileSummaryHead: {
    flexDirection: "row",
    alignItems: "center",
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
  personCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
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
  itemMeta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 16,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  historyDetailScroll: { maxHeight: 520 },
  historyDetailContent: { paddingBottom: spacing.md, gap: spacing.xs },
  detailStack: { gap: spacing.md },
  personList: { gap: spacing.sm, marginTop: spacing.xs },
  personListTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.onSurface,
  },
  personBlock: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  personFacts: { gap: 2, paddingLeft: 56 },
  reviewDetailComment: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  screeningHistory: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  screeningBlock: {
    gap: 4,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  screeningName: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  screeningPair: { gap: 2 },
  screeningQuestion: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceSecondary,
  },
  screeningAnswer: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurface,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
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
  editJobButton: {
    minHeight: 42,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  editJobText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.brandPrimary,
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
    alignItems: "center",
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
