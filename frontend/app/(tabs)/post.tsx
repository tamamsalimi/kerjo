import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, Icon, PrimaryButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { CATEGORIES, EXPERIENCE_LABELS, JOB_TYPES, categoryIcon } from "@/src/constants";
import { createJob } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const PAY_UNITS = ["/jam", "/hari", "/minggu", "/bulan", "/proyek", "/acara"];

export default function PostJob() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const queryClient = useQueryClient();

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

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["browse"] });
      toast("Lowongan berhasil dipasang! 🎉", "success");
      setBusiness("");
      setTitle("");
      setPayAmount("");
      setDescription("");
      setPhone("");
      setWorkers(1);
      setQuestions([""]);
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
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="post-screen">
      <Text style={styles.title}>Pasang Lowongan</Text>
      <Text style={styles.subtitle}>Isi detail pekerjaan, langsung tampil di swipe</Text>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.form}
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
      >
        <Field label="Nama Usaha / Keluarga">
          <TextInput
            style={styles.input}
            value={business}
            onChangeText={setBusiness}
            placeholder="cth. Warung Bu Yanti"
            placeholderTextColor={colors.muted}
            testID="input-business"
          />
        </Field>

        <Field label="Posisi / Pekerjaan">
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="cth. Bantu Masak & Bersih-bersih"
            placeholderTextColor={colors.muted}
            testID="input-title"
          />
        </Field>

        <Field label="Kategori">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} icon={categoryIcon(c)} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>
        </Field>

        <View style={styles.rowFields}>
          <Field label="Bayaran (Rp)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder="120000"
              keyboardType="number-pad"
              placeholderTextColor={colors.muted}
              testID="input-pay"
            />
          </Field>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {PAY_UNITS.map((u) => (
            <Chip key={u} label={u} active={payUnit === u} onPress={() => setPayUnit(u)} />
          ))}
        </ScrollView>

        <Field label="Tipe Kerja">
          <View style={styles.wrapChips}>
            {JOB_TYPES.map((t) => (
              <Chip key={t} label={t} active={jobType === t} onPress={() => setJobType(t)} />
            ))}
          </View>
        </Field>

        <Field label="Pengalaman Minimal">
          <View style={styles.wrapChips}>
            {EXPERIENCE_LABELS.map((e) => (
              <Chip key={e} label={e} active={experience === e} onPress={() => setExperience(e)} />
            ))}
          </View>
        </Field>

        <Field label="Deskripsi">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Jelaskan tugas dan harapanmu…"
            placeholderTextColor={colors.muted}
            multiline
            testID="input-description"
          />
        </Field>

        <Field label="Nomor Telepon (untuk panggilan)">
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="cth. 0812xxxxxxx"
            keyboardType="phone-pad"
            placeholderTextColor={colors.muted}
            testID="input-phone"
          />
        </Field>

        <Field label="Jumlah Orang Dibutuhkan">
          <View style={styles.stepper}>
            <Pressable
              style={[styles.stepBtn, workers <= 1 && styles.stepBtnDisabled]}
              disabled={workers <= 1}
              onPress={() => setWorkers((w) => Math.max(1, w - 1))}
              testID="workers-minus"
            >
              <Icon name="minus" size={20} color={workers <= 1 ? colors.muted : colors.brandPrimary} />
            </Pressable>
            <Text style={styles.stepValue} testID="workers-value">{workers}</Text>
            <Pressable
              style={[styles.stepBtn, workers >= 20 && styles.stepBtnDisabled]}
              disabled={workers >= 20}
              onPress={() => setWorkers((w) => Math.min(20, w + 1))}
              testID="workers-plus"
            >
              <Icon name="plus" size={20} color={workers >= 20 ? colors.muted : colors.brandPrimary} />
            </Pressable>
            <Text style={styles.stepHint}>
              {workers > 1 ? `Lowongan tetap terbuka sampai ${workers} pekerja cocok` : "Butuh 1 pekerja"}
            </Text>
          </View>
        </Field>

        <Field label="Pertanyaan Screening (opsional)">
          <Text style={styles.helper}>Pelamar akan menjawab ini saat melamar. Maks 3.</Text>
          {questions.map((q, i) => (
            <View key={i} style={styles.qRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={q}
                onChangeText={(t) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? t : x)))}
                placeholder={`Pertanyaan ${i + 1}`}
                placeholderTextColor={colors.muted}
                testID={`input-question-${i}`}
              />
              {questions.length > 1 ? (
                <Pressable
                  style={styles.qRemove}
                  onPress={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                  testID={`remove-question-${i}`}
                >
                  <Icon name="close" size={20} color={colors.error} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {questions.length < 3 ? (
            <Pressable
              style={styles.addQ}
              onPress={() => setQuestions((prev) => [...prev, ""])}
              testID="add-question"
            >
              <Icon name="plus" size={18} color={colors.brandPrimary} />
              <Text style={styles.addQText}>Tambah pertanyaan</Text>
            </Pressable>
          ) : null}
        </Field>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: spacing.md }}>
        <View style={[styles.footer, { paddingBottom: bottomChrome + spacing.md }]}>
          <PrimaryButton
            label="Pasang Lowongan"
            icon="send"
            loading={mutation.isPending}
            onPress={submit}
            testID="submit-job"
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  const styles = useStyles();
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
  form: { paddingTop: spacing.sm, paddingBottom: spacing.xl },
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
  textarea: { minHeight: 96, textAlignVertical: "top", paddingTop: spacing.md },
  rowFields: { flexDirection: "row", gap: spacing.md },
  chipScroll: { gap: spacing.sm, paddingBottom: spacing.md },
  wrapChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  helper: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  qRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  qRemove: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
  },
  addQ: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.xs },
  addQText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brandPrimary },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepBtn: {
    width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.5 },
  stepValue: { fontFamily: fonts.medium, fontSize: 20, color: colors.onSurface, minWidth: 28, textAlign: "center" },
  stepHint: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
}));
