import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { Icon, PrimaryButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { categoryIcon } from "@/src/constants";
import { completeJob, fetchMatch, fetchMessages, sendMessage, submitReview } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);

  const [text, setText] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: match } = useQuery({ queryKey: ["match", id], queryFn: () => fetchMatch(id!) });
  const { data: messages } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => fetchMessages(id!),
    refetchInterval: 4000,
  });

  const sendMut = useMutation({
    mutationFn: (t: string) => sendMessage(id!, t),
    onSuccess: (msgs) => queryClient.setQueryData(["messages", id], msgs),
  });

  const reviewMut = useMutation({
    mutationFn: async () => {
      await completeJob(id!);
      return submitReview(id!, rating, comment.trim());
    },
    onSuccess: () => {
      toast("Terima kasih! Rating tersimpan ⭐", "success");
      setReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ["match", id] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: () => toast("Gagal menyimpan rating", "error"),
  });

  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages?.length]);

  function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    sendMut.mutate(t);
  }

  return (
    <View style={styles.container} testID="chat-screen">
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="chat-back">
          <Icon name="chevron-left" size={28} color={colors.onSurface} />
        </Pressable>
        {match?.entity_type === "worker" && match?.image ? (
          <Image source={{ uri: match.image }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.iconAvatar, { backgroundColor: colors.brandTertiary }]}>
            <Icon name={categoryIcon(match?.category)} size={20} color={colors.onBrandTertiary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.hName} numberOfLines={1}>{match?.title ?? "Chat"}</Text>
          <Text style={styles.hSub} numberOfLines={1}>{match?.subtitle}</Text>
        </View>
        {match?.reviewed ? (
          <View style={[styles.doneTag, { backgroundColor: colors.success }]}>
            <Icon name="check" size={14} color={colors.onSuccess} />
            <Text style={styles.doneTagText}>Selesai</Text>
          </View>
        ) : (
          <Pressable style={[styles.doneBtn, { backgroundColor: colors.brandPrimary }]} onPress={() => setReviewOpen(true)} testID="mark-done-button">
            <Icon name="flag-checkered" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.doneBtnText}>Selesai</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={insets.top + 60}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const mine = item.sender === "user";
            return (
              <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowOther]}>
                <View style={[styles.bubble, mine ? { backgroundColor: colors.brandPrimary } : { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={[styles.bubbleText, { color: mine ? colors.onBrandPrimary : colors.onSurface }]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Tulis pesan…"
            placeholderTextColor={colors.muted}
            multiline
            testID="chat-input"
          />
          <Pressable style={[styles.sendBtn, { backgroundColor: colors.brandPrimary }]} onPress={send} testID="chat-send">
            <Icon name="send" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Review sheet */}
      <BottomSheet visible={reviewOpen} onClose={() => setReviewOpen(false)} title="Tandai Selesai & Beri Rating" testID="review-sheet">
        <Text style={styles.reviewLabel}>Seberapa puas dengan kerjasama ini?</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable key={i} onPress={() => setRating(i)} hitSlop={6} testID={`star-${i}`}>
              <Icon name={i <= rating ? "star" : "star-outline"} size={40} color={colors.warning} />
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.reviewInput]}
          value={comment}
          onChangeText={setComment}
          placeholder="Tulis ulasan singkat (opsional)…"
          placeholderTextColor={colors.muted}
          multiline
          testID="review-comment"
        />
        <PrimaryButton
          label="Kirim Rating"
          icon="check"
          loading={reviewMut.isPending}
          onPress={() => reviewMut.mutate()}
          testID="submit-review"
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.pill },
  iconAvatar: { alignItems: "center", justifyContent: "center" },
  hName: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  hSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.pill,
  },
  doneBtnText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onBrandPrimary },
  doneTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.pill,
  },
  doneTagText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSuccess },
  msgList: { padding: spacing.lg, gap: spacing.sm },
  bubbleRow: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  bubbleText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.onSurface,
    maxHeight: 120,
  },
  sendBtn: { width: 46, height: 46, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  reviewLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center" },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginVertical: spacing.lg },
  reviewInput: { minHeight: 80, textAlignVertical: "top", paddingTop: spacing.md },
}));
