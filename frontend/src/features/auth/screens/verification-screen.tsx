import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/auth-context";
import {
  fetchVerification,
  submitVerification,
  uploadVerificationDocument,
} from "@/src/features/auth/services/auth-service";
import { FormField, Icon, PrimaryButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useImagePicker } from "@/src/hooks/use-image-picker";
import { fonts, makeStyles, radius, softShadow, spacing, useTheme } from "@/src/theme";

type DocumentKind = "ktp" | "face";

export default function Verification() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const pickImage = useImagePicker();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["verification"], queryFn: fetchVerification });
  const [phone, setPhone] = useState("");
  const [nik, setNIK] = useState("");
  const [showNIK, setShowNIK] = useState(false);
  const [focusedField, setFocusedField] = useState<"phone" | "nik" | null>(null);
  const [ktpURI, setKTPURI] = useState("");
  const [faceURI, setFaceURI] = useState("");

  useEffect(() => {
    if (data?.phone) setPhone(data.phone);
  }, [data?.phone]);

  async function pickDocument(kind: DocumentKind) {
    const uri = await pickImage({
      allowsEditing: true,
      quality: 0.8,
      permissionMessage: "Izinkan akses foto untuk lanjut verifikasi",
    });
    if (!uri) return;
    if (kind === "ktp") setKTPURI(uri);
    else setFaceURI(uri);
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (ktpURI) await uploadVerificationDocument(ktpURI, "ktp");
      if (faceURI) await uploadVerificationDocument(faceURI, "face");
      return submitVerification(phone.trim(), nik.trim());
    },
    onSuccess: async (view) => {
      queryClient.setQueryData(["verification"], view);
      await refreshUser();
      toast("Verifikasi dikirim. Tim kami akan cek dulu ya", "success");
    },
    onError: (error: any) => toast(error?.message || "Gagal mengirim verifikasi", "error"),
  });

  function startSubmit() {
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 14) {
      toast("Masukkan nomor HP Indonesia yang valid", "error");
      return;
    }
    if (!/^\d{16}$/.test(nik.trim())) {
      toast("NIK harus 16 angka", "error");
      return;
    }
    if (!ktpURI && !data?.has_ktp_photo) {
      toast("Unggah foto KTP dulu ya", "error");
      return;
    }
    if (!faceURI && !data?.has_face_photo) {
      toast("Unggah foto wajah dulu ya", "error");
      return;
    }
    submit.mutate();
  }

  const status = data?.status ?? "unverified";
  const locked = status === "pending" || status === "approved";

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/profile");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="verification-screen">
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={6} style={styles.backBtn} testID="verification-back">
          <Icon name="chevron-left" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Verifikasi</Text>
          <Text style={styles.headerSubtitle}>Cek identitas biar bisa chat. Cepat, dan datanya aman.</Text>
        </View>
      </View>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        bounces
      >
        <StatusCard status={status} reason={data?.rejection_reason} />

        {!locked && !isLoading ? (
          <>
            <View style={styles.sectionCard}>
              <FormField label="Nomor HP">
                <TextInput
                  style={[styles.input, (focusedField === "phone" || phone.length > 0) && styles.inputActive]}
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={() => setFocusedField("phone")}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="phone-pad"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  textContentType="none"
                  importantForAutofill="no"
                  placeholder="0812 3456 7890"
                  placeholderTextColor={colors.muted}
                  testID="verification-phone"
                />
              </FormField>

              <FormField label="NIK KTP" helper={`${nik.length}/16 digit`} last>
                <View style={[styles.inputShell, (focusedField === "nik" || nik.length > 0) && styles.inputActive]}>
                  <TextInput
                    style={styles.inputField}
                    value={nik}
                    onChangeText={(value) => setNIK(value.replace(/\D/g, "").slice(0, 16))}
                    onFocus={() => setFocusedField("nik")}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    textContentType="none"
                    importantForAutofill="no"
                    secureTextEntry={!showNIK}
                    placeholder={data?.nik_masked || "16 digit NIK"}
                    placeholderTextColor={colors.muted}
                    testID="verification-nik"
                  />
                  <Pressable onPress={() => setShowNIK((value) => !value)} hitSlop={8} testID="verification-nik-toggle">
                    <Icon name={showNIK ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
                  </Pressable>
                </View>
              </FormField>
            </View>

            <View style={styles.sectionCard}>
              <DocumentPicker
                title="Foto KTP"
                hint="Seluruh kartu dan NIK kelihatan jelas."
                uri={ktpURI}
                alreadyUploaded={!!data?.has_ktp_photo}
                onPress={() => pickDocument("ktp")}
                testID="verification-ktp"
              />
              <DocumentPicker
                title="Foto Wajah"
                hint="Menghadap kamera, cahaya merata."
                uri={faceURI}
                alreadyUploaded={!!data?.has_face_photo}
                onPress={() => pickDocument("face")}
                testID="verification-face"
              />
            </View>

            <View style={styles.privacyRow}>
              <Icon name="lock-outline" size={16} color={colors.muted} />
              <Text style={styles.privacy}>
                Datamu privat di Kerjo. Dicek manual, nggak tampil di profil.
              </Text>
            </View>

            <PrimaryButton
              label="Kirim verifikasi"
              icon="hand-wave"
              loading={submit.isPending}
              onPress={startSubmit}
              testID="verification-submit"
              style={styles.submitBtn}
            />
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function StatusCard({ status, reason }: { status: string; reason?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const config: Record<string, { icon: string; title: string; text: string; color: string; surface: string }> = {
    unverified: {
      icon: "hand-wave",
      title: "Belum diverifikasi",
      text: "Isi data di bawah, biar fitur Chat kebuka.",
      color: colors.brandPrimary,
      surface: colors.brandTertiary,
    },
    pending: {
      icon: "clock-outline",
      title: "Sedang dicek",
      text: "Santai dulu, tim kami lagi ngecek datamu.",
      color: colors.attention,
      surface: colors.warningSurface,
    },
    approved: {
      icon: "check-decagram",
      title: "Sudah terverifikasi",
      text: "Chat sudah kebuka. Terima kasih ya.",
      color: colors.success,
      surface: colors.successSurface,
    },
    rejected: {
      icon: "alert-circle-outline",
      title: "Belum lolos",
      text: reason || "Coba cek lagi datanya, lalu kirim ulang.",
      color: colors.error,
      surface: colors.errorSurface,
    },
  };
  const item = config[status] || config.unverified;
  return (
    <View style={[styles.statusCard, { backgroundColor: item.surface }]}>
      <View style={[styles.statusBadge, { backgroundColor: colors.surface }]}>
        <Icon name={item.icon} size={22} color={item.color} />
      </View>
      <View style={styles.statusCopy}>
        <Text style={styles.statusTitle}>{item.title}</Text>
        <Text style={styles.statusText}>{item.text}</Text>
      </View>
    </View>
  );
}

function DocumentPicker({
  title, hint, uri, alreadyUploaded, onPress, testID,
}: {
  title: string;
  hint: string;
  uri: string;
  alreadyUploaded: boolean;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const ready = Boolean(uri || alreadyUploaded);
  return (
    <Pressable
      style={[styles.document, ready && styles.documentReady]}
      onPress={onPress}
      testID={testID}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.documentImage} contentFit="cover" />
      ) : (
        <View style={[styles.documentIcon, ready && styles.documentIconReady]}>
          <Icon
            name={alreadyUploaded ? "check-circle" : "camera-plus-outline"}
            size={24}
            color={ready ? colors.success : colors.brandPrimary}
          />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.documentTitle}>{title}</Text>
        <Text style={styles.documentHint}>
          {alreadyUploaded && !uri ? "Sudah diunggah • ketuk untuk ganti" : hint}
        </Text>
      </View>
      <View style={[styles.documentActionChip, ready && styles.documentActionChipReady]}>
        <Text style={[styles.documentAction, ready && styles.documentActionReady]}>
          {ready ? "Ganti" : "Unggah"}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceTertiary },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginTop: 2,
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.onSurface,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.xl,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  statusBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCopy: { flex: 1, minWidth: 0, gap: 2 },
  statusTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onSurface,
  },
  statusText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...softShadow,
  },
  input: {
    minHeight: 54,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurface,
    outlineWidth: 0,
    outlineStyle: "solid",
    outlineColor: "transparent",
  },
  inputActive: {
    borderColor: colors.brandPrimary,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceTertiary,
    backgroundColor: colors.surfaceTertiary,
  },
  inputField: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurface,
    backgroundColor: "transparent",
    outlineWidth: 0,
    outlineStyle: "solid",
    outlineColor: "transparent",
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  privacy: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  submitBtn: {
    borderRadius: radius.hero,
  },
  document: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.hero,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  documentReady: {
    borderStyle: "solid",
    borderColor: colors.success,
    backgroundColor: colors.successSurface,
  },
  documentIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTertiary,
  },
  documentIconReady: { backgroundColor: colors.surface },
  documentImage: { width: 52, height: 52, borderRadius: radius.pill },
  documentTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  documentHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 2,
  },
  documentActionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  documentActionChipReady: {
    backgroundColor: colors.surface,
  },
  documentAction: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.brandPrimary,
  },
  documentActionReady: {
    color: colors.success,
  },
}));
