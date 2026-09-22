import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { CATEGORY_GROUPS, categoryIcon, categoryGroupOf, type CategoryGroup } from "@/src/constants";
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

export function GroupedCategoryPicker({
  selected,
  onToggle,
  includeAll = false,
  onChooseAll,
  startInSelectedGroup = false,
}: {
  selected: string[];
  onToggle: (category: string) => void;
  includeAll?: boolean;
  onChooseAll?: () => void;
  startInSelectedGroup?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [group, setGroup] = useState<CategoryGroup | null>(() =>
    startInSelectedGroup && selected.length === 1 ? categoryGroupOf(selected[0]) ?? null : null,
  );

  if (group) {
    return (
      <View>
        <Pressable
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
          onPress={() => setGroup(null)}
          testID="category-group-back"
        >
          <Icon name="chevron-left" size={22} color={colors.brandPrimary} />
          <Text style={styles.backText}>{group.name}</Text>
        </Pressable>
        <View style={styles.grid}>
          {group.categories.map((category) => (
            <Chip
              key={category}
              label={category}
              icon={categoryIcon(category)}
              active={selected.includes(category)}
              onPress={() => onToggle(category)}
              testID={`category-option-${category}`}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.groupList}>
      {includeAll ? (
        <Chip
          label="Semua"
          active={selected.includes("Semua") || selected.length === 0}
          onPress={() => onChooseAll?.()}
          testID="category-option-semua"
        />
      ) : null}
      {CATEGORY_GROUPS.map((item) => {
        const selectedCount = item.categories.filter((category) => selected.includes(category)).length;
        return (
          <Pressable
            key={item.name}
            style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
            onPress={() => setGroup(item)}
            testID={`category-group-${item.name}`}
          >
            <View style={styles.triggerIcon}>
              <Icon name={item.icon} size={22} color={colors.brandPrimary} />
            </View>
            <View style={styles.groupCopy}>
              <Text style={styles.groupTitle}>{item.name}</Text>
              <Text style={styles.groupMeta}>
                {selectedCount
                  ? `${selectedCount} dipilih · ${item.categories.length} kategori`
                  : `${item.categories.length} kategori`}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        );
      })}
    </View>
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
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pilih Kategori" testID={testID}>
      {visible ? (
        <GroupedCategoryPicker
          key={visible ? selected : "closed"}
          selected={selected ? [selected] : []}
          startInSelectedGroup
          onToggle={(category) => {
            onSelect(category);
            onClose();
          }}
          includeAll={includeAll}
          onChooseAll={() => {
            onSelect("Semua");
            onClose();
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

const useStyles = makeStyles((colors) => ({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  groupList: { gap: spacing.sm, paddingBottom: spacing.sm },
  groupRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupCopy: { flex: 1 },
  groupTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  groupMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 1,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.brandPrimary,
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
