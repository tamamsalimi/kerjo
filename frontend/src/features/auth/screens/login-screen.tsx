import {LinearGradient} from "expo-linear-gradient";
import {ScrollView, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

import {useAuth} from "@/src/features/auth/auth-context";
import {Icon, PrimaryButton} from "@/src/components/ui";
import {useAppLayout} from "@/src/layout/phone-frame";
import {fonts, makeStyles, radius, spacing, useTheme} from "@/src/theme";

const HERO_CATEGORIES = [
    {icon: "broom", label: "Kebersihan", left: "8%", top: 36, size: 54, rotate: "-8deg", alpha: 0.23},
    {icon: "hammer-wrench", label: "Teknisi", left: "27%", top: 5, size: 46, rotate: "6deg", alpha: 0.17},
    {icon: "car", label: "Driver", left: "48%", top: 35, size: 50, rotate: "-4deg", alpha: 0.2},
    {icon: "clipboard-account-outline", label: "Admin", left: "69%", top: 8, size: 44, rotate: "7deg", alpha: 0.16},
    {icon: "laptop", label: "IT dan developer", left: "91%", top: 38, size: 52, rotate: "-6deg", alpha: 0.22},
    {icon: "camera-outline", label: "Fotografi", left: "17%", top: 91, size: 46, rotate: "5deg", alpha: 0.18},
    {icon: "chef-hat", label: "Kuliner", left: "39%", top: 75, size: 56, rotate: "-3deg", alpha: 0.24},
    {icon: "face-woman-shimmer", label: "Beauty", left: "62%", top: 95, size: 48, rotate: "7deg", alpha: 0.18},
    {icon: "store-outline", label: "Retail dan toko", left: "84%", top: 82, size: 45, rotate: "-5deg", alpha: 0.17},
    {icon: "motorbike", label: "Kurir dan delivery", left: "7%", top: 153, size: 47, rotate: "5deg", alpha: 0.18},
    {icon: "hard-hat", label: "Konstruksi", left: "27%", top: 139, size: 53, rotate: "-7deg", alpha: 0.22},
    {icon: "school-outline", label: "Pendidikan", left: "49%", top: 158, size: 46, rotate: "4deg", alpha: 0.17},
    {icon: "hospital-box-outline", label: "Kesehatan", left: "69%", top: 136, size: 55, rotate: "-4deg", alpha: 0.23},
    {icon: "car-wrench", label: "Mekanik", left: "92%", top: 153, size: 46, rotate: "7deg", alpha: 0.17},
    {icon: "sprout", label: "Petani", left: "34%", top: 211, size: 48, rotate: "-5deg", alpha: 0.19},
    {icon: "room-service-outline", label: "Hospitality", left: "70%", top: 207, size: 52, rotate: "5deg", alpha: 0.21},
] as const;

export default function Login() {
    const {signIn, signingIn, authError} = useAuth();
    const insets = useSafeAreaInsets();
    const {colors} = useTheme();
    const styles = useStyles();
    const {width, height} = useAppLayout();
    const wide = width >= 700;
    const heroHeight = wide
        ? Math.max(520, Math.min(720, height * 0.62))
        : Math.max(440, Math.min(500, height * 0.58));

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
                style={[styles.hero, {minHeight: heroHeight, paddingTop: insets.top + spacing.lg}]}
            >
                <View style={[styles.heroIcons, {maxWidth: wide ? 500 : 340}]}>
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
                                    transform: [{rotate: category.rotate}],
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
                        <Icon name="hand-wave" size={58} color={colors.brandPrimary}/>
                    </View>
                    <Text style={styles.heroWordmark}>Kerjo</Text>
                </View>
            </LinearGradient>

            <View style={styles.sheet}>
                <View style={[styles.sheetInner, {paddingBottom: insets.bottom + spacing.xl}]}>
                    <PrimaryButton
                        testID="google-login-button"
                        label="Masuk"
                        icon="google"
                        loading={signingIn}
                        onPress={signIn}
                        style={styles.googleButton}
                    />
                    {authError ? <Text style={styles.authError}>{authError}</Text> : null}
                    <Text style={styles.terms}>Gratis untuk pekerja dan pemberi kerja.</Text>
                </View>
            </View>
        </ScrollView>
    );
}

const useStyles = makeStyles((colors) => ({
    container: {flex: 1, backgroundColor: colors.surface},
    page: {flexGrow: 1, backgroundColor: colors.surface},
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
    heroLogo: {
        alignItems: "center",
        gap: spacing.xs,
        transform: [{translateY: 6}],
    },
    heroLogoMark: {
        width: 108,
        height: 108,
        borderRadius: 30,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    heroWordmark: {
        fontFamily: fonts.wordmark,
        fontSize: 52,
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
    sheetInner: {width: "100%", maxWidth: 520, alignSelf: "center", paddingTop: spacing["3xl"]},
    googleButton: {
        width: "82%",
        minWidth: 240,
        maxWidth: 320,
        height: 48,
        alignSelf: "center",
    },
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
