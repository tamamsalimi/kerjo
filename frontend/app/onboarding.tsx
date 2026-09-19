import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth-context";
import { CategoryAvatar, Chip, Icon, PrimaryButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { CATEGORIES, EXPERIENCE_LABELS, categoryIcon } from "@/src/constants";
import { getProfile, saveProfile, uploadPhoto } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  const [name, setName] = useState(user?.name ?? "");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [experience, setExperience] = useState(EXPERIENCE_LABELS[1]);
  const [availability, setAvailability] = useState("");
  const [rate, setRate] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name ?? name);
      setCategory(existing.category ?? CATEGORIES[0]);
      setExperience(existing.experience_label ?? EXPERIENCE_LABELS[1]);
      setAvailability(existing.availability ?? "");
      setRate(existing.rate ?? "");
      setPhone(existing.phone ?? "");
      setBio(existing.bio ?? "");
      setPhotoUrl(existing.photo_url ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  async function pickPhoto() {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      if (!perm.canAskAgain) {
        toast("Izinkan akses foto di Pengaturan", "info");
        Linking.openSettings();
        return;
      }
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = req.status;
      if (status !== "granted") {
        if (!req.canAskAgain) {
          toast("Izinkan akses foto di Pengaturan", "info");
          Linking.openSettings();
        } else {
          toast("Akses foto dibutuhkan untuk unggah", "info");
        }
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (res.canceled) return;
    try {
      setUploading(true);
      const url = await uploadPhoto(res.assets[0].uri);
      setPhotoUrl(url);
      toast("Foto terunggah 📸", "success");
    } catch {
      toast("Gagal mengunggah foto", "error");
    } finally {
      setUploading(false);
    }
  }

  function done() {
    refreshUser();
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: () => {
      toast("Profil pekerja tersimpan! 🎉", "success");
      done();
    },
    onError: () => toast("Gagal menyimpan profil", "error"),
  });

  function submit() {
    if (!name.trim()) {
      toast("Isi nama kamu dulu ya", "error");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      category,
      experience_label: experience,
      availability: availability.trim(),
      rate: rate.trim(),
      phone: phone.trim(),
      bio: bio.trim(),
      photo_url: photoUrl || null,
    });
  }

  function skip() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="onboarding-screen">
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Icon name="hand-wave" size={20} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brand}>Kerjo</Text>
        </View>
        <Pressable onPress={skip} hitSlop={10} testID="skip-onboarding">
          <Text style={styles.skip}>Lewati</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Buat Profil Pekerja</Text>
      <Text style={styles.subtitle}>Biar pemberi kerja gampang menemukanmu. Semua opsional kecuali nama.</Text>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.form}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoRow}>
          <Pressable onPress={pickPhoto} testID="upload-photo-avatar">
            <CategoryAvatar category={category} photo={photoUrl} size={84} />
            <View style={styles.photoBadge}>
              <Icon name="camera" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Foto Profil (opsional)</Text>
            <PrimaryButton
              label={uploading ? "Mengunggah…" : photoUrl ? "Ganti Foto" : "Unggah Foto"}
              variant="outline"
              icon="image-plus"
              loading={uploading}
              onPress={pickPhoto}
              testID="upload-photo"
              style={{ height: 44 }}
            />
          </View>
        </View>

        <Field label="Nama">
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nama lengkapmu"
            placeholderTextColor={colors.muted}
            testID="ob-name"
          />
        </Field>

        <Field label="Kategori Keahlian">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} icon={categoryIcon(c)} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>
        </Field>

        <Field label="Pengalaman">
          <View style={styles.wrapChips}>
            {EXPERIENCE_LABELS.map((e) => (
              <Chip key={e} label={e} active={experience === e} onPress={() => setExperience(e)} />
            ))}
          </View>
        </Field>

        <Field label="Ketersediaan">
          <TextInput
            style={styles.input}
            value={availability}
            onChangeText={setAvailability}
            placeholder="cth. Senin-Jumat, full-time"
            placeholderTextColor={colors.muted}
            testID="ob-availability"
          />
        </Field>

        <Field label="Tarif (opsional)">
          <TextInput
            style={styles.input}
            value={rate}
            onChangeText={setRate}
            placeholder="cth. Rp120.000/hari"
            placeholderTextColor={colors.muted}
            testID="ob-rate"
          />
        </Field>

        <Field label="Nomor Telepon (opsional)">
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="cth. 0812xxxxxxx"
            keyboardType="phone-pad"
            placeholderTextColor={colors.muted}
            testID="ob-phone"
          />
        </Field>

        <Field label="Bio Singkat">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Ceritakan keahlian dan kelebihanmu…"
            placeholderTextColor={colors.muted}
            multiline
            testID="ob-bio"
          />
        </Field>

        <PrimaryButton
          label="Simpan Profil"
          icon="check"
          loading={mutation.isPending}
          onPress={submit}
          testID="save-profile"
          style={{ marginTop: spacing.sm }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontFamily: fonts.medium, fontSize: 22, color: colors.onSurface },
  skip: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  title: { fontFamily: fonts.medium, fontSize: 26, color: colors.onSurface, marginTop: spacing.lg },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: spacing.md, lineHeight: 21 },
  form: { paddingTop: spacing.sm, paddingBottom: spacing["2xl"] },
  photoRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.lg },
  photoBadge: {
    position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surface,
  },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurface,
  },
  textarea: { minHeight: 90, textAlignVertical: "top", paddingTop: spacing.md },
  chipScroll: { gap: spacing.sm, paddingBottom: spacing.xs },
  wrapChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
}));
