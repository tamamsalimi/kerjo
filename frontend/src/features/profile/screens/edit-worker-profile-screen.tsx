import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/auth-context";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { CategorySelectField, CategorySelector } from "@/src/components/category-selector";
import {
  BrandLockup,
  CompactSelect,
  FormField,
  FormInput,
  Icon,
  PrimaryButton,
  SectionCard,
  VerificationTrustBadge,
} from "@/src/components/ui";
import {
  PhotoGalleryPicker,
  moveGalleryPhoto,
  type GalleryPhoto,
} from "@/src/components/photo-picker";
import { useToast } from "@/src/components/toast";
import { CATEGORIES, EDUCATION_LEVELS, EXPERIENCE_LABELS } from "@/src/constants";
import {
  getProfile,
  saveProfile,
  uploadProfilePhoto,
} from "@/src/features/profile/services/profile-service";
import { useLocation } from "@/src/hooks/use-location";
import { useImagePicker } from "@/src/hooks/use-image-picker";
import { ApiError, mediaUrl } from "@/src/services/http-client";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const pickImage = useImagePicker();
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  const [name, setName] = useState(user?.name ?? "");
  const [employerType, setEmployerType] = useState("pribadi");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [experience, setExperience] = useState(EXPERIENCE_LABELS[1]);
  const [availability, setAvailability] = useState("");
  const [rate, setRate] = useState("");
  const [phone, setPhone] = useState("");
  const [allowDirectCall, setAllowDirectCall] = useState(false);
  const [lastEducation, setLastEducation] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [educationOpen, setEducationOpen] = useState(false);
  const educationOptions = lastEducation && !EDUCATION_LEVELS.includes(lastEducation)
    ? [lastEducation, ...EDUCATION_LEVELS]
    : EDUCATION_LEVELS;

  useEffect(() => {
    if (existing) {
      setName(existing.name ?? name);
      setEmployerType(existing.employer_type ?? "pribadi");
      setCategory(existing.category ?? CATEGORIES[0]);
      setExperience(existing.experience_label ?? EXPERIENCE_LABELS[1]);
      setAvailability(existing.availability ?? "");
      setRate(existing.rate ?? "");
      setPhone(existing.phone ?? "");
      setAllowDirectCall(Boolean(existing.allow_direct_call));
      setLastEducation(existing.last_education ?? "");
      setBio(existing.bio ?? "");
      const urls = Array.isArray(existing.photo_urls) && existing.photo_urls.length
        ? existing.photo_urls
        : existing.photo_url
          ? [existing.photo_url]
          : [];
      setPhotos(urls.slice(0, 5).map((url: string, index: number) => ({
        id: `existing-${index}-${url}`,
        uri: mediaUrl(url),
        remoteUrl: url,
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  async function pickPhoto() {
    const uri = await pickImage({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      permissionMessage: "Akses foto dibutuhkan untuk unggah",
    });
    if (!uri) return;
    try {
      setUploading(true);
      const url = await uploadProfilePhoto(uri);
      setPhotos((current) => [
        ...current,
        { id: `photo-${Date.now()}-${current.length}`, uri: mediaUrl(url), remoteUrl: url },
      ].slice(0, 5));
      toast("Foto terunggah 📸", "success");
    } catch (error) {
      toast(error instanceof ApiError && error.status === 413
        ? "Foto terlalu besar. Coba pilih ulang atau potong fotonya."
        : "Gagal mengunggah foto. Coba pilih fotonya lagi.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function done() {
    const wasEditing = Boolean(user?.has_profile);
    await refreshUser();
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["profile-history"] });
    queryClient.invalidateQueries({ queryKey: ["browse-access"] });
    if (wasEditing && router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: async () => {
      toast("Data diri tersimpan! 🎉", "success");
      await done();
    },
    onError: () => toast("Gagal menyimpan data diri", "error"),
  });

  function submit() {
    if (!name.trim()) {
      toast("Isi nama kamu dulu ya", "error");
      return;
    }
    if (photos.length === 0) {
      toast("Tambahkan foto utama dulu ya", "error");
      return;
    }
    if (allowDirectCall && !phone.trim()) {
      toast("Isi nomor telepon dulu untuk izinkan telepon langsung", "error");
      return;
    }
    const photoUrls = photos.map((photo) => photo.remoteUrl || photo.uri);
    mutation.mutate({
      name: name.trim(),
      employer_type: employerType,
      category,
      experience_label: experience,
      availability: availability.trim(),
      rate: rate.trim(),
      phone: phone.trim(),
      allow_direct_call: Boolean(phone.trim()) && allowDirectCall,
      last_education: lastEducation.trim(),
      bio: bio.trim(),
      photo_url: photoUrls[0],
      photo_urls: photoUrls,
      latitude: location.coords?.latitude,
      longitude: location.coords?.longitude,
    });
  }

  function skip() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="onboarding-screen">
      <View style={styles.header}>
        <BrandHeader onSkip={skip} />
        <Text style={styles.title}>Buat Data Diri</Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.form}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard icon="account" title="Info Diri">
          {user?.verification_status === "approved" ? (
            <View style={styles.verificationRow}>
              <VerificationTrustBadge label="Identitas Terverifikasi ✓" />
            </View>
          ) : null}
          <FormField label="Foto">
            <PhotoGalleryPicker
              photos={photos}
              onAdd={pickPhoto}
              onRemove={(index) => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              onMove={(from, to) => setPhotos((current) => moveGalleryPhoto(current, from, to))}
              uploading={uploading}
              mainRequired
              testID="worker-photo-gallery"
            />
          </FormField>

          <FormField label="Nama">
            <FormInput
              value={name}
              onChangeText={setName}
              placeholder="Nama lengkapmu"
              placeholderTextColor={colors.muted}
              testID="ob-name"
            />
          </FormField>
          <FormField label="Nomor Telepon (opsional)">
            <FormInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+62 812 3456 7890"
              keyboardType="phone-pad"
              placeholderTextColor={colors.muted}
              testID="ob-phone"
            />
            <View style={styles.directCallRow}>
              <View style={styles.directCallCopy}>
                <Text style={styles.directCallTitle}>Izinkan Telepon Langsung</Text>
                <Text style={styles.directCallHelper}>
                  {allowDirectCall && phone.trim()
                    ? "Pemberi kerja yang cocok bisa meneleponmu."
                    : "Nomormu tetap tersembunyi dari tombol telepon."}
                </Text>
              </View>
              <Switch
                value={Boolean(phone.trim()) && allowDirectCall}
                onValueChange={setAllowDirectCall}
                disabled={!phone.trim()}
                trackColor={{ false: colors.border, true: colors.brandPrimary }}
                thumbColor={colors.surface}
                testID="ob-allow-direct-call"
              />
            </View>
          </FormField>
          <FormField label="Pendidikan Terakhir (opsional)">
            <CompactSelect
              value={lastEducation || "Tidak dicantumkan"}
              onPress={() => setEducationOpen(true)}
              testID="ob-last-education"
            />
          </FormField>
          <FormField label="Bio Singkat" last>
            <FormInput
              value={bio}
              onChangeText={setBio}
              placeholder="Ceritakan keahlian dan kelebihanmu…"
              placeholderTextColor={colors.muted}
              multiline
              testID="ob-bio"
            />
          </FormField>
        </SectionCard>

        <SectionCard icon="briefcase" title="Data Kerja">
          <FormField label="Kategori Keahlian">
            <CategorySelectField
              value={category}
              onPress={() => setCategoryOpen(true)}
              testID="ob-category"
            />
          </FormField>

          <FormField label="Pengalaman">
            <CompactSelect
              value={experience}
              onPress={() => setExperienceOpen(true)}
              testID="ob-experience"
            />
          </FormField>

          <FormField label="Ketersediaan">
            <FormInput
              value={availability}
              onChangeText={setAvailability}
              placeholder="Contoh: Senin–Jumat, full-time"
              placeholderTextColor={colors.muted}
              testID="ob-availability"
            />
          </FormField>

          <FormField label="Tarif (opsional)" last>
            <FormInput
              value={rate}
              onChangeText={setRate}
              placeholder="Contoh: Rp120.000/hari"
              placeholderTextColor={colors.muted}
              testID="ob-rate"
            />
          </FormField>
        </SectionCard>

        <PrimaryButton
          label="Simpan Data Diri"
          icon="check"
          loading={mutation.isPending}
          onPress={submit}
          testID="save-profile"
          style={{ marginTop: spacing.sm }}
        />
      </KeyboardAwareScrollView>

      <CategorySelector
        visible={categoryOpen}
        selected={category}
        onSelect={setCategory}
        onClose={() => setCategoryOpen(false)}
        testID="profile-category-selector"
      />

      <BottomSheet
        visible={experienceOpen}
        onClose={() => setExperienceOpen(false)}
        title="Pilih Pengalaman"
        testID="experience-sheet"
      >
        <View style={styles.optionList}>
          {EXPERIENCE_LABELS.map((option) => {
            const active = experience === option;
            return (
              <Pressable
                key={option}
                style={({ pressed }) => [
                  styles.optionRow,
                  active && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setExperience(option);
                  setExperienceOpen(false);
                }}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
                {active ? <Icon name="check" size={20} color={colors.brandPrimary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={educationOpen}
        onClose={() => setEducationOpen(false)}
        title="Pilih Pendidikan Terakhir"
        testID="education-sheet"
      >
        <ScrollView
          style={styles.educationScroll}
          contentContainerStyle={styles.optionList}
          showsVerticalScrollIndicator={false}
        >
          {["Tidak dicantumkan", ...educationOptions].map((option) => {
            const value = option === "Tidak dicantumkan" ? "" : option;
            const active = lastEducation === value;
            return (
              <Pressable
                key={option}
                style={({ pressed }) => [
                  styles.optionRow,
                  active && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setLastEducation(value);
                  setEducationOpen(false);
                }}
                testID={`education-option-${option}`}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
                {active ? <Icon name="check" size={20} color={colors.brandPrimary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function BrandHeader({ onBack, onSkip }: { onBack?: () => void; onSkip?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.topBar}>
      <BrandLockup compact />
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} testID="back-role-selection">
          <Text style={styles.skip}>Ganti pilihan</Text>
        </Pressable>
      ) : onSkip ? (
        <Pressable onPress={onSkip} hitSlop={10} testID="skip-onboarding">
          <Text style={styles.skip}>Kembali</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceTertiary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skip: { fontFamily: fonts.bold, fontSize: 14, color: colors.brandPrimary },
  title: {
    fontFamily: fonts.bold,
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.onSurface,
    marginTop: spacing.lg,
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  verificationRow: { marginBottom: spacing.md },
  educationScroll: { maxHeight: 420 },
  directCallRow: {
    minHeight: 52,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  directCallCopy: { flex: 1, paddingVertical: spacing.sm },
  directCallTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  directCallHelper: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 2,
  },
  optionList: { gap: spacing.xs, paddingBottom: spacing.sm },
  optionRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  optionRowActive: { backgroundColor: colors.surfaceTertiary },
  optionText: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface },
  optionTextActive: { fontFamily: fonts.semibold, color: colors.brandPrimary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
}));
