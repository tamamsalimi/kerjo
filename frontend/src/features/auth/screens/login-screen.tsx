import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Platform, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/auth-context";
import { Icon, PrimaryButton } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const HERO_CATEGORIES = [
  { icon: "broom", label: "Kebersihan", left: "8%", top: 36, size: 54, rotate: "-8deg", alpha: 0.23 },
  { icon: "hammer-wrench", label: "Teknisi", left: "27%", top: 5, size: 46, rotate: "6deg", alpha: 0.17 },
  { icon: "car", label: "Driver", left: "48%", top: 35, size: 50, rotate: "-4deg", alpha: 0.2 },
  { icon: "clipboard-account-outline", label: "Admin", left: "69%", top: 8, size: 44, rotate: "7deg", alpha: 0.16 },
  { icon: "laptop", label: "IT dan developer", left: "91%", top: 38, size: 52, rotate: "-6deg", alpha: 0.22 },
  { icon: "camera-outline", label: "Fotografi", left: "17%", top: 91, size: 46, rotate: "5deg", alpha: 0.18 },
  { icon: "chef-hat", label: "Kuliner", left: "39%", top: 75, size: 56, rotate: "-3deg", alpha: 0.24 },
  { icon: "face-woman-shimmer", label: "Beauty", left: "62%", top: 95, size: 48, rotate: "7deg", alpha: 0.18 },
  { icon: "store-outline", label: "Retail dan toko", left: "84%", top: 82, size: 45, rotate: "-5deg", alpha: 0.17 },
  { icon: "motorbike", label: "Kurir dan delivery", left: "7%", top: 153, size: 47, rotate: "5deg", alpha: 0.18 },
  { icon: "hard-hat", label: "Konstruksi", left: "27%", top: 139, size: 53, rotate: "-7deg", alpha: 0.22 },
  { icon: "school-outline", label: "Pendidikan", left: "49%", top: 158, size: 46, rotate: "4deg", alpha: 0.17 },
  { icon: "hospital-box-outline", label: "Kesehatan", left: "69%", top: 136, size: 55, rotate: "-4deg", alpha: 0.23 },
  { icon: "car-wrench", label: "Mekanik", left: "92%", top: 153, size: 46, rotate: "7deg", alpha: 0.17 },
  { icon: "sprout", label: "Petani", left: "34%", top: 211, size: 48, rotate: "-5deg", alpha: 0.19 },
  { icon: "room-service-outline", label: "Hospitality", left: "70%", top: 207, size: 52, rotate: "5deg", alpha: 0.21 },
] as const;

export default function Login() {
  const { signIn, signingIn, authError } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const heroHeight = wide
    ? Math.max(520, Math.min(720, height * 0.62))
    : Math.max(440, Math.min(500, height * 0.58));
  const firstOpacity = useRef(new Animated.Value(0)).current;
  const secondOpacity = useRef(new Animated.Value(0)).current;
  const secondTranslateX = useRef(new Animated.Value(8)).current;
  const connectionOpacity = useRef(new Animated.Value(0)).current;
  const connectionScale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";
    const animation = Animated.sequence([
      Animated.delay(100),
      Animated.timing(firstOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver,
      }),
      Animated.parallel([
        Animated.timing(connectionOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver,
        }),
        Animated.timing(connectionScale, {
          toValue: 1,
          duration: 350,
          useNativeDriver,
        }),
        Animated.timing(secondOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver,
        }),
        Animated.timing(secondTranslateX, {
          toValue: 0,
          duration: 600,
          useNativeDriver,
        }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [connectionOpacity, connectionScale, firstOpacity, secondOpacity, secondTranslateX]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.page}
      bounces={false}
      showsVerticalScrollIndicator={false}
      testID="login-screen"
    >
      <LinearGradient
        colors={[colors.brandPrimary, colors.onBrandTertiary]}
        style={[styles.hero, { minHeight: heroHeight, paddingTop: insets.top + spacing.lg }]}
      >
        <View style={[styles.heroIcons, { maxWidth: wide ? 500 : 340 }]}>
          {HERO_CATEGORIES.map((category) => (
            <View
              key={category.label}
              style={[
                styles.heroIconBubble,
                {
                  left: category.left,
                  top: category.top,
                  width: category.size,
                  height: category.size,
                  marginLeft: -category.size / 2,
                  marginTop: -category.size / 2,
                  backgroundColor: `rgba(255,255,255,${category.alpha})`,
                  transform: [{ rotate: category.rotate }],
                },
              ]}
              accessible
              accessibilityLabel={category.label}
            >
              <Icon
                name={category.icon}
                size={Math.round(category.size * 0.46)}
                color={colors.onBrandPrimary}
              />
            </View>
          ))}
        </View>
        <View style={styles.heroLogo}>
          <View style={styles.heroLogoMark}>
            <Icon name="hand-wave" size={42} color={colors.brandPrimary} />
          </View>
          <Text style={styles.heroWordmark}>Kerjo</Text>
        </View>
      </LinearGradient>

      <View style={styles.sheet}>
        <View style={[styles.sheetInner, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.tagline}>ketemu, cocok?! kerja...</Text>
          <View
            style={styles.subRow}
            accessible
            accessibilityLabel="Sesama warga, saling bantu."
          >
            <Animated.Text style={[styles.sub, { opacity: firstOpacity }]}>
              sesama warga
            </Animated.Text>
            <Animated.View
              style={[
                styles.connectionAccent,
                { opacity: connectionOpacity, transform: [{ scaleX: connectionScale }] },
              ]}
            >
              <View style={styles.connectionDot} />
              <View style={styles.connectionLine} />
              <View style={styles.connectionDot} />
            </Animated.View>
            <Animated.Text
              style={[
                styles.sub,
                { opacity: secondOpacity, transform: [{ translateX: secondTranslateX }] },
              ]}
            >
              saling bantu
            </Animated.Text>
          </View>

          <PrimaryButton
            testID="google-login-button"
            label="Masuk"
            icon="google"
            loading={signingIn}
            onPress={signIn}
            style={{ marginTop: spacing.xl }}
          />
          {authError ? <Text style={styles.authError}>{authError}</Text> : null}
          <Text style={styles.terms}>Gratis untuk pekerja dan pemberi kerja.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  page: { flexGrow: 1, backgroundColor: colors.surface },
  hero: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
    gap: spacing.xl,
  },
  heroIcons: {
    width: "100%",
    height: 250,
    position: "relative",
  },
  heroIconBubble: {
    position: "absolute",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  heroLogo: { alignItems: "center", gap: spacing.sm },
  heroLogoMark: {
    width: 78,
    height: 78,
    borderRadius: 23,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heroWordmark: {
    fontFamily: fonts.wordmark,
    fontSize: 38,
    letterSpacing: 1,
    color: colors.onBrandPrimary,
  },
  sheet: {
    flexGrow: 1,
    marginTop: -spacing.xl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
  },
  sheetInner: { width: "100%", maxWidth: 520, alignSelf: "center", paddingTop: spacing["2xl"] },
  tagline: {
    fontFamily: fonts.headline,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.35,
    color: colors.onSurface,
    textAlign: "center",
  },
  sub: {
    fontFamily: fonts.tagline,
    fontSize: 17,
    color: colors.onSurfaceTertiary,
    lineHeight: 23,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  connectionAccent: {
    width: 16,
    height: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  connectionDot: {
    width: 3,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  connectionLine: { width: 8, height: 1, backgroundColor: colors.brandPrimary },
  authError: {
    fontFamily: fonts.regular, fontSize: 12, color: colors.error,
    textAlign: "center", marginTop: spacing.sm,
  },
  terms: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.md,
  },
}));
