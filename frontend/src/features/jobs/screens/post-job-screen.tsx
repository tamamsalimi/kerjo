import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { CategorySelectField, CategorySelector } from "@/src/components/category-selector";
import {
  BrandLockup,
  CompactSelect,
  FormField,
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
import { useAuth } from "@/src/features/auth/auth-context";
import { CATEGORIES, EXPERIENCE_LABELS, JOB_TYPES, categoryIcon } from "@/src/constants";
import { createJob, uploadJobPhoto } from "@/src/features/jobs/services/jobs-service";
import { useImagePicker } from "@/src/hooks/use-image-picker";
import { useLocation } from "@/src/hooks/use-location";
import { usesNativeTabs } from "@/src/utils/navigation";
import { setRecentJob } from "@/src/features/jobs/recent-job";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const PAY_UNITS = ["/jam", "/hari", "/minggu", "/bulan", "/proyek", "/acara"];
type SelectKind = "pay" | "jobType" | "experience";

export default function PostJob() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const pickImage = useImagePicker();
  const queryClient = useQueryClient();
  const router = useRouter();
  const location = useLocation();
  const { user } = useAuth();

  const [business, setBusiness] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [payAmount, setPayAmount] = useState("");
  const [payUnit, setPayUnit] = useState(PAY_UNITS[1]);
  const [jobType, setJobType] = useState(JOB_TYPES[0]);
  const [experience, setExperience] = useState(EXPERIENCE_LABELS[0]);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [workers, setWorkers] = useState(1);
  const [questions, setQuestions] = useState<string[]>([""]);
  const [selectOpen, setSelectOpen] = useState<SelectKind | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [workplacePhotos, setWorkplacePhotos] = useState<GalleryPhoto[]>([]);

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const parsedPay = parseInt(payAmount.replace(/\D/g, ""), 10) || 0;
  const payUnitLabel = payUnit.replace("/", "per ");
  const paySummary = parsedPay
    ? `Rp${parsedPay.toLocaleString("id-ID")}${payUnit}`
    : "Bayaran belum diisi";
  const selector = useMemo(() => {
    if (selectOpen === "pay") {
      return { title: "Pilih periode bayaran", options: PAY_UNITS, selected: payUnit };
    }
    if (selectOpen === "jobType") {
      return { title: "Pilih tipe kerja", options: JOB_TYPES, selected: jobType };
    }
    return { title: "Pilih pengalaman", options: EXPERIENCE_LABELS, selected: experience };
  }, [experience, jobType, payUnit, selectOpen]);

  function chooseOption(value: string) {
    if (selectOpen === "pay") setPayUnit(value);
    if (selectOpen === "jobType") setJobType(value);
    if (selectOpen === "experience") setExperience(value);
    setSelectOpen(null);
  }

  function updatePay(value: string) {
    const digits = value.replace(/\D/g, "");
    setPayAmount(digits ? Number(digits).toLocaleString("id-ID") : "");
  }

  async function pickWorkplacePhoto() {
    const uri = await pickImage({
      quality: 0.7,
      permissionMessage: "Akses foto dibutuhkan untuk memilih foto",
    });
    if (!uri) return;
    setWorkplacePhotos((current) => [
      ...current,
      { id: `workplace-${Date.now()}-${current.length}`, uri },
    ].slice(0, 5));
  }

  const mutation = useMutation({
    mutationFn: async (input: any) => {
      let job = await createJob(input);
      let failedUploads = 0;
      for (const photo of workplacePhotos) {
        try {
          const uploaded = await uploadJobPhoto(job.id, photo.uri);
          job = uploaded.job;
        } catch {
          failedUploads += 1;
        }
      }
      return { job, failedUploads };
    },
    onSuccess: ({ job, failedUploads }) => {
      setRecentJob(job);
      queryClient.invalidateQueries({ queryKey: ["browse"] });
      toast(
        failedUploads > 0
          ? `Lowongan tersimpan, ${failedUploads} foto gagal diunggah`
          : "Lowongan berhasil dipasang! 🎉",
        failedUploads > 0 ? "info" : "success",
      );
      setBusiness("");
      setTitle("");
      setPayAmount("");
      setDescription("");
      setPhone("");
      setWorkers(1);
      setQuestions([""]);
      setWorkplacePhotos([]);
      router.replace("/(tabs)");
    },
    onError: () => toast("Gagal memasang lowongan", "error"),
  });

  function submit() {
    if (!business.trim() || !title.trim() || !payAmount.trim()) {
      toast("Lengkapi nama, posisi, dan bayaran", "error");
      return;
    }
    mutation.mutate({
      business: business.trim(),
      title: title.trim(),
      category,
      pay_amount: parseInt(payAmount.replace(/\D/g, ""), 10) || 0,
      pay_unit: payUnit,
      distance_km: 2.0,
      job_type: jobType,
      min_experience_label: experience,
      description: description.trim(),
      phone: phone.trim(),
      workers_needed: workers,
      screening_questions: questions.map((q) => q.trim()).filter(Boolean),
      latitude: location.coords?.latitude,
      longitude: location.coords?.longitude,
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="post-screen">
      <View style={styles.header}>
        <View style={styles.topBar}>
          <BrandLockup compact />
          <Pressable
            onPress={() => router.replace("/(tabs)")}
            hitSlop={10}
            testID="close-post-job"
          >
            <Text style={styles.headerAction}>Kembali</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Pasang Lowongan</Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.form}
        bottomOffset={110}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard icon="briefcase" title="Info Utama">
          {user?.verification_status === "approved" ? (
            <View style={styles.verificationRow}>
              <VerificationTrustBadge label="Tempat Kerja Terverifikasi ✓" />
            </View>
          ) : null}
          <FormField label="Foto Tempat Kerja">
            <PhotoGalleryPicker
              photos={workplacePhotos}
              onAdd={pickWorkplacePhoto}
              onRemove={(index) => setWorkplacePhotos((current) => (
                current.filter((_, itemIndex) => itemIndex !== index)
              ))}
              onMove={(from, to) => setWorkplacePhotos((current) => moveGalleryPhoto(current, from, to))}
              testID="workplace-photo-gallery"
            />
          </FormField>
          <FormField label="Nama Usaha / Keluarga">
            <TextInput
              style={[styles.input, focusedField === "business" && styles.inputFocused]}
              value={business}
              onChangeText={setBusiness}
              onFocus={() => setFocusedField("business")}
              onBlur={() => setFocusedField(null)}
              placeholder="Warung Bu Yanti"
              placeholderTextColor={colors.muted}
              testID="input-business"
            />
          </FormField>
          <FormField label="Posisi / Pekerjaan">
            <TextInput
              style={[styles.input, focusedField === "title" && styles.inputFocused]}
              value={title}
              onChangeText={setTitle}
              onFocus={() => setFocusedField("title")}
              onBlur={() => setFocusedField(null)}
              placeholder="Bantu Masak & Bersih-bersih"
              placeholderTextColor={colors.muted}
              testID="input-title"
            />
          </FormField>
          <FormField label="Kategori" last>
            <CategorySelectField
              value={category}
              onPress={() => setCategoryOpen(true)}
              testID="select-category"
            />
          </FormField>
        </SectionCard>

        <SectionCard icon="tune-variant" title="Detail Kerja">
          <FormField label="Bayaran">
            <View style={[styles.paymentControl, focusedField === "pay" && styles.inputFocused]}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                style={styles.paymentInput}
                value={payAmount}
                onChangeText={updatePay}
                onFocus={() => setFocusedField("pay")}
                onBlur={() => setFocusedField(null)}
                placeholder="120.000"
                keyboardType="number-pad"
                placeholderTextColor={colors.muted}
                testID="input-pay"
              />
              <View style={styles.paymentDivider} />
              <Pressable style={styles.periodButton} onPress={() => setSelectOpen("pay")} testID="select-pay-unit">
                <Text style={styles.periodText}>{payUnitLabel}</Text>
                <Icon name="chevron-down" size={19} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.helper}>{parsedPay ? `${paySummary.replace("/", " per ")}` : "Masukkan bayaran yang mudah dipahami."}</Text>
          </FormField>

          <FormField label="Tipe Kerja">
            <CompactSelect
              value={jobType}
              onPress={() => setSelectOpen("jobType")}
              testID="select-job-type"
            />
          </FormField>

          <FormField label="Pengalaman">
            <CompactSelect
              value={experience}
              onPress={() => setSelectOpen("experience")}
              testID="select-experience"
            />
            {experience === "Tidak wajib" ? (
              <Text style={styles.helper}>Pengalaman tidak wajib untuk pekerjaan ini.</Text>
            ) : null}
          </FormField>

          <FormField label="Jumlah Orang Dibutuhkan">
            <View style={styles.stepper}>
              <Pressable
                style={({ pressed }) => [
                  styles.stepBtn,
                  workers <= 1 && styles.stepBtnDisabled,
                  pressed && styles.pressed,
                ]}
                disabled={workers <= 1}
                onPress={() => setWorkers((w) => Math.max(1, w - 1))}
                testID="workers-minus"
              >
                <Icon name="minus" size={20} color={workers <= 1 ? colors.muted : colors.brandPrimary} />
              </Pressable>
              <Text style={styles.stepValue} testID="workers-value">{workers}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.stepBtn,
                  workers >= 20 && styles.stepBtnDisabled,
                  pressed && styles.pressed,
                ]}
                disabled={workers >= 20}
                onPress={() => setWorkers((w) => Math.min(20, w + 1))}
                testID="workers-plus"
              >
                <Icon name="plus" size={20} color={workers >= 20 ? colors.muted : colors.brandPrimary} />
              </Pressable>
              <Text style={styles.stepHint}>
                {workers > 1 ? `Terbuka sampai ${workers} pekerja cocok` : "Butuh 1 pekerja"}
              </Text>
            </View>
          </FormField>
          <FormField label="Deskripsi Pekerjaan">
            <TextInput
              style={[
                styles.input,
                styles.textarea,
                focusedField === "description" && styles.inputFocused,
              ]}
              value={description}
              onChangeText={setDescription}
              onFocus={() => setFocusedField("description")}
              onBlur={() => setFocusedField(null)}
              placeholder={"Ceritakan sedikit tentang tugasnya,\njam kerja, dan hal yang perlu diketahui..."}
              placeholderTextColor={colors.muted}
              multiline
              testID="input-description"
            />
            <Text style={styles.example}>
              Contoh: Bantu memasak dan membersihkan dapur dari jam 08.00–14.00.
            </Text>
          </FormField>

          <FormField label="Pertanyaan untuk Pelamar (opsional)">
            <Text style={styles.helper}>Pelamar akan menjawab saat melamar. Maksimal 3 pertanyaan.</Text>
            {questions.map((q, i) => (
              <View key={i} style={styles.qRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.questionInput,
                    focusedField === `question-${i}` && styles.inputFocused,
                  ]}
                  value={q}
                  onChangeText={(text) => setQuestions((prev) => prev.map((item, index) => (
                    index === i ? text : item
                  )))}
                  onFocus={() => setFocusedField(`question-${i}`)}
                  onBlur={() => setFocusedField(null)}
                  placeholder={`Pertanyaan ${i + 1}`}
                  placeholderTextColor={colors.muted}
                  testID={`input-question-${i}`}
                />
                {questions.length > 1 ? (
                  <Pressable
                    style={({ pressed }) => [styles.qRemove, pressed && styles.pressed]}
                    onPress={() => setQuestions((prev) => prev.filter((_, index) => index !== i))}
                    testID={`remove-question-${i}`}
                  >
                    <Icon name="close" size={20} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {questions.length < 3 ? (
              <Pressable
                style={({ pressed }) => [styles.addQ, pressed && styles.pressed]}
                onPress={() => setQuestions((prev) => [...prev, ""])}
                testID="add-question"
              >
                <Icon name="plus-circle-outline" size={19} color={colors.brandPrimary} />
                <Text style={styles.addQText}>Tambah pertanyaan</Text>
              </Pressable>
            ) : null}
          </FormField>
          <FormField label="Nomor Telepon" last>
            <View style={[styles.phoneControl, focusedField === "phone" && styles.inputFocused]}>
              <Icon name="phone-outline" size={20} color={colors.brandPrimary} />
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
                placeholder="+62 812 3456 7890"
                keyboardType="phone-pad"
                placeholderTextColor={colors.muted}
                testID="input-phone"
              />
            </View>
            <Text style={styles.helper}>
              Nomor ini digunakan untuk menghubungi kamu setelah ada yang cocok.
            </Text>
          </FormField>
        </SectionCard>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIcon}>
              <Icon name="eye-outline" size={20} color={colors.brandPrimary} />
            </View>
            <View>
              <Text style={styles.summaryEyebrow}>PRATINJAU</Text>
              <Text style={styles.summaryHeading}>Ringkasan Lowongan</Text>
            </View>
          </View>
          <Text style={styles.summaryTitle}>{title.trim() || "Posisi pekerjaanmu"}</Text>
          <Text style={styles.summaryBusiness}>{business.trim() || "Nama usaha / keluarga"}</Text>
          <View style={styles.summaryMeta}>
            <View style={styles.summaryLine}>
              <Icon name="briefcase-outline" size={17} color={colors.brandPrimary} />
              <Text style={styles.summaryText}>{jobType} · {paySummary}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Icon name={categoryIcon(category)} size={17} color={colors.brandPrimary} />
              <Text style={styles.summaryText}>{category} · {experience}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Icon name="map-marker-radius-outline" size={17} color={colors.brandPrimary} />
              <Text style={styles.summaryText}>Akan langsung tampil di swipe</Text>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: spacing.md }}>
        <View style={[styles.footer, { paddingBottom: bottomChrome + spacing.md }]}>
          <PrimaryButton
            label="Pasang Lowongan"
            icon="send"
            loading={mutation.isPending}
            onPress={submit}
            testID="submit-job"
            style={styles.submitButton}
          />
          <Text style={styles.footerHint}>Lowongan akan langsung muncul di swipe.</Text>
        </View>
      </KeyboardStickyView>

      <CategorySelector
        visible={categoryOpen}
        selected={category}
        onSelect={setCategory}
        onClose={() => setCategoryOpen(false)}
        testID="post-category-selector"
      />

      <BottomSheet
        visible={Boolean(selectOpen)}
        onClose={() => setSelectOpen(null)}
        title={selector.title}
        testID="job-option-sheet"
      >
        <View style={styles.optionList}>
          {selector.options.map((option) => {
            const active = selector.selected === option;
            return (
              <Pressable
                key={option}
                style={({ pressed }) => [
                  styles.optionRow,
                  active && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => chooseOption(option)}
                testID={`option-${option}`}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {selectOpen === "pay" ? option.replace("/", "per ") : option}
                </Text>
                {active ? <Icon name="check" size={20} color={colors.brandPrimary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceTertiary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerAction: { fontFamily: fonts.bold, fontSize: 14, color: colors.brandPrimary },
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
  input: {
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
  },
  inputFocused: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.surface,
  },
  paymentControl: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceTertiary,
    backgroundColor: colors.surfaceTertiary,
    paddingLeft: spacing.md,
    overflow: "hidden",
  },
  currencyPrefix: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.onSurfaceTertiary,
    marginRight: spacing.xs,
  },
  paymentInput: {
    flex: 1,
    minWidth: 76,
    paddingVertical: spacing.md,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onSurface,
  },
  paymentDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  periodButton: {
    minWidth: 116,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  periodText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.onSurfaceTertiary,
  },
  helper: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  textarea: {
    minHeight: 128,
    textAlignVertical: "top",
    paddingTop: spacing.md,
  },
  example: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  qRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  questionInput: { flex: 1 },
  qRemove: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  addQ: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  addQText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.brandPrimary,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.5 },
  stepValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.onSurface,
    minWidth: 26,
    textAlign: "center",
  },
  stepHint: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  phoneControl: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceTertiary,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.onSurface,
  },
  summaryCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  summaryEyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.brandPrimary,
  },
  summaryHeading: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.onSurface,
  },
  summaryTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: colors.onSurface,
  },
  summaryBusiness: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 1,
    marginBottom: spacing.md,
  },
  summaryMeta: { gap: spacing.sm },
  summaryLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceTertiary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButton: { height: 58 },
  footerHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 5,
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
  optionText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.onSurface,
  },
  optionTextActive: {
    fontFamily: fonts.semibold,
    color: colors.brandPrimary,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
}));
