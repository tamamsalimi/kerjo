import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { useAuth } from "@/src/features/auth/auth-context";
import { CategoryAvatar, Chip, Icon, PrimaryButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import {
  fetchMessages,
  markMatchRead,
  respondSchedule,
  scheduleMeeting,
  sendMessage,
} from "@/src/features/chat/services/chat-service";
import {
  completeJob,
  fetchMatch,
  submitReview,
} from "@/src/features/matching/services/matching-service";
import { conversationRole, employerTypeLabel, formatPay } from "@/src/constants";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SCHEDULE_KINDS = ["Wawancara", "Tes/Asesmen", "Hari Pertama"];
const TIME_SLOTS = ["09:00", "11:00", "13:00", "16:00", "19:00"];

function nextDays(count: number) {
  const days = [];
  const names = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({ date: d, label: `${names[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}` });
  }
  return days;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const names = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${names[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} • ${hh}:${mm}`;
}

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);
  const { user, refreshUser } = useAuth();
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;
  const myUserId = user?.user_id;
  const verified = user?.verification_status === "approved";

  const [text, setText] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedKind, setSchedKind] = useState(SCHEDULE_KINDS[0]);
  const [schedDay, setSchedDay] = useState(0);
  const [schedTime, setSchedTime] = useState(TIME_SLOTS[0]);
  const [schedNote, setSchedNote] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  const days = useMemo(() => nextDays(7), []);

  useEffect(() => {
    void refreshUserRef.current();
  }, []);

  const { data: match } = useQuery({
    queryKey: ["match", id],
    queryFn: () => fetchMatch(id!),
    refetchInterval: 15000,
    enabled: verified,
  });
  const chatRole = conversationRole(match?.entity_type);
  const { data: messages } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => fetchMessages(id!),
    refetchInterval: 4000,
    enabled: verified,
  });

  const sendMut = useMutation({
    mutationFn: (t: string) => sendMessage(id!, t),
    onSuccess: (msgs) => queryClient.setQueryData(["messages", id], msgs),
  });

  const schedMut = useMutation({
    mutationFn: () => {
      const d = new Date(days[schedDay].date);
      const [hh, mm] = schedTime.split(":");
      d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
      return scheduleMeeting(id!, schedKind, d.toISOString(), schedNote.trim());
    },
    onSuccess: (msgs) => {
      queryClient.setQueryData(["messages", id], msgs);
      setSchedOpen(false);
      setSchedNote("");
      toast("Usulan jadwal terkirim 📅", "success");
    },
    onError: () => toast("Gagal mengirim jadwal", "error"),
  });

  const respondMut = useMutation({
    mutationFn: ({ schedId, accept }: { schedId: string; accept: boolean }) =>
      respondSchedule(id!, schedId, accept),
    onSuccess: (msgs) => queryClient.setQueryData(["messages", id], msgs),
  });

  const reviewMut = useMutation({
    mutationFn: async () => {
      await completeJob(id!);
      return submitReview(id!, rating, comment.trim());
    },
    onSuccess: () => {
      toast("Terima kasih! Rating tersimpan ⭐", "success");
      setReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ["match", id] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: () => toast("Gagal menyimpan rating", "error"),
  });

  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      markMatchRead(id!)
        .then(() => queryClient.invalidateQueries({ queryKey: ["unread-count"] }))
        .catch(() => {});
    }
  }, [messages?.length, id, queryClient]);

  function callPartner() {
    if (!match?.allow_direct_call) {
      toast("Panggilan langsung tidak diizinkan", "info");
      return;
    }
    const phone = (match?.phone || "").replace(/[^\d+]/g, "");
    if (!phone) {
      toast("Nomor telepon belum tersedia", "info");
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => toast("Tidak bisa memulai panggilan", "error"));
  }

  function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    sendMut.mutate(t);
  }

  if (!verified) {
    return (
      <View style={[styles.container, styles.verificationGate, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.gateIcon}>
          <Icon name="shield-lock-outline" size={46} color={colors.brandPrimary} />
        </View>
        <Text style={styles.gateTitle}>Verifikasi untuk membuka chat</Text>
        <Text style={styles.gateText}>Kirim nomor HP, NIK, foto KTP, dan foto wajah untuk pemeriksaan.</Text>
        <PrimaryButton
          label="Verifikasi Identitas"
          icon="shield-account"
          onPress={() => router.replace("/verification")}
          testID="chat-verification-cta"
          style={{ marginTop: spacing.lg }}
        />
        <PrimaryButton
          label="Kembali"
          variant="outline"
          onPress={() => router.back()}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="chat-screen">
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/matches"))}
          hitSlop={10}
          testID="chat-back"
        >
          <Icon name="chevron-left" size={28} color={colors.onSurface} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.headerProfile, pressed && styles.pressed]}
          onPress={() => setDetailOpen(true)}
          testID="chat-profile-detail"
        >
          <CategoryAvatar category={match?.category} photo={match?.image} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hName} numberOfLines={1}>{match?.title ?? "Chat"}</Text>
            <View style={styles.headerRoleRow}>
              <Icon name={chatRole.icon} size={13} color={colors.brandPrimary} />
              <Text style={styles.headerRoleText}>{chatRole.label}</Text>
              <Text style={styles.hSub}>·</Text>
              {match?.online ? (
                <View style={styles.onlineRow}>
                  <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.hSub, { color: colors.success }]}>aktif</Text>
                </View>
              ) : (
                <Text style={styles.hSub} numberOfLines={1}>{match?.subtitle}</Text>
              )}
            </View>
          </View>
        </Pressable>
        {match?.allow_direct_call && match?.phone ? (
          <Pressable style={styles.headerIcon} onPress={callPartner} hitSlop={8} testID="call-button">
            <Icon name="phone" size={22} color={colors.brandPrimary} />
          </Pressable>
        ) : null}
        <Pressable style={styles.headerIcon} onPress={() => setSchedOpen(true)} hitSlop={8} testID="schedule-button">
          <Icon name="calendar-clock" size={22} color={colors.brandPrimary} />
        </Pressable>
        {match?.reviewed ? (
          <View style={[styles.doneTag, { backgroundColor: colors.success }]}>
            <Icon name="check" size={14} color={colors.onSuccess} />
            <Text style={styles.doneTagText}>Selesai</Text>
          </View>
        ) : (
          <Pressable style={[styles.doneBtn, { backgroundColor: colors.brandPrimary }]} onPress={() => setReviewOpen(true)} testID="mark-done-button">
            <Icon name="flag-checkered" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.doneBtnText}>Selesai</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={insets.top + 60}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.kind === "schedule" && item.schedule) {
              const s = item.schedule;
              const mineProposal = s.proposed_by === myUserId;
              const statusColor =
                s.status === "accepted" ? colors.success : s.status === "declined" ? colors.error : colors.warning;
              const statusText =
                s.status === "accepted" ? "Diterima" : s.status === "declined" ? "Ditolak" : "Menunggu";
              return (
                <View style={styles.schedCard} testID={`schedule-${s.id}`}>
                  <View style={styles.schedHead}>
                    <Icon name="calendar-clock" size={18} color={colors.brandPrimary} />
                    <Text style={styles.schedKind}>{s.kind}</Text>
                    <View style={[styles.schedStatus, { backgroundColor: statusColor }]}>
                      <Text style={styles.schedStatusText}>{statusText}</Text>
                    </View>
                  </View>
                  <Text style={styles.schedWhen}>{formatWhen(s.when)}</Text>
                  {s.note ? <Text style={styles.schedNote}>{s.note}</Text> : null}
                  {s.status === "pending" && !mineProposal ? (
                    <View style={styles.schedActions}>
                      <PrimaryButton
                        label="Tolak"
                        variant="outline"
                        onPress={() => respondMut.mutate({ schedId: s.id, accept: false })}
                        style={{ flex: 1, height: 40 }}
                        testID={`sched-decline-${s.id}`}
                      />
                      <PrimaryButton
                        label="Terima"
                        icon="check"
                        onPress={() => respondMut.mutate({ schedId: s.id, accept: true })}
                        style={{ flex: 1, height: 40 }}
                        testID={`sched-accept-${s.id}`}
                      />
                    </View>
                  ) : s.status === "pending" && mineProposal ? (
                    <Text style={styles.schedPendingHint}>Menunggu jawaban…</Text>
                  ) : null}
                </View>
              );
            }
            if (item.sender === "system") {
              return (
                <View style={styles.systemRow}>
                  <Text style={styles.systemText}>{item.text}</Text>
                </View>
              );
            }
            const mine = item.sender === myUserId || item.sender === "user";
            return (
              <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowOther]}>
                <View style={[styles.bubble, mine ? { backgroundColor: colors.brandPrimary } : { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={[styles.bubbleText, { color: mine ? colors.onBrandPrimary : colors.onSurface }]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Tulis pesan…"
            placeholderTextColor={colors.muted}
            multiline
            testID="chat-input"
          />
          <Pressable style={[styles.sendBtn, { backgroundColor: colors.brandPrimary }]} onPress={send} testID="chat-send">
            <Icon name="send" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={match?.entity_type === "worker" ? "Detail Pekerja" : "Detail Lowongan"}
        testID="chat-detail-sheet"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.detailHero}>
            <CategoryAvatar category={match?.category} photo={match?.image} size={72} variant="subtle" />
            <View style={styles.detailHeroCopy}>
              <Text style={styles.detailTitle}>{match?.title}</Text>
              <View style={styles.detailRole}>
                <Icon name={chatRole.icon} size={15} color={colors.brandPrimary} />
                <Text style={styles.detailRoleText}>{chatRole.label}</Text>
              </View>
              <Text style={styles.detailSubtitle}>{match?.subtitle}</Text>
            </View>
          </View>

          {match?.entity_type === "job" ? (
            <View style={styles.detailList}>
              <DetailRow label="Tipe Pemberi Kerja" value={employerTypeLabel(match?.employer_type)} />
              <DetailRow label="Usaha / Keluarga" value={match?.subtitle} />
              <DetailRow label="Kategori" value={match?.category} />
              <DetailRow
                label="Bayaran"
                value={match?.pay_amount
                  ? formatPay(match.pay_amount, match.pay_unit)
                  : "Belum dicantumkan"}
              />
              <DetailRow label="Tipe Kerja" value={match?.job_type || "Belum dicantumkan"} />
              <DetailRow
                label="Pengalaman"
                value={match?.experience_label || "Tidak wajib"}
              />
              {match?.description ? (
                <Text style={styles.detailDescription}>{match.description}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.detailList}>
              <DetailRow label="Keahlian" value={match?.category} />
              <DetailRow label="Pengalaman" value={match?.experience_label || "Belum dicantumkan"} />
              {match?.last_education ? (
                <DetailRow label="Pendidikan Terakhir" value={match.last_education} />
              ) : null}
              <DetailRow
                label="Tarif"
                value={match?.pay_display || (
                  match?.pay_amount
                    ? formatPay(match.pay_amount, match.pay_unit)
                    : "Belum dicantumkan"
                )}
              />
              <DetailRow label="Ketersediaan" value={match?.availability || "Belum dicantumkan"} />
              {match?.bio ? <Text style={styles.detailDescription}>{match.bio}</Text> : null}
            </View>
          )}

          {match?.allow_direct_call && match?.phone ? (
            <PrimaryButton
              label="Hubungi"
              icon="phone"
              variant="outline"
              onPress={callPartner}
              style={{ marginTop: spacing.md }}
              testID="chat-detail-call"
            />
          ) : null}
        </ScrollView>
      </BottomSheet>

      {/* Review sheet */}
      <BottomSheet visible={reviewOpen} onClose={() => setReviewOpen(false)} title="Tandai Selesai & Beri Rating" testID="review-sheet">
        <Text style={styles.reviewLabel}>Seberapa puas dengan kerjasama ini?</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable key={i} onPress={() => setRating(i)} hitSlop={6} testID={`star-${i}`}>
              <Icon name={i <= rating ? "star" : "star-outline"} size={40} color={colors.warning} />
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.reviewInput]}
          value={comment}
          onChangeText={setComment}
          placeholder="Tulis ulasan singkat (opsional)…"
          placeholderTextColor={colors.muted}
          multiline
          testID="review-comment"
        />
        <PrimaryButton
          label="Kirim Rating"
          icon="check"
          loading={reviewMut.isPending}
          onPress={() => reviewMut.mutate()}
          testID="submit-review"
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>

      {/* Schedule sheet */}
      <BottomSheet visible={schedOpen} onClose={() => setSchedOpen(false)} title="Jadwalkan Pertemuan" testID="schedule-sheet">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.schedLabel}>Jenis</Text>
          <View style={styles.schedChips}>
            {SCHEDULE_KINDS.map((k) => (
              <Chip key={k} label={k} active={schedKind === k} onPress={() => setSchedKind(k)} testID={`sched-kind-${k}`} />
            ))}
          </View>

          <Text style={styles.schedLabel}>Tanggal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.schedChips}>
            {days.map((d, i) => (
              <Chip key={i} label={d.label} active={schedDay === i} onPress={() => setSchedDay(i)} />
            ))}
          </ScrollView>

          <Text style={styles.schedLabel}>Jam</Text>
          <View style={styles.schedChips}>
            {TIME_SLOTS.map((t) => (
              <Chip key={t} label={t} active={schedTime === t} onPress={() => setSchedTime(t)} testID={`sched-time-${t}`} />
            ))}
          </View>

          <Text style={styles.schedLabel}>Catatan (opsional)</Text>
          <TextInput
            style={[styles.input, styles.reviewInput]}
            value={schedNote}
            onChangeText={setSchedNote}
            placeholder="cth. Lokasi ketemuan atau hal yang perlu dibawa…"
            placeholderTextColor={colors.muted}
            multiline
            testID="sched-note"
          />
          <PrimaryButton
            label="Kirim Usulan Jadwal"
            icon="calendar-check"
            loading={schedMut.isPending}
            onPress={() => schedMut.mutate()}
            testID="submit-schedule"
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "Belum dicantumkan"}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  verificationGate: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  gateIcon: {
    width: 96, height: 96, borderRadius: radius.pill, alignItems: "center",
    justifyContent: "center", backgroundColor: colors.brandTertiary, marginBottom: spacing.lg,
  },
  gateTitle: { fontFamily: fonts.medium, fontSize: 21, color: colors.onSurface, textAlign: "center" },
  gateText: {
    fontFamily: fonts.regular, fontSize: 14, lineHeight: 20,
    color: colors.muted, textAlign: "center", marginTop: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.pill },
  iconAvatar: { alignItems: "center", justifyContent: "center" },
  headerProfile: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  hName: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  hSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  headerRoleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerRoleText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.onSurfaceTertiary },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  headerIcon: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.pill,
  },
  doneBtnText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onBrandPrimary },
  doneTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.pill,
  },
  doneTagText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSuccess },
  msgList: { padding: spacing.lg, gap: spacing.sm },
  systemRow: { alignItems: "center", paddingVertical: spacing.sm },
  systemText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  bubbleRow: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  bubbleText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.onSurface,
    maxHeight: 120,
  },
  sendBtn: { width: 46, height: 46, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  detailHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailHeroCopy: { flex: 1, minWidth: 0 },
  detailTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 27,
    color: colors.onSurface,
  },
  detailRole: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  detailRoleText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onSurfaceTertiary },
  detailSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 2,
  },
  detailList: { paddingTop: spacing.sm },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  detailValue: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.onSurface,
    textAlign: "right",
  },
  detailDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurfaceTertiary,
    marginTop: spacing.md,
  },
  reviewLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center" },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginVertical: spacing.lg },
  reviewInput: { minHeight: 80, textAlignVertical: "top", paddingTop: spacing.md },
  schedLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.sm },
  schedChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  schedCard: {
    alignSelf: "stretch",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  schedHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  schedKind: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface, flex: 1 },
  schedStatus: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  schedStatusText: { fontFamily: fonts.medium, fontSize: 11, color: colors.onSuccess },
  schedWhen: { fontFamily: fonts.medium, fontSize: 14, color: colors.brandPrimary },
  schedNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 19 },
  schedActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  schedPendingHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: spacing.xs },
  pressed: { opacity: 0.72 },
}));
