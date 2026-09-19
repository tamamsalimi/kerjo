import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryAvatar, Icon, PrimaryButton, RatingStars } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { fetchApplicants, postSwipe } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Applicants() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["applicants"],
    queryFn: fetchApplicants,
    refetchInterval: 6000,
  });

  const acceptMut = useMutation({
    mutationFn: (workerId: string) => postSwipe("worker", workerId, "right"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["applicants"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      if (res.matched && res.match) {
        toast("Cocok! 🎉 Mulai obrolan", "success");
        router.push(`/chat/${res.match.id}`);
      } else {
        toast("Tersimpan. Menunggu konfirmasi pelamar.", "info");
      }
    },
    onError: () => toast("Gagal memproses", "error"),
  });

  const applicants = data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="applicants-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="applicants-back">
          <Icon name="chevron-left" size={28} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pelamar</Text>
          <Text style={styles.subtitle}>Mereka tertarik dengan lowonganmu</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : applicants.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyBubble}>
            <Icon name="account-search-outline" size={44} color={colors.brandPrimary} />
          </View>
          <Text style={styles.emptyTitle}>Belum ada pelamar</Text>
          <Text style={styles.emptyText}>Pasang lowongan dan tunggu pekerja tertarik pada pekerjaanmu.</Text>
        </View>
      ) : (
        <FlatList
          data={applicants}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`applicant-${item.id}`}>
              <Pressable style={styles.cardTop} onPress={() => router.push(`/worker/${item.id}`)}>
                <CategoryAvatar category={item.category} photo={item.avatar} size={54} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.role} numberOfLines={1}>{item.role} • {item.experience_label}</Text>
                  {item.is_new ? (
                    <Text style={styles.newHint}>🆕 Baru di Kerjo</Text>
                  ) : (
                    <View style={styles.ratingRow}>
                      <RatingStars rating={item.rating} size={13} />
                      <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)} • {item.jobs_completed} kerja</Text>
                    </View>
                  )}
                </View>
                <Icon name="chevron-right" size={22} color={colors.muted} />
              </Pressable>

              <View style={styles.jobTag}>
                <Icon name="briefcase-outline" size={14} color={colors.onSurfaceTertiary} />
                <Text style={styles.jobTagText} numberOfLines={1}>Melamar: {item.applied_job_title}</Text>
              </View>

              {Array.isArray(item.screening_questions) && item.screening_questions.length ? (
                <View style={styles.screening}>
                  {item.screening_questions.map((q: string, i: number) => (
                    <View key={i} style={{ marginBottom: spacing.xs }}>
                      <Text style={styles.qText}>{q}</Text>
                      <Text style={styles.aText}>
                        {item.screening_answers?.[i]?.trim() ? item.screening_answers[i] : "— tidak dijawab —"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {item.matched ? (
                <PrimaryButton
                  label="Buka Chat"
                  icon="chat-processing"
                  variant="inverse"
                  onPress={() => router.push(`/chat/${item.match_id}`)}
                  style={{ height: 44, marginTop: spacing.sm }}
                  testID={`open-chat-${item.id}`}
                />
              ) : (
                <PrimaryButton
                  label="Terima & Cocokkan"
                  icon="hand-heart"
                  loading={acceptMut.isPending && acceptMut.variables === item.id}
                  onPress={() => acceptMut.mutate(item.id)}
                  style={{ height: 44, marginTop: spacing.sm }}
                  testID={`accept-${item.id}`}
                />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { fontFamily: fonts.medium, fontSize: 24, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  emptyBubble: {
    width: 96, height: 96, borderRadius: radius.pill, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  emptyTitle: { fontFamily: fonts.medium, fontSize: 20, color: colors.onSurface },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  role: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 1 },
  newHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.info, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  ratingText: { fontFamily: fonts.medium, fontSize: 12, color: colors.onSurfaceSecondary },
  jobTag: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md,
    backgroundColor: colors.surfaceTertiary, alignSelf: "flex-start",
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  jobTagText: { fontFamily: fonts.medium, fontSize: 12, color: colors.onSurfaceTertiary },
  screening: { marginTop: spacing.md, gap: 2 },
  qText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurfaceSecondary },
  aText: { fontFamily: fonts.regular, fontSize: 14, color: colors.onSurface, lineHeight: 20 },
}));
