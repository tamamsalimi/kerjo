import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Icon } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type GalleryPhoto = {
  id: string;
  uri: string;
  remoteUrl?: string;
};

export function PhotoGalleryPicker({
  photos,
  onAdd,
  onRemove,
  onMove,
  uploading = false,
  mainRequired = false,
  max = 5,
  testID,
}: {
  photos: GalleryPhoto[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  uploading?: boolean;
  mainRequired?: boolean;
  max?: number;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {photos.map((photo, index) => (
          <View key={photo.id} style={styles.slot}>
            <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" transition={120} />
            {index === 0 ? (
              <View style={styles.mainBadge}>
                <Text style={styles.mainBadgeText}>Utama</Text>
              </View>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
              onPress={() => onRemove(index)}
              hitSlop={6}
              testID={`photo-remove-${index}`}
            >
              <Icon name="close" size={15} color={colors.onSurface} />
            </Pressable>
            {photos.length > 1 ? (
              <View style={styles.reorder}>
                <Pressable
                  disabled={index === 0}
                  onPress={() => onMove(index, index - 1)}
                  style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                  testID={`photo-left-${index}`}
                >
                  <Icon name="chevron-left" size={17} color={index === 0 ? colors.borderStrong : colors.onSurface} />
                </Pressable>
                <Pressable
                  disabled={index === photos.length - 1}
                  onPress={() => onMove(index, index + 1)}
                  style={[styles.moveButton, index === photos.length - 1 && styles.moveButtonDisabled]}
                  testID={`photo-right-${index}`}
                >
                  <Icon
                    name="chevron-right"
                    size={17}
                    color={index === photos.length - 1 ? colors.borderStrong : colors.onSurface}
                  />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
        {photos.length < max ? (
          <Pressable
            style={({ pressed }) => [styles.addSlot, pressed && styles.pressed]}
            onPress={onAdd}
            disabled={uploading}
            testID="photo-add"
          >
            <Icon name={uploading ? "progress-clock" : "plus"} size={27} color={colors.brandPrimary} />
            <Text style={styles.addText}>
              {uploading ? "Mengunggah" : photos.length === 0 && mainRequired ? "Foto utama" : "Tambah"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Text style={styles.helper}>
        {mainRequired ? "Foto pertama wajib dan menjadi foto utama." : "Maksimal 5 foto."}
      </Text>
    </View>
  );
}

export function moveGalleryPhoto(photos: GalleryPhoto[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return photos;
  const next = [...photos];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const useStyles = makeStyles((colors) => ({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  slot: {
    width: 100,
    height: 116,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
  },
  image: { width: "100%", height: "100%" },
  mainBadge: {
    position: "absolute",
    left: 6,
    top: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  mainBadgeText: { fontFamily: fonts.semibold, fontSize: 9, color: colors.onBrandPrimary },
  remove: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  reorder: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  moveButton: {
    width: 27,
    height: 27,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  moveButtonDisabled: { opacity: 0.45 },
  addSlot: {
    width: 100,
    height: 116,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surface,
  },
  addText: { fontFamily: fonts.medium, fontSize: 11, color: colors.onSurfaceTertiary },
  helper: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
}));
