import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth-context";
import { Icon, PrimaryButton } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const HERO =
  "https://images.pexels.com/photos/7175995/pexels-photo-7175995.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Login() {
  const { signIn, signingIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.container} testID="login-screen">
      <Image source={{ uri: HERO }} style={styles.hero} contentFit="cover" />
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(230,36,41,0.15)", colors.surface]}
        locations={[0, 0.5, 0.92]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Icon name="hand-wave" size={26} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.logo}>Kerjo</Text>
        </View>

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
  hero: { width: "100%", height: "58%" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { fontFamily: fonts.medium, fontSize: 34, color: colors.onSurface },
  tagline: { fontFamily: fonts.medium, fontSize: 22, color: colors.onSurface, marginTop: spacing.lg },
  sub: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, marginTop: spacing.sm, lineHeight: 22 },
  trustRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.lg },
  trustItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  trustText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurfaceTertiary },
  terms: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: spacing.md },
}));
