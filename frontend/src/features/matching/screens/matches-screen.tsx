import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLockup, CategoryAvatar, EmptyState, Icon, PrimaryButton } from "@/src/components/ui";
import { useAuth } from "@/src/features/auth/auth-context";
import { fetchMatches } from "@/src/features/matching/services/matching-service";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type ChatScope = "workers" | "jobs";

export default function Matches() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;
  const verified = user?.verification_status === "approved";
  const [chatScope, setChatScope] = useState<ChatScope>("jobs");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["matches"],
    queryFn: fetchMatches,
    refetchInterval: 5000,
    enabled: verified,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshUserRef.current();
      if (verified) refetch();
    }, [refetch, verified]),
  );

  const matches = data ?? [];
  const visibleMatches = matches.filter((match) => (
    chatScope === "jobs" ? match.entity_type === "job" : match.entity_type === "worker"
  ));
  const jobChatCount = matches.filter((match) => match.entity_type === "job").length;
  const workerChatCount = matches.filter((match) => match.entity_type === "worker").length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="matches-screen">
      <View style={styles.header}>
        <View pointerEvents="none" style={[styles.headerShape, styles.headerShapeLarge]} />
        <View pointerEvents="none" style={[styles.headerShape, styles.headerShapeSmall]} />
        <View style={styles.headerContent}>
          <BrandLockup compact />
          <Icon name="chat-processing" size={36} color={colors.brandPrimary} />
        </View>
      </View>

      {verified ? (
        <View style={styles.roleTabs} testID="chat-role-tabs">
          <ChatScopeTab
            label="Pekerja"
            icon="account-hard-hat"
            count={workerChatCount}
            active={chatScope === "workers"}
            onPress={() => setChatScope("workers")}
            testID="chat-scope-workers"
          />
          <ChatScopeTab
            label="Lowongan"
            icon="briefcase"
            count={jobChatCount}
            active={chatScope === "jobs"}
            onPress={() => setChatScope("jobs")}
            testID="chat-scope-jobs"
          />
        </View>
      ) : null}

      {!verified ? (
        <EmptyState
          icon="shield-lock-outline"
          title="Verifikasi untuk membuka chat"
          message="Kirim nomor HP, NIK, foto KTP, dan foto wajah untuk pemeriksaan."
        >
          <PrimaryButton
            label="Verifikasi Identitas"
            icon="shield-account"
            onPress={() => router.push("/verification")}
            style={{ marginTop: spacing.lg }}
            testID="chat-verification-cta"
          />
        </EmptyState>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : visibleMatches.length === 0 ? (
        <EmptyState
          icon="chat-plus-outline"
          title="Belum ada chat"
          message={
            chatScope === "jobs"
              ? "Chat tentang lowongan akan muncul di sini."
              : "Chat dengan pekerja akan muncul di sini."
          }
        />
      ) : (
        <FlatList
          data={visibleMatches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacing.xl,
            paddingTop: spacing.md,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const time = conversationTime(item);
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.id}`)} testID={`match-row-${item.id}`}>
              <CategoryAvatar category={item.category} size={58} variant="subtle" />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  {item.job_done ? (
                    <View style={styles.donePill}>
                      <Icon name="check" size={13} color={colors.success} />
                      <Text style={styles.donePillText}>Selesai</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.rowSub} numberOfLines={1}>{item.subtitle}</Text>
                <Text style={styles.rowMsg} numberOfLines={1}>{item.last_message}</Text>
              </View>
              <View style={styles.rowAside}>
                {time ? <Text style={styles.rowTime}>{time}</Text> : null}
                <Icon name="chevron-right" size={20} color={colors.borderStrong} />
              </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function ChatScopeTab({
  label,
  icon,
  count,
  active,
  onPress,
  testID,
}: {
  label: string;
  icon: string;
  count: number;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.roleTab,
        active && styles.roleTabActive,
        pressed && styles.roleTabPressed,
      ]}
      onPress={onPress}
      testID={testID}
    >
      <Icon name={icon} size={17} color={active ? colors.onBrandPrimary : colors.muted} />
      <Text style={[styles.roleTabText, active && styles.roleTabTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {count > 0 ? (
        <View style={[styles.roleCount, active && styles.roleCountActive]}>
          <Text style={[styles.roleCountText, active && styles.roleCountTextActive]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function conversationTime(match: any) {
  const raw = match.last_message_at || match.updated_at || match.created_at;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Kemarin";

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.floor((today.getTime() - messageDay.getTime()) / 86_400_000);
  if (daysAgo > 1 && daysAgo <= 6) return `${daysAgo} hari lalu`;

  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  header: {
    minHeight: 52,
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  headerShape: {
    position: "absolute",
    borderRadius: radius.pill,
  },
  headerShapeLarge: {
    width: 112,
    height: 112,
    right: -48,
    top: -68,
    backgroundColor: colors.brandSurfaceSubtle,
  },
  headerShapeSmall: {
    width: 72,
    height: 72,
    right: 20,
    top: -44,
    backgroundColor: colors.brandSecondary,
    opacity: 0.18,
  },
  roleTabs: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceTertiary,
  },
  roleTab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  roleTabActive: { backgroundColor: colors.brandPrimary },
  roleTabPressed: { opacity: 0.74 },
  roleTabText: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.muted,
  },
  roleTabTextActive: { color: colors.onBrandPrimary },
  roleCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border,
  },
  roleCountActive: { backgroundColor: colors.surface },
  roleCountText: { fontFamily: fonts.bold, fontSize: 9, color: colors.onSurfaceTertiary },
  roleCountTextActive: { color: colors.brandPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceSecondary,
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 9,
    elevation: 1,
  },
  avatar: { width: 58, height: 58, borderRadius: radius.pill },
  iconAvatar: { alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.15,
    color: colors.onSurface,
    flexShrink: 1,
  },
  rowSub: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceTertiary,
  },
  rowMsg: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  rowAside: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  rowTime: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
    color: colors.muted,
  },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.successSurface,
  },
  donePillText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: colors.success,
  },
}));
