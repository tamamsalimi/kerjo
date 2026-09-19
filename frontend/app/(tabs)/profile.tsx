import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth-context";
import { CategoryAvatar, Icon, PrimaryButton } from "@/src/components/ui";
import { categoryIcon } from "@/src/constants";
import { getProfile } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const { data: profile, refetch } = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="profile-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
      >
        <View style={styles.head}>
          <CategoryAvatar category={profile?.category} photo={profile?.photo_url} size={96} />
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={[styles.verifyPill, { backgroundColor: colors.brandTertiary }]}>
            <Icon name="shield-check-outline" size={15} color={colors.onBrandTertiary} />
            <Text style={[styles.verifyText, { color: colors.onBrandTertiary }]}>Akun Google terhubung</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Profil Pekerja</Text>
            <PrimaryButton
              label={profile ? "Ubah" : "Buat"}
              variant="outline"
              onPress={() => router.push("/onboarding")}
              style={{ height: 40, paddingHorizontal: spacing.lg }}
              testID="edit-profile"
            />
          </View>

          {profile ? (
            <View style={{ gap: spacing.sm }}>
              <Row icon={categoryIcon(profile.category)} label="Kategori" value={profile.category} />
              <Row icon="briefcase-outline" label="Pengalaman" value={profile.experience_label} />
              {profile.availability ? <Row icon="clock-outline" label="Ketersediaan" value={profile.availability} /> : null}
              {profile.rate ? <Row icon="cash" label="Tarif" value={profile.rate} /> : null}
              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            </View>
          ) : (
            <Text style={styles.emptyProfile}>
              Belum ada profil pekerja. Buat profil agar pemberi kerja bisa menemukanmu saat mereka merekrut.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kepercayaan & Keamanan</Text>
          <Row icon="check-decagram" label="Verifikasi" value="Terhubung Google" />
          <Row icon="star-outline" label="Rating" value="Belum ada rating" />
          <Row icon="briefcase-check-outline" label="Kerja selesai" value="0 pekerjaan" />
          <Text style={styles.hint}>Selesaikan pekerjaan untuk mengumpulkan rating dan lencana terpercaya.</Text>
        </View>

        <PrimaryButton
          label="Keluar"
          icon="logout"
          variant="inverse"
          onPress={signOut}
          testID="logout-button"
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
        <Icon name={icon} size={18} color={colors.onSurfaceTertiary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  head: { alignItems: "center", paddingVertical: spacing.lg },
  avatar: { width: 96, height: 96, borderRadius: radius.pill },
  avatarFallback: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.medium, fontSize: 24, color: colors.onSurface, marginTop: spacing.md },
  email: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 2 },
  verifyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  verifyText: { fontFamily: fonts.medium, fontSize: 13 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  cardTitle: { fontFamily: fonts.medium, fontSize: 18, color: colors.onSurface },
  emptyProfile: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, lineHeight: 21 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  rowValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface, marginLeft: "auto" },
  bio: { fontFamily: fonts.regular, fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 21, marginTop: spacing.xs },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
}));
