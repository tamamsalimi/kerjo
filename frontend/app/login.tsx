import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth-context";
import { Icon, PrimaryButton } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const HERO_ICONS = ["broom", "hammer-wrench", "car", "laptop", "camera", "chef-hat", "flower", "school"];

export default function Login() {
  const { signIn, signingIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.container} testID="login-screen">
      <LinearGradient colors={[colors.brandPrimary, colors.onBrandTertiary]} style={styles.hero}>
        <View style={styles.heroIcons}>
          {HERO_ICONS.map((n, i) => (
            <View key={i} style={styles.heroIconBubble}>
              <Icon name={n} size={22} color="#FFFFFF" />
            </View>
          ))}
        </View>
        <View style={styles.heroLogo}>
          <View style={styles.heroLogoMark}>
            <Icon name="hand-wave" size={40} color={colors.brandPrimary} />
          </View>
          <Text style={styles.heroWordmark}>Kerjo</Text>
        </View>
      </LinearGradient>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.tagline}>Temukan kerja terpercaya secepat swipe</Text>
        <Text style={styles.sub}>
          Dari bersih-bersih sampai web developer — geser kanan untuk kerja atau cari pekerja
          terbaik di sekitarmu.
        </Text>

        <View style={styles.trustRow}>
          <TrustItem icon="check-decagram" text="Terverifikasi" color={colors.success} />
          <TrustItem icon="star" text="Rating asli" color={colors.warning} />
          <TrustItem icon="map-marker" text="Lokasi dekat" color={colors.brandPrimary} />
        </View>

        <PrimaryButton
          testID="google-login-button"
          label="Masuk dengan Google"
          icon="google"
          loading={signingIn}
          onPress={signIn}
          style={{ marginTop: spacing.lg }}
        />
        <Text style={styles.terms}>Gratis untuk pekerja dan pemberi kerja.</Text>
      </View>
    </View>
  );
}

function TrustItem({ icon, text, color }: { icon: string; text: string; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.trustItem}>
      <Icon name={icon} size={18} color={color} />
      <Text style={styles.trustText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { height: "56%", paddingTop: spacing["3xl"], alignItems: "center", justifyContent: "space-between" },
  heroIcons: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingTop: spacing.xl, maxWidth: 320,
  },
  heroIconBubble: {
    width: 46, height: 46, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  heroLogo: { alignItems: "center", gap: spacing.md, marginBottom: spacing["3xl"] },
  heroLogoMark: {
    width: 76, height: 76, borderRadius: 22, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },
  heroWordmark: { fontFamily: fonts.medium, fontSize: 40, color: "#FFFFFF" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl, paddingTop: spacing.xl,
  },
  tagline: { fontFamily: fonts.medium, fontSize: 22, color: colors.onSurface, marginTop: spacing.lg },
  sub: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, marginTop: spacing.sm, lineHeight: 22 },
  trustRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.lg },
  trustItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  trustText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurfaceTertiary },
  terms: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: spacing.md },
}));
