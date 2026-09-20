import { Pressable, ScrollView, Text, View } from "react-native";

import { CATEGORIES, categoryIcon } from "@/src/constants";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { Chip, Icon } from "@/src/components/ui";

export function CategorySelectField({
  value,
  onPress,
  testID,
}: {
  value: string;
  onPress: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.triggerValue}>
        <View style={styles.triggerIcon}>
          <Icon name={categoryIcon(value)} size={22} color={colors.brandPrimary} />
        </View>
        <Text style={styles.triggerText}>{value}</Text>
      </View>
      <Icon name="chevron-right" size={21} color={colors.muted} />
    </Pressable>
  );
}

export function CategorySelector({
  visible,
  selected,
  onSelect,
  onClose,
  includeAll = false,
  testID = "category-sheet",
}: {
  visible: boolean;
  selected: string;
  onSelect: (category: string) => void;
  onClose: () => void;
  includeAll?: boolean;
  testID?: string;
}) {
  const styles = useStyles();

  function choose(category: string) {
    onSelect(category);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pilih Kategori" testID={testID}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        {includeAll ? (
          <Chip
            label="Semua"
            active={selected === "Semua"}
            onPress={() => choose("Semua")}
            testID="category-option-semua"
          />
        ) : null}
        {CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={category}
            icon={categoryIcon(category)}
            active={selected === category}
            onPress={() => choose(category)}
            testID={`category-option-${category}`}
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeStyles((colors) => ({
  scroll: { flexShrink: 1 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  trigger: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  triggerValue: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  triggerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTertiary,
  },
  triggerText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
}));
