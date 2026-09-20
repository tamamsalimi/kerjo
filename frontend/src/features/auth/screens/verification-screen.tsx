import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/auth-context";
import {
  fetchVerification,
  submitVerification,
  uploadVerificationDocument,
} from "@/src/features/auth/services/auth-service";
import { FormField, FormInput, Icon, PrimaryButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useImagePicker } from "@/src/hooks/use-image-picker";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

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
  const [ktpURI, setKTPURI] = useState("");
  const [faceURI, setFaceURI] = useState("");

  useEffect(() => {
    if (data?.phone) setPhone(data.phone);
  }, [data?.phone]);

  async function pickDocument(kind: DocumentKind) {
    const uri = await pickImage({
      allowsEditing: true,
      quality: 0.8,
      permissionMessage: "Izinkan akses foto untuk melanjutkan verifikasi",
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
      toast("Verifikasi dikirim untuk pemeriksaan", "success");
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
      toast("NIK harus terdiri dari 16 angka", "error");
      return;
    }
    if (!ktpURI && !data?.has_ktp_photo) {
      toast("Unggah foto KTP", "error");
      return;
    }
    if (!faceURI && !data?.has_face_photo) {
      toast("Unggah foto wajah", "error");
      return;
    }
    submit.mutate();
  }

  const status = data?.status ?? "unverified";
  const locked = status === "pending" || status === "approved";

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="verification-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="verification-back">
          <Icon name="chevron-left" size={28} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Verifikasi Identitas</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <StatusCard status={status} reason={data?.rejection_reason} />

        {!locked && !isLoading ? (
          <>
            <Text style={styles.privacy}>
              Data ini bersifat privat, tidak tampil di kartu profil, dan diperiksa manual.
            </Text>
            <FormField label="Nomor HP">
              <FormInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="0812 3456 7890"
                placeholderTextColor={colors.muted}
                testID="verification-phone"
              />
            </FormField>
            <FormField label="NIK KTP">
              <FormInput
                value={nik}
                onChangeText={(value) => setNIK(value.replace(/\D/g, "").slice(0, 16))}
                keyboardType="number-pad"
                secureTextEntry
                placeholder={data?.nik_masked || "16 digit NIK"}
                placeholderTextColor={colors.muted}
                testID="verification-nik"
              />
            </FormField>
            <DocumentPicker
              title="Foto KTP"
              hint="Pastikan seluruh kartu dan NIK terlihat jelas."
              uri={ktpURI}
              alreadyUploaded={!!data?.has_ktp_photo}
              onPress={() => pickDocument("ktp")}
              testID="verification-ktp"
            />
            <DocumentPicker
              title="Foto Wajah"
              hint="Gunakan foto wajah yang jelas untuk dicocokkan dengan KTP."
              uri={faceURI}
              alreadyUploaded={!!data?.has_face_photo}
              onPress={() => pickDocument("face")}
              testID="verification-face"
            />
            <PrimaryButton
              label="Kirim untuk Verifikasi"
              icon="shield-check"
              loading={submit.isPending}
              onPress={startSubmit}
              testID="verification-submit"
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatusCard({ status, reason }: { status: string; reason?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const config: Record<string, { icon: string; title: string; text: string; color: string }> = {
    unverified: {
      icon: "shield-outline", title: "Belum terverifikasi",
      text: "Lengkapi data di bawah untuk membuka fitur Chat.", color: colors.warning,
    },
    pending: {
      icon: "clock-outline", title: "Sedang diperiksa",
      text: "Data kamu menunggu pemeriksaan manual.", color: colors.warning,
    },
    approved: {
      icon: "shield-check", title: "Identitas terverifikasi",
      text: "Fitur Chat sudah terbuka.", color: colors.success,
    },
    rejected: {
      icon: "alert-circle-outline", title: "Verifikasi ditolak",
      text: reason || "Periksa kembali data dan kirim ulang.", color: colors.error,
    },
  };
  const item = config[status] || config.unverified;
  return (
    <View style={[styles.statusCard, { borderColor: item.color }]}>
      <Icon name={item.icon} size={28} color={item.color} />
      <View style={{ flex: 1 }}>
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
  return (
    <Pressable style={styles.document} onPress={onPress} testID={testID}>
      {uri ? (
        <Image source={{ uri }} style={styles.documentImage} contentFit="cover" />
      ) : (
        <View style={styles.documentIcon}>
          <Icon name={alreadyUploaded ? "check-circle" : "camera-plus-outline"} size={30} color={colors.brandPrimary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.documentTitle}>{title}</Text>
        <Text style={styles.documentHint}>
          {alreadyUploaded && !uri ? "Sudah diunggah • ketuk untuk mengganti" : hint}
        </Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.muted} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceTertiary },
  header: {
    minHeight: 48, paddingHorizontal: spacing.lg, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface,
  },
  headerTitle: { fontFamily: fonts.medium, fontSize: 18, color: colors.onSurface },
  content: { padding: spacing.lg, gap: spacing.lg },
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  statusTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  statusText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 2 },
  privacy: {
    fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted,
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md,
  },
  document: {
    minHeight: 82, flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.divider,
  },
  documentIcon: {
    width: 54, height: 54, borderRadius: radius.md, alignItems: "center",
    justifyContent: "center", backgroundColor: colors.brandTertiary,
  },
  documentImage: { width: 54, height: 54, borderRadius: radius.md },
  documentTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface },
  documentHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
}));
