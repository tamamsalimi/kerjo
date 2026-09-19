import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryAvatar, Icon } from "@/src/components/ui";
import { fetchMatches } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Matches() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["matches"],
    queryFn: fetchMatches,
    refetchInterval: 5000,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const matches = data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="matches-screen">
      <Text style={styles.title}>Match & Chat</Text>
      <Text style={styles.subtitle}>Mulai ngobrol dengan yang sudah cocok</Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyBubble}>
            <Icon name="chat-plus-outline" size={44} color={colors.brandPrimary} />
          </View>
          <Text style={styles.emptyTitle}>Belum ada match</Text>
          <Text style={styles.emptyText}>Mulai swipe untuk dapat match dan chat pertamamu!</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, paddingTop: spacing.md }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.id}`)} testID={`match-row-${item.id}`}>
              <CategoryAvatar category={item.category} photo={item.image} size={58} />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  {item.job_done ? (
                    <View style={[styles.donePill, { backgroundColor: colors.success }]}>
                      <Text style={styles.donePillText}>Selesai</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.rowSub} numberOfLines={1}>{item.subtitle}</Text>
                <Text style={styles.rowMsg} numberOfLines={1}>{item.last_message}</Text>
              </View>
              <Icon name="chevron-right" size={22} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyBubble: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { fontFamily: fonts.medium, fontSize: 20, color: colors.onSurface },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4, paddingHorizontal: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatar: { width: 58, height: 58, borderRadius: radius.pill },
  iconAvatar: { alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface, flexShrink: 1 },
  rowSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurfaceTertiary },
  rowMsg: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  donePill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  donePillText: { fontFamily: fonts.medium, fontSize: 11, color: colors.onSuccess },
}));
